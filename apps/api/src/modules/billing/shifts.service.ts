import { prisma } from '../../db.js';
import { ShiftStatus, ShiftSummary, CashMovementType, Role } from '@menurest/shared';

export interface OpenShiftParams {
  restaurantId: string;
  userId: string;
  startingCashTiyin: bigint;
  notes?: string;
}

export interface CloseShiftParams {
  restaurantId: string;
  userId: string;
  shiftId: string;
  countedCashTiyin: bigint;
  notes?: string;
}

export interface RecordCashMovementParams {
  restaurantId: string;
  userId: string;
  shiftId: string;
  type: CashMovementType;
  amountTiyin: bigint;
  reason: string;
}

export class ShiftsService {
  /**
   * 1. Kassir yoki Menejer uchun yangi smena ochish
   * PostgreSQL partial unique indexi ("idx_unique_active_shift_per_user")
   * bir vaqtning o'zida ikkita ochiq smenani 100% rad etadi.
   */
  async openShift(params: OpenShiftParams) {
    const { restaurantId, userId, startingCashTiyin, notes } = params;

    // Mavjud ochiq smena bormi?
    const existingShift = await prisma.shift.findFirst({
      where: {
        restaurantId,
        userId,
        status: ShiftStatus.OPEN,
      },
    });

    if (existingShift) {
      const err: any = new Error('SHIFT_ALREADY_OPEN: Sizda ushbu restoranda allaqachon ochiq smena mavjud');
      err.statusCode = 409;
      err.code = 'SHIFT_ALREADY_OPEN';
      throw err;
    }

    const shift = await prisma.$transaction(async (tx) => {
      const created = await tx.shift.create({
        data: {
          restaurantId,
          userId,
          status: ShiftStatus.OPEN,
          startingCashTiyin,
          notes,
        },
        include: {
          user: { select: { id: true, fullName: true, phone: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          actorId: userId,
          action: 'SHIFT_OPENED',
          entityName: 'Shift',
          entityId: created.id,
          newStateJson: {
            startingCashTiyin: startingCashTiyin.toString(),
            openedAt: created.openedAt.toISOString(),
          },
        },
      });

      return created;
    });

    return shift;
  }

  /**
   * 2. Joriy faol smena tafsilotlari va real-vaqt moliyaviy jamlanmasini olish
   */
  async getCurrentShiftSummary(restaurantId: string, userId?: string, shiftId?: string): Promise<ShiftSummary | null> {
    const whereClause: any = { restaurantId };
    if (shiftId) {
      whereClause.id = shiftId;
    } else if (userId) {
      whereClause.userId = userId;
      whereClause.status = ShiftStatus.OPEN;
    } else {
      whereClause.status = ShiftStatus.OPEN;
    }

    const shift = await prisma.shift.findFirst({
      where: whereClause,
      include: {
        user: { select: { id: true, fullName: true } },
        payments: {
          include: {
            refunds: true,
          },
        },
        refunds: true,
        cashMovements: true,
      },
    });

    if (!shift) return null;

    // Tallies
    let cashReceiptsTiyin = 0n;
    let terminalReceiptsTiyin = 0n;
    let cashRefundsTiyin = 0n;
    let terminalRefundsTiyin = 0n;
    let cashReversalsTiyin = 0n;
    let terminalReversalsTiyin = 0n;

    for (const p of shift.payments) {
      if (p.status === 'COMPLETED') {
        if (p.method === 'CASH') {
          cashReceiptsTiyin += p.amountTiyin;
        } else {
          terminalReceiptsTiyin += p.amountTiyin;
        }

        // To'lovga bog'langan qaytarishlar
        for (const ref of p.refunds) {
          if (p.method === 'CASH') {
            cashRefundsTiyin += ref.amountTiyin;
          } else {
            terminalRefundsTiyin += ref.amountTiyin;
          }
        }
      } else if (p.status === 'REVERSED') {
        if (p.method === 'CASH') {
          cashReversalsTiyin += p.amountTiyin;
        } else {
          terminalReversalsTiyin += p.amountTiyin;
        }
      }
    }

    let cashInTiyin = 0n;
    let cashOutTiyin = 0n;

    for (const cm of shift.cashMovements) {
      if (cm.type === 'CASH_IN') {
        cashInTiyin += cm.amountTiyin;
      } else {
        cashOutTiyin += cm.amountTiyin;
      }
    }

    // Expected cash = opening cash + cash receipts - cash refunds - cash reversals + cash in - cash out
    const expectedCashTiyin =
      shift.startingCashTiyin +
      cashReceiptsTiyin -
      cashRefundsTiyin -
      cashReversalsTiyin +
      cashInTiyin -
      cashOutTiyin;

    const terminalTotalTiyin = terminalReceiptsTiyin - terminalRefundsTiyin;

    const countedCashTiyin = shift.countedCashTiyin ?? null;
    const differenceTiyin =
      countedCashTiyin !== null ? countedCashTiyin - expectedCashTiyin : null;

    return {
      id: shift.id,
      restaurantId: shift.restaurantId,
      userId: shift.userId,
      cashierName: shift.user.fullName,
      status: shift.status as ShiftStatus,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
      startingCashTiyin: shift.startingCashTiyin,
      closingCashTiyin: shift.closingCashTiyin,
      countedCashTiyin,
      differenceTiyin,
      expectedCashTiyin,
      terminalTotalTiyin,
      cashReceiptsTiyin,
      terminalReceiptsTiyin,
      cashRefundsTiyin,
      terminalRefundsTiyin,
      cashReversalsTiyin,
      terminalReversalsTiyin,
      cashInTiyin,
      cashOutTiyin,
      notes: shift.notes,
    };
  }

  /**
   * 3. Kassaga naqd pul kiritish yoki kassadan naqd olish (Cash In / Cash Out)
   */
  async recordCashMovement(params: RecordCashMovementParams) {
    const { restaurantId, userId, shiftId, type, amountTiyin, reason } = params;

    if (amountTiyin <= 0n) {
      const err: any = new Error('INVALID_AMOUNT: Pul miqdori musbat bo\'lishi shart');
      err.statusCode = 400;
      err.code = 'INVALID_AMOUNT';
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      // Row lock on Shift
      await tx.$queryRaw`SELECT id FROM shifts WHERE id = ${shiftId} AND restaurant_id = ${restaurantId} FOR UPDATE`;

      const shift = await tx.shift.findUnique({
        where: { id: shiftId },
      });

      if (!shift || shift.restaurantId !== restaurantId || shift.status !== ShiftStatus.OPEN) {
        const err: any = new Error('SHIFT_NOT_OPEN: Faqat ochiq smenada kassa harakatini bajarish mumkin');
        err.statusCode = 400;
        err.code = 'SHIFT_NOT_OPEN';
        throw err;
      }

      const movement = await tx.cashMovement.create({
        data: {
          restaurantId,
          shiftId,
          userId,
          type,
          amountTiyin,
          reason,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          actorId: userId,
          action: type === 'CASH_IN' ? 'CASH_IN_RECORDED' : 'CASH_OUT_RECORDED',
          entityName: 'CashMovement',
          entityId: movement.id,
          newStateJson: {
            shiftId,
            amountTiyin: amountTiyin.toString(),
            reason,
          },
        },
      });

      return movement;
    });
  }

  /**
   * 4. Smenani yopish va kassa taftishi (Reconciliation)
   * Deadlock oldini olish uchun faqat Shift qatori FOR UPDATE bilan qulflanadi.
   */
  async closeShift(params: CloseShiftParams) {
    const { restaurantId, userId, shiftId, countedCashTiyin, notes } = params;

    return prisma.$transaction(async (tx) => {
      // 1. Shift qatorini atomik qulflash (Row-level lock)
      await tx.$queryRaw`SELECT id FROM shifts WHERE id = ${shiftId} AND restaurant_id = ${restaurantId} FOR UPDATE`;

      const shift = await tx.shift.findUnique({
        where: { id: shiftId },
        include: {
          payments: { include: { refunds: true } },
          cashMovements: true,
        },
      });

      if (!shift || shift.restaurantId !== restaurantId) {
        const err: any = new Error('SHIFT_NOT_FOUND: Smena topilmadi');
        err.statusCode = 404;
        err.code = 'SHIFT_NOT_FOUND';
        throw err;
      }

      if (shift.status !== ShiftStatus.OPEN) {
        const err: any = new Error('SHIFT_ALREADY_CLOSED: Ushbu smena allaqachon yopilgan');
        err.statusCode = 400;
        err.code = 'SHIFT_ALREADY_CLOSED';
        throw err;
      }

      // 2. Kassa hisob-kitoblarini qayta jamlash
      let cashReceiptsTiyin = 0n;
      let terminalReceiptsTiyin = 0n;
      let cashRefundsTiyin = 0n;
      let terminalRefundsTiyin = 0n;
      let cashReversalsTiyin = 0n;

      for (const p of shift.payments) {
        if (p.status === 'COMPLETED') {
          if (p.method === 'CASH') {
            cashReceiptsTiyin += p.amountTiyin;
          } else {
            terminalReceiptsTiyin += p.amountTiyin;
          }

          for (const ref of p.refunds) {
            if (p.method === 'CASH') {
              cashRefundsTiyin += ref.amountTiyin;
            } else {
              terminalRefundsTiyin += ref.amountTiyin;
            }
          }
        } else if (p.status === 'REVERSED') {
          if (p.method === 'CASH') {
            cashReversalsTiyin += p.amountTiyin;
          }
        }
      }

      let cashInTiyin = 0n;
      let cashOutTiyin = 0n;
      for (const cm of shift.cashMovements) {
        if (cm.type === 'CASH_IN') cashInTiyin += cm.amountTiyin;
        else cashOutTiyin += cm.amountTiyin;
      }

      const expectedCashTiyin =
        shift.startingCashTiyin +
        cashReceiptsTiyin -
        cashRefundsTiyin -
        cashReversalsTiyin +
        cashInTiyin -
        cashOutTiyin;

      const terminalTotalTiyin = terminalReceiptsTiyin - terminalRefundsTiyin;
      const differenceTiyin = countedCashTiyin - expectedCashTiyin;

      const closed = await tx.shift.update({
        where: { id: shiftId },
        data: {
          status: ShiftStatus.CLOSED,
          closedAt: new Date(),
          closingCashTiyin: countedCashTiyin,
          countedCashTiyin,
          differenceTiyin,
          expectedCashTiyin,
          terminalTotalTiyin,
          notes: notes || shift.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          actorId: userId,
          action: 'SHIFT_CLOSED',
          entityName: 'Shift',
          entityId: shiftId,
          newStateJson: {
            expectedCashTiyin: expectedCashTiyin.toString(),
            countedCashTiyin: countedCashTiyin.toString(),
            differenceTiyin: differenceTiyin.toString(),
            terminalTotalTiyin: terminalTotalTiyin.toString(),
          },
        },
      });

      return closed;
    });
  }
}

export const shiftsService = new ShiftsService();
