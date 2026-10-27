import { prisma } from '../../db.js';
import {
  OrderItemStatus,
  VisitStatus,
  TableStatus,
  PaymentMethod,
  PaymentStatus,
  ShiftStatus,
  AdjustmentType,
  DetailedBillSummary,
  computeDetailedBill,
} from '@menurest/shared';
import { recordOutboxEvent, outboxService } from '../realtime/outbox.service.js';

export interface RecordPaymentParams {
  visitId: string;
  cashierId: string;
  method: PaymentMethod;
  amountTiyin: bigint;
  tenderedCashTiyin?: bigint;
  changeTiyin?: bigint;
  idempotencyKey?: string;
}

export interface ReversePaymentParams {
  paymentId: string;
  userId: string;
  reason: string;
}

export interface ProcessRefundParams {
  paymentId: string;
  amountTiyin: bigint;
  reason: string;
  authorizedByUserId: string;
  idempotencyKey?: string;
}

export interface AddAdjustmentParams {
  visitId: string;
  type: AdjustmentType;
  amountTiyin: bigint;
  percentageBps?: number | null;
  reason: string;
  approvedByUserId: string;
}

export class BillingService {
  /**
   * 1. Tashrifning jonli to'liq hisob-kitobini olish (Detailed Bill Summary)
   * Barcha ekranlarda aynan bitta server funksiyasi bir xil natija beradi.
   */
  async getVisitBill(restaurantId: string, visitId: string) {
    const visit = await prisma.visit.findFirst({
      where: { id: visitId, restaurantId },
      include: {
        table: true,
        restaurant: { select: { serviceChargeBps: true } },
        orders: {
          include: {
            items: {
              include: {
                addonSnapshots: true,
              },
            },
          },
        },
        adjustments: true,
        payments: {
          include: {
            refunds: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!visit) {
      const err: any = new Error('VISIT_NOT_FOUND: Tashrif topilmadi');
      err.statusCode = 404;
      err.code = 'VISIT_NOT_FOUND';
      throw err;
    }

    // Xizmat haqi snapshot bo'lsa snapshot olinadi, aks holda restoran sozlamasidan
    const serviceChargeBps =
      visit.serviceChargeBpsSnapshot ?? visit.restaurant.serviceChargeBps ?? 0;

    const allItems = visit.orders.flatMap((o) => o.items);

    const billSummary = computeDetailedBill(
      allItems,
      serviceChargeBps,
      visit.adjustments,
      visit.payments
    );

    return {
      visit: {
        id: visit.id,
        restaurantId: visit.restaurantId,
        tableId: visit.tableId,
        tableNumber: visit.table.number,
        status: visit.status,
        openedAt: visit.openedAt,
        closedAt: visit.closedAt,
        waiterId: visit.waiterId,
        serviceChargeBpsSnapshot: visit.serviceChargeBpsSnapshot,
      },
      bill: billSummary,
      orders: visit.orders,
      adjustments: visit.adjustments,
      payments: visit.payments,
    };
  }

  /**
   * 2. To'lovni qayd etish (Payment recording - Cashier / Manager)
   * Concurrency Kafolati:
   * Har doim global qulflash tartibi: avval Shift qatori, so'ng Visit qatori SELECT FOR UPDATE qilinadi!
   */
  async recordPayment(restaurantId: string, params: RecordPaymentParams) {
    const {
      visitId,
      cashierId,
      method,
      amountTiyin,
      tenderedCashTiyin,
      changeTiyin,
      idempotencyKey,
    } = params;

    if (amountTiyin <= 0n) {
      const err: any = new Error('INVALID_AMOUNT: To\'lov summasi musbat bo\'lishi kerak');
      err.statusCode = 400;
      err.code = 'INVALID_AMOUNT';
      throw err;
    }

    // 2.1 Faol kassa smenasini tekshirish (Cashier MUST have OPEN shift)
    let activeShift = await prisma.shift.findFirst({
      where: {
        restaurantId,
        userId: cashierId,
        status: ShiftStatus.OPEN,
      },
    });

    if (!activeShift) {
      // 1-urinish: Restorandagi boshqa mavjud ochiq smenani topish (Umumiy kassa)
      activeShift = await prisma.shift.findFirst({
        where: {
          restaurantId,
          status: ShiftStatus.OPEN,
        },
      });

      // 2-urinish: Agar restoranda hali hech qanday smena ochilmagan bo'lsa va bu tezkor/fast-food (START) rejimida bo'lsa,
      // to'lov to'xtab qolmasligi uchun xodim nomiga avtomatik boshlang'ich smena ochamiz (startingCash = 0)
      const rest = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { subscriptionPlan: true },
      });
      if (rest?.subscriptionPlan === 'START' || rest?.subscriptionPlan === 'FAST_FOOD') {
        try {
          activeShift = await prisma.shift.create({
            data: {
              restaurantId,
              userId: cashierId,
              status: ShiftStatus.OPEN,
              startingCashTiyin: 0n,
              notes: "Avtomatik ochilgan kassa smenasi (Tezkor to'lov)",
            },
          });
        } catch {
          activeShift = await prisma.shift.findFirst({
            where: { restaurantId, status: ShiftStatus.OPEN },
          });
        }
      }
    }

    if (!activeShift) {
      const err: any = new Error('CASHIER_SHIFT_REQUIRED: To\'lov qabul qilish uchun avval kassa smenasini ochishingiz kerak');
      err.statusCode = 400;
      err.code = 'CASHIER_SHIFT_REQUIRED';
      throw err;
    }

    // 2.2 Idempotency kaliti bo'yicha takroriy so'rovni tekshirish
    if (idempotencyKey) {
      const existingPayment = await prisma.payment.findFirst({
        where: {
          restaurantId,
          visitId,
          idempotencyKey,
        },
        include: { refunds: true },
      });

      if (existingPayment) {
        // Agar bir xil kalit va bir xil summa bo'lsa -> Replay
        if (existingPayment.amountTiyin === amountTiyin && existingPayment.method === method) {
          return {
            payment: existingPayment,
            isIdempotentReplay: true,
          };
        }
        // Bir xil kalit, lekin boshqa summa/metod -> 409 Conflict
        const err: any = new Error('IDEMPOTENCY_CONFLICT: Ushbu idempotency kaliti boshqa to\'lov parametrlari bilan allaqachon ishlatilgan');
        err.statusCode = 409;
        err.code = 'IDEMPOTENCY_CONFLICT';
        throw err;
      }
    }

    // 2.3 PostgreSQL Tranzaksiyasi va SELECT FOR UPDATE
    const payment = await prisma.$transaction(async (tx) => {
      // 1-qadam: Deadlock oldini olish uchun tartibli qulflash:
      // Avval Shift qatori FOR UPDATE
      await tx.$queryRaw`SELECT id FROM shifts WHERE id = ${activeShift.id} AND restaurant_id = ${restaurantId} FOR UPDATE`;

      const lockedShift = await tx.shift.findFirst({
        where: { id: activeShift.id, restaurantId },
        select: { id: true, status: true },
      });
      if (!lockedShift || lockedShift.status !== ShiftStatus.OPEN) {
        const err: any = new Error('CASHIER_SHIFT_CLOSED: Kassa smenasi yopilgan. To\'lov qabul qilib bo\'lmaydi');
        err.statusCode = 400;
        err.code = 'CASHIER_SHIFT_CLOSED';
        throw err;
      }

      // So'ng Visit qatori FOR UPDATE
      await tx.$queryRaw`SELECT id FROM visits WHERE id = ${visitId} AND restaurant_id = ${restaurantId} FOR UPDATE`;

      // Tashrif va joriy ma'lumotlarni bazadan toza yuklash
      const visit = await tx.visit.findFirst({
        where: { id: visitId, restaurantId },
        include: {
          table: true,
          restaurant: { select: { serviceChargeBps: true } },
          orders: {
            include: {
              items: {
                include: { addonSnapshots: true },
              },
            },
          },
          adjustments: true,
          payments: {
            include: { refunds: true },
          },
        },
      });

      if (!visit) {
        const err: any = new Error('VISIT_NOT_FOUND: Tashrif topilmadi');
        err.statusCode = 404;
        err.code = 'VISIT_NOT_FOUND';
        throw err;
      }

      if (visit.status !== VisitStatus.ACTIVE) {
        const err: any = new Error(`VISIT_NOT_ACTIVE: Tashrif faol emas (${visit.status}). To'lov qabul qilinmaydi.`);
        err.statusCode = 400;
        err.code = 'VISIT_NOT_ACTIVE';
        throw err;
      }

      // Idempotency tekshiruvi (Row-lock ichida - parallel poyga vaqtida ikkinchi so'rov to'g'ri replay qaytarishi uchun)
      if (idempotencyKey) {
        const existingLockedPayment = visit.payments.find((p) => p.idempotencyKey === idempotencyKey);
        if (existingLockedPayment) {
          if (existingLockedPayment.amountTiyin === amountTiyin && existingLockedPayment.method === method) {
            return {
              payment: existingLockedPayment,
              isIdempotentReplay: true,
            };
          }
          const err: any = new Error('IDEMPOTENCY_CONFLICT: Ushbu idempotency kaliti boshqa to\'lov parametrlari bilan allaqachon ishlatilgan');
          err.statusCode = 409;
          err.code = 'IDEMPOTENCY_CONFLICT';
          throw err;
        }
      }

      // Qayta hisoblash (Fresh calculation inside row-lock)
      const serviceChargeBps =
        visit.serviceChargeBpsSnapshot ?? visit.restaurant.serviceChargeBps ?? 0;
      const allItems = visit.orders.flatMap((o) => o.items);
      const bill = computeDetailedBill(
        allItems,
        serviceChargeBps,
        visit.adjustments,
        visit.payments
      );

      // Invariant: Balancega teng yoki kichik summa qabul qilinadi!
      if (amountTiyin > bill.balanceTiyin) {
        const err: any = new Error(
          `OVERPAYMENT_REJECTED: To'lov summasi qoldiqdan oshib ketdi. Qoldiq: ${bill.balanceTiyin} tiyin, to'lov: ${amountTiyin} tiyin`
        );
        err.statusCode = 400;
        err.code = 'OVERPAYMENT_REJECTED';
        throw err;
      }

      // Naqd to'lovda berilgan pul va qaytim hisobi
      let finalTendered = tenderedCashTiyin ?? null;
      let finalChange = changeTiyin ?? null;

      if (method === PaymentMethod.CASH && finalTendered) {
        if (finalTendered < amountTiyin) {
          const err: any = new Error('INSUFFICIENT_CASH_TENDERED: Berilgan naqd pul to\'lov summasidan kam');
          err.statusCode = 400;
          err.code = 'INSUFFICIENT_CASH_TENDERED';
          throw err;
        }
        finalChange = finalTendered - amountTiyin;
      }

      // To'lovni yaratish
      const createdPayment = await tx.payment.create({
        data: {
          restaurantId,
          visitId,
          shiftId: activeShift.id,
          cashierId,
          method,
          amountTiyin,
          tenderedCashTiyin: finalTendered,
          changeTiyin: finalChange,
          status: PaymentStatus.COMPLETED,
          idempotencyKey: idempotencyKey || null,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'PAYMENT_RECORDED',
          actorId: cashierId,
          entityName: 'Payment',
          entityId: createdPayment.id,
          newStateJson: {
            visitId,
            tableId: visit.tableId,
            tableNumber: visit.table.number,
            amountTiyin: amountTiyin.toString(),
            method,
            tenderedCashTiyin: finalTendered ? finalTendered.toString() : null,
            changeTiyin: finalChange ? finalChange.toString() : null,
            shiftId: activeShift.id,
          },
        },
      });

      // Outbox hodisalari
      const newBalanceTiyin = bill.balanceTiyin - amountTiyin;

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'payment.recorded',
        data: {
          paymentId: createdPayment.id,
          visitId,
          tableId: visit.tableId,
          tableNumber: visit.table.number,
          amountTiyin: amountTiyin.toString(),
          method,
          cashierId,
          createdAt: createdPayment.createdAt.toISOString(),
        },
        scope: {
          restaurantId,
          visitId,
          tableId: visit.tableId,
          isFinancial: true,
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'bill.updated',
        data: {
          visitId,
          tableId: visit.tableId,
          balanceTiyin: newBalanceTiyin.toString(),
          totalDueTiyin: bill.totalDueTiyin.toString(),
          netPaidTiyin: (bill.netPaidTiyin + amountTiyin).toString(),
          updatedAt: new Date().toISOString(),
        },
        scope: {
          restaurantId,
          visitId,
          tableId: visit.tableId,
          isFinancial: true,
        },
      });

      return {
        payment: createdPayment,
        isIdempotentReplay: false,
      };
    });

    outboxService.trigger();
    return payment;
  }

  /**
   * 3. Xato to'lovni bekor qilish (Payment Reversal - Kassir xato yozuvini tuzatadi)
   * Bir pul ikki marta reversal yoki refund qilinmasligi kafolatlanadi.
   */
  async reversePayment(restaurantId: string, params: ReversePaymentParams) {
    const { paymentId, userId, reason } = params;

    if (!reason || reason.trim().length === 0) {
      const err: any = new Error('REASON_REQUIRED: To\'lovni bekor qilish sababi kiritilishi shart');
      err.statusCode = 400;
      err.code = 'REASON_REQUIRED';
      throw err;
    }

    const reversed = await prisma.$transaction(async (tx) => {
      // 1. Payment qatorini qulflash
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${paymentId} AND restaurant_id = ${restaurantId} FOR UPDATE`;

      const payment = await tx.payment.findFirst({
        where: { id: paymentId, restaurantId },
        include: { refunds: true, visit: true },
      });

      if (!payment) {
        const err: any = new Error('PAYMENT_NOT_FOUND: To\'lov topilmadi');
        err.statusCode = 404;
        err.code = 'PAYMENT_NOT_FOUND';
        throw err;
      }

      if (payment.status === PaymentStatus.REVERSED) {
        const err: any = new Error('PAYMENT_ALREADY_REVERSED: Ushbu to\'lov allaqachon bekor qilingan');
        err.statusCode = 400;
        err.code = 'PAYMENT_ALREADY_REVERSED';
        throw err;
      }

      if (payment.refunds.length > 0) {
        const err: any = new Error('CANNOT_REVERSE_REFUNDED_PAYMENT: Qaytarish (refund) qilingan to\'lovni reversal qilib bo\'lmaydi');
        err.statusCode = 400;
        err.code = 'CANNOT_REVERSE_REFUNDED_PAYMENT';
        throw err;
      }

      // Reversalni qayd etish
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REVERSED,
          reversalReason: reason,
          reversedAt: new Date(),
          reversedByUserId: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'PAYMENT_REVERSED',
          actorId: userId,
          entityName: 'Payment',
          entityId: paymentId,
          reason,
          newStateJson: {
            reversalReason: reason,
            reversedAt: updated.reversedAt?.toISOString(),
          },
        },
      });

      // Outbox hodisasi
      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'bill.updated',
        data: {
          visitId: payment.visitId,
          paymentId,
          reversalAmountTiyin: payment.amountTiyin.toString(),
          reason,
          updatedAt: new Date().toISOString(),
        },
        scope: {
          restaurantId,
          visitId: payment.visitId,
          isFinancial: true,
        },
      });

      return updated;
    });

    outboxService.trigger();
    return reversed;
  }

  /**
   * 4. Qaytarishni qayd etish (Refund processing - Manager / Boss)
   * Original payment bo'yicha available refundable amountdan oshish taqiqlanadi.
   * Yopilgan hisob bo'lsa: atomik ravishda manfiy adjustment + refund yoziladi (soxta qarzdorlik hosil bo'lmaydi).
   */
  async processRefund(restaurantId: string, params: ProcessRefundParams) {
    const { paymentId, amountTiyin, reason, authorizedByUserId, idempotencyKey } = params;

    if (amountTiyin <= 0n) {
      const err: any = new Error('INVALID_AMOUNT: Qaytarish summasi musbat bo\'lishi shart');
      err.statusCode = 400;
      err.code = 'INVALID_AMOUNT';
      throw err;
    }

    if (!reason || reason.trim().length === 0) {
      const err: any = new Error('REASON_REQUIRED: Qaytarish sababi talab qilinadi');
      err.statusCode = 400;
      err.code = 'REASON_REQUIRED';
      throw err;
    }

    // Amaldagi ochiq smenani topish (tuzatish/qaytarish uchun)
    const activeShift = await prisma.shift.findFirst({
      where: {
        restaurantId,
        status: ShiftStatus.OPEN,
      },
      orderBy: { openedAt: 'desc' },
    });

    const refund = await prisma.$transaction(async (tx) => {
      // 1. Payment qatorini qulflash (Row-level lock)
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${paymentId} AND restaurant_id = ${restaurantId} FOR UPDATE`;

      const payment = await tx.payment.findFirst({
        where: { id: paymentId, restaurantId },
        include: {
          refunds: true,
          visit: { include: { table: true } },
        },
      });

      if (!payment) {
        const err: any = new Error('PAYMENT_NOT_FOUND: To\'lov topilmadi');
        err.statusCode = 404;
        err.code = 'PAYMENT_NOT_FOUND';
        throw err;
      }

      if (payment.status === PaymentStatus.REVERSED) {
        const err: any = new Error('PAYMENT_ALREADY_REVERSED: Reversal qilingan to\'lovdan pul qaytarib bo\'lmaydi');
        err.statusCode = 400;
        err.code = 'PAYMENT_ALREADY_REVERSED';
        throw err;
      }

      // Qaytarish mumkin bo'lgan maksimal summani tekshirish
      const alreadyRefundedTiyin = payment.refunds.reduce(
        (sum, r) => sum + r.amountTiyin,
        0n
      );
      const availableRefundableTiyin = payment.amountTiyin - alreadyRefundedTiyin;

      if (amountTiyin > availableRefundableTiyin) {
        const err: any = new Error(
          `REFUND_EXCEEDS_PAYMENT: Qaytarish summasi to'lov qoldig'idan oshib ketdi. Maksimal qaytarish mumkin: ${availableRefundableTiyin} tiyin`
        );
        err.statusCode = 400;
        err.code = 'REFUND_EXCEEDS_PAYMENT';
        throw err;
      }

      // 2. Yopilgan tashrif (Closed Visit) maxsus workflow:
      // Yopilgan tashrifda soxta qarzdorlik hosil bo'lmasligi uchun mos manfiy adjustment atomar yoziladi!
      if (payment.visit.status === VisitStatus.CLOSED) {
        await tx.billAdjustment.create({
          data: {
            restaurantId,
            visitId: payment.visitId,
            type: AdjustmentType.CORRECTION,
            amountTiyin: -amountTiyin, // MANFIY ADJUSTMENT! totalDue ni kamaytiradi
            reason: `Yopilgan hisobdan pul qaytarish tuzatishi: ${reason}`,
            approvedByUserId: authorizedByUserId,
          },
        });
      }

      // 3. Refund yaratish
      const createdRefund = await tx.refund.create({
        data: {
          restaurantId,
          paymentId,
          shiftId: activeShift?.id || null,
          amountTiyin,
          reason,
          authorizedByUserId,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'REFUND_RECORDED',
          actorId: authorizedByUserId,
          entityName: 'Refund',
          entityId: createdRefund.id,
          reason,
          newStateJson: {
            paymentId,
            visitId: payment.visitId,
            amountTiyin: amountTiyin.toString(),
            shiftId: activeShift?.id || null,
            isClosedVisitRefund: payment.visit.status === VisitStatus.CLOSED,
          },
        },
      });

      // Outbox hodisalari
      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'refund.recorded',
        data: {
          refundId: createdRefund.id,
          paymentId,
          visitId: payment.visitId,
          tableId: payment.visit.tableId,
          amountTiyin: amountTiyin.toString(),
          reason,
          authorizedByUserId,
          createdAt: createdRefund.createdAt.toISOString(),
        },
        scope: {
          restaurantId,
          visitId: payment.visitId,
          tableId: payment.visit.tableId,
          isFinancial: true,
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'bill.updated',
        data: {
          visitId: payment.visitId,
          tableId: payment.visit.tableId,
          refundAmountTiyin: amountTiyin.toString(),
          updatedAt: new Date().toISOString(),
        },
        scope: {
          restaurantId,
          visitId: payment.visitId,
          tableId: payment.visit.tableId,
          isFinancial: true,
        },
      });

      return createdRefund;
    });

    outboxService.trigger();
    return refund;
  }

  /**
   * 5. Hisobga chegirma yoki tuzatish kiritish (Bill Adjustment)
   */
  async addAdjustment(restaurantId: string, params: AddAdjustmentParams) {
    const { visitId, type, amountTiyin, percentageBps, reason, approvedByUserId } = params;

    return prisma.$transaction(async (tx) => {
      // Row lock on Visit
      await tx.$queryRaw`SELECT id FROM visits WHERE id = ${visitId} AND restaurant_id = ${restaurantId} FOR UPDATE`;

      const visit = await tx.visit.findFirst({
        where: { id: visitId, restaurantId },
        include: { table: true },
      });

      if (!visit) {
        const err: any = new Error('VISIT_NOT_FOUND: Tashrif topilmadi');
        err.statusCode = 404;
        err.code = 'VISIT_NOT_FOUND';
        throw err;
      }

      if (visit.status !== VisitStatus.ACTIVE) {
        const err: any = new Error('VISIT_NOT_ACTIVE: Faqat faol tashrifga chegirma kiritish mumkin');
        err.statusCode = 400;
        err.code = 'VISIT_NOT_ACTIVE';
        throw err;
      }

      const adj = await tx.billAdjustment.create({
        data: {
          restaurantId,
          visitId,
          type,
          amountTiyin,
          percentageBps: percentageBps || null,
          reason,
          approvedByUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'BILL_ADJUSTMENT_ADDED',
          actorId: approvedByUserId,
          entityName: 'BillAdjustment',
          entityId: adj.id,
          reason,
          newStateJson: {
            type,
            amountTiyin: amountTiyin.toString(),
            percentageBps,
          },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'bill.updated',
        data: {
          visitId,
          tableId: visit.tableId,
          adjustmentId: adj.id,
          type,
          updatedAt: new Date().toISOString(),
        },
        scope: {
          restaurantId,
          visitId,
          tableId: visit.tableId,
          isFinancial: true,
        },
      });

      return adj;
    });
  }

  /**
   * 6. Tashrifni yopish (Close Visit - Manager / Cashier / Waiter)
   * Qat'iy Invariantlar:
   * 1. joriy balance aynan 0 tiyin bo'lishi shart. Agar balance > 0 -> UNPAID_BALANCE. Agar balance < 0 -> REFUND_DUE.
   * 2. Barcha taomlar SERVED yoki CANCELLED bo'lishi shart (hech qanday PENDING/ACCEPTED/PREPARING/READY bo'lmasin).
   * 3. Barcha ochiq chaqiruvlar (ServiceCall) hal qilingan bo'lishi shart.
   * 4. Yopilgach stol holati DIRTY bo'ladi (FREE emas!).
   */
  async closeVisit(
    restaurantId: string,
    visitId: string,
    userId: string,
    forceSettlement = false
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Visit qatorini qulflash (Row-level lock)
      await tx.$queryRaw`SELECT id FROM visits WHERE id = ${visitId} AND restaurant_id = ${restaurantId} FOR UPDATE`;

      const visit = await tx.visit.findFirst({
        where: { id: visitId, restaurantId },
        include: {
          table: true,
          restaurant: { select: { serviceChargeBps: true, subscriptionPlan: true, allowedRoles: true } },
          orders: {
            include: {
              items: { include: { addonSnapshots: true } },
            },
          },
          adjustments: true,
          payments: {
            include: { refunds: true },
          },
          serviceCalls: true,
        },
      });

      if (!visit) {
        const err: any = new Error('VISIT_NOT_FOUND: Tashrif topilmadi');
        err.statusCode = 404;
        err.code = 'VISIT_NOT_FOUND';
        throw err;
      }

      if (visit.status !== VisitStatus.ACTIVE) {
        const err: any = new Error('VISIT_ALREADY_CLOSED: Tashrif allaqachon yopilgan');
        err.statusCode = 400;
        err.code = 'VISIT_ALREADY_CLOSED';
        throw err;
      }

      // 2. Taomlar tekshiruvi: faqat SERVED va CANCELLED ruxsat etiladi
      const allItems = visit.orders.flatMap((o) => o.items);
      const activeItems = allItems.filter(
        (i) => i.status !== OrderItemStatus.SERVED && i.status !== OrderItemStatus.CANCELLED
      );

      if (activeItems.length > 0) {
        // Oshxonasiz rejimda (KITCHEN o'chirilgan, START / fast-food / choyxona) yoki majburiy yopishda (forceSettlement)
        // barcha faol taomlar avtomatik yetkazildi (SERVED) deb belgilanadi
        const hasKitchen = (visit.restaurant as any)?.allowedRoles?.includes('KITCHEN') ?? true;
        if (!hasKitchen || visit.restaurant.subscriptionPlan === 'START' || forceSettlement) {
          await tx.orderItem.updateMany({
            where: {
              order: { visitId },
              status: { in: [OrderItemStatus.PENDING, OrderItemStatus.ACCEPTED, OrderItemStatus.PREPARING, OrderItemStatus.READY] },
            },
            data: {
              status: OrderItemStatus.SERVED,
            },
          });
        } else {
          const err: any = new Error(
            `ACTIVE_ITEMS_EXIST: Tashrifda hali yakunlanmagan (${activeItems.length} ta) taomlar mavjud. Avval taomlar yetkazilishi (SERVED) yoki bekor qilinishi shart.`
          );
          err.statusCode = 400;
          err.code = 'ACTIVE_ITEMS_EXIST';
          throw err;
        }
      }

      // 3. Ochiq chaqiruvlarni tekshirish
      const openCalls = visit.serviceCalls.filter(
        (c) => c.status === 'PENDING' || c.status === 'ACKNOWLEDGED'
      );
      if (openCalls.length > 0) {
        if (!forceSettlement) {
          const err: any = new Error(
            `OPEN_CALLS_EXIST: Tashrifda hali ochiq ofitsiant yoki hisob chaqiruvlari mavjud (${openCalls.length} ta). Avval chaqiruvlar yakunlanishi (RESOLVED) shart.`
          );
          err.statusCode = 400;
          err.code = 'OPEN_CALLS_EXIST';
          throw err;
        }

        await tx.serviceCall.updateMany({
          where: {
            visitId,
            status: { in: ['PENDING', 'ACKNOWLEDGED'] },
          },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
          },
        });
      }

      // 4. Moliyaviy balans tekshiruvi
      const serviceChargeBps =
        visit.serviceChargeBpsSnapshot ?? visit.restaurant.serviceChargeBps ?? 0;
      const bill = computeDetailedBill(
        allItems,
        serviceChargeBps,
        visit.adjustments,
        visit.payments
      );

      if (bill.balanceTiyin > 0n && !forceSettlement) {
        const err: any = new Error(
          `UNPAID_BALANCE: To'lanmagan hisob mavjud. Qoldiq: ${bill.balanceTiyin} tiyin.`
        );
        err.statusCode = 400;
        err.code = 'UNPAID_BALANCE';
        throw err;
      }

      if (bill.balanceTiyin < 0n) {
        const err: any = new Error(
          `REFUND_DUE: Hisobda ortiqcha to'lov mavjud (${-bill.balanceTiyin} tiyin). Avval mijozga pul qaytarilishi shart, shundan so'ng tashrif yopiladi.`
        );
        err.statusCode = 400;
        err.code = 'REFUND_DUE';
        throw err;
      }

      // 5. Tashrifni yopish
      const closed = await tx.visit.update({
        where: { id: visitId },
        data: {
          status: VisitStatus.CLOSED,
          closedAt: new Date(),
          closedByUserId: userId,
        },
      });

      // Mehmon sessiyalarini bekor qilish
      await tx.guestSession.updateMany({
        where: { visitId },
        data: { isRevoked: true },
      });

      // Stol holatini DIRTY ga o'tkazish
      await tx.table.update({
        where: { id: visit.tableId },
        data: { status: TableStatus.DIRTY },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'VISIT_CLOSED',
          actorId: userId,
          entityName: 'Visit',
          entityId: visitId,
          newStateJson: {
            tableId: visit.tableId,
            tableNumber: visit.table.number,
            status: VisitStatus.CLOSED,
            tableStatus: TableStatus.DIRTY,
            totalDueTiyin: bill.totalDueTiyin.toString(),
            netPaidTiyin: bill.netPaidTiyin.toString(),
          },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'visit.closed',
        data: {
          visitId,
          tableId: visit.tableId,
          tableNumber: visit.table.number,
          closedAt: closed.closedAt?.toISOString(),
        },
        scope: {
          restaurantId,
          visitId,
          tableId: visit.tableId,
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'table.state_changed',
        data: {
          tableId: visit.tableId,
          tableNumber: visit.table.number,
          status: TableStatus.DIRTY,
        },
        scope: {
          restaurantId,
          tableId: visit.tableId,
        },
      });

      return closed;
    });
  }

  /**
   * 7. Ochiq hisoblar ro'yxatini olish (Kassir paneli uchun)
   */
  async getOpenBills(restaurantId: string) {
    const visits = await prisma.visit.findMany({
      where: {
        restaurantId,
        status: VisitStatus.ACTIVE,
      },
      include: {
        table: true,
        restaurant: { select: { serviceChargeBps: true } },
        orders: {
          include: {
            items: { include: { addonSnapshots: true } },
          },
        },
        adjustments: true,
        payments: {
          include: { refunds: true },
        },
        waiter: { select: { id: true, fullName: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    return visits.map((v) => {
      const allItems = v.orders.flatMap((o) => o.items);
      const serviceChargeBps =
        v.serviceChargeBpsSnapshot ?? v.restaurant.serviceChargeBps ?? 0;
      const bill = computeDetailedBill(allItems, serviceChargeBps, v.adjustments, v.payments);

      return {
        visitId: v.id,
        tableId: v.tableId,
        tableNumber: v.table.number,
        waiterName: v.waiter?.fullName || null,
        openedAt: v.openedAt.toISOString(),
        itemCount: allItems.filter((i) => i.status !== OrderItemStatus.CANCELLED).length,
        bill,
      };
    });
  }
}

export const billingService = new BillingService();
