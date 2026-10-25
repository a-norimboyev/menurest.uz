import crypto from 'node:crypto';
import { prisma } from '../../db.js';
import { TableStatus, VisitStatus, OrderItemStatus, computeDetailedBill } from '@menurest/shared';
import { recordOutboxEvent, outboxService } from '../realtime/outbox.service.js';

export class VisitsService {
  /**
   * Random xavfsiz 4-xonali kirish kodini hosil qilish
   */
  private generatePinCode(): string {
    return (Math.floor(1000 + Math.random() * 9000)).toString();
  }

  /**
   * Hash hosil qilish
   */
  private hashPinCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * FREE stolga yangi tashrif ochish (Waiter yoki Manager)
   * Parallel ochilishda faqat bittasi yutishi PostgreSQL partial unique indexi bilan kafolatlanadi.
   */
  async openVisit(
    restaurantId: string,
    tableId: string,
    waiterId?: string | null,
    openedByUserId?: string,
    isManager: boolean = false
  ) {
    const rest = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { isActive: true, subscriptionExpiresAt: true },
    });
    if (!rest) {
      throw new Error('RESTAURANT_NOT_FOUND: Restoran topilmadi');
    }
    if (!rest.isActive || (rest.subscriptionExpiresAt && new Date() > rest.subscriptionExpiresAt)) {
      throw new Error('RESTAURANT_SUSPENDED: Restoran xizmati to\'xtatilgan (SUSPENDED). Yangi tashrif ochish taqiqlanadi.');
    }

    const table = await prisma.table.findFirst({
      where: { id: tableId, restaurantId },
    });
    if (!table) {
      throw new Error('TABLE_NOT_FOUND: Stol topilmadi');
    }

    if (table.status !== TableStatus.FREE) {
      throw new Error(`TABLE_NOT_FREE: Faqat bo'sh (FREE) stolga yangi tashrif ochish mumkin. Joriy holat: ${table.status}`);
    }

    const pinCode = this.generatePinCode();
    const pinCodeHash = this.hashPinCode(pinCode);
    const assignedWaiterId = waiterId || table.assignedWaiterId || openedByUserId || null;

    try {
      // Tranzaksiya ichida tekshirish va yaratish
      const result = await prisma.$transaction(async (tx) => {
        // 1. Stol qatorini FOR UPDATE bilan qulflash (Row-level lock)
        await tx.$queryRaw`SELECT id FROM tables WHERE id = ${tableId} AND restaurant_id = ${restaurantId} FOR UPDATE`;

        // 2. Qulflangan stol holatini va undagi faol tashriflarni tekshirish
        const lockedTable = await tx.table.findFirst({
          where: { id: tableId, restaurantId },
          include: {
            visits: {
              where: { status: VisitStatus.ACTIVE },
            },
          },
        });

        if (!lockedTable || lockedTable.status !== TableStatus.FREE || lockedTable.visits.length > 0) {
          throw new Error(
            `TABLE_ALREADY_OCCUPIED: Ushbu stolda allaqachon faol tashrif ochilgan (${lockedTable?.status || 'NOT_FOUND'})`
          );
        }

        if (!isManager && lockedTable.assignedWaiterId && openedByUserId && lockedTable.assignedWaiterId !== openedByUserId) {
          throw new Error('TABLE_ASSIGNED_TO_OTHER: Ushbu stol boshqa ofitsiantga biriktirilgan');
        }

        const effectiveWaiterId = waiterId || lockedTable.assignedWaiterId || openedByUserId || null;

        // 3. Stol holatini OCCUPIED ga o'zgartirish va mas'ul ofitsiantni kafolatlash
        await tx.table.update({
          where: { id: tableId },
          data: {
            status: TableStatus.OCCUPIED,
            assignedWaiterId: lockedTable.assignedWaiterId || effectiveWaiterId,
          },
        });

        const rest = await tx.restaurant.findUnique({
          where: { id: restaurantId },
          select: { serviceChargeBps: true },
        });

        // Tashrif yaratish. PostgreSQL partial unique index ("idx_unique_active_visit_per_table")
        // bir vaqtning o'zida parallel kelgan ikkinchi so'rovni 100% atomik ravishda to'xtatadi.
        const visit = await tx.visit.create({
          data: {
            restaurantId,
            tableId,
            pinCode,
            pinCodeHash,
            status: VisitStatus.ACTIVE,
            waiterId: effectiveWaiterId,
            openedByUserId: openedByUserId || null,
            serviceChargeBpsSnapshot: rest?.serviceChargeBps ?? 0,
          },
          include: {
            table: true,
            waiter: { select: { id: true, fullName: true, phone: true } },
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            restaurantId,
            action: 'VISIT_OPENED',
            actorId: openedByUserId || 'system',
            entityName: 'Visit',
            entityId: visit.id,
            newStateJson: {
              tableId,
              tableNumber: table.number,
              // Xavfsizlik: Kirish kodi hech qachon audit logga plain-text yozilmaydi
              codeMasked: '****',
            },
          },
        });

        await recordOutboxEvent(tx, {
          restaurantId,
          eventType: 'table.state_changed',
          payload: {
            tableId,
            status: TableStatus.OCCUPIED,
            visitId: visit.id,
            waiterId: visit.waiterId,
          },
          scope: {
            restaurantId,
            tableId,
            visitId: visit.id,
          },
        });

        return visit;
      });

      outboxService.trigger();

      return {
        id: result.id,
        tableId: result.tableId,
        tableNumber: table.number,
        restaurantId: result.restaurantId,
        status: result.status,
        pinCode: result.pinCode, // Xodimga mehmonlarga aytishi uchun qaytariladi
        waiter: result.waiter,
        openedAt: result.openedAt,
      };
    } catch (err: any) {
      // Prisma P2002 kodi - unique constraint violation (parallel ochilish poygasi)
      if (err.code === 'P2002') {
        throw new Error('TABLE_ALREADY_OCCUPIED: Ushbu stolda allaqachon faol tashrif ochilgan');
      }
      throw err;
    }
  }

  /**
   * Kirish kodini yangilash (Rotate code)
   */
  async rotateCode(restaurantId: string, visitId: string, userId: string) {
    const visit = await prisma.visit.findFirst({
      where: { id: visitId, restaurantId, status: VisitStatus.ACTIVE },
    });
    if (!visit) {
      throw new Error('ACTIVE_VISIT_NOT_FOUND: Faol tashrif topilmadi');
    }

    const newPinCode = this.generatePinCode();
    const newPinCodeHash = this.hashPinCode(newPinCode);

    const updated = await prisma.visit.update({
      where: { id: visitId },
      data: {
        pinCode: newPinCode,
        pinCodeHash: newPinCodeHash,
        failedAttempts: 0,
        lockedUntil: null,
        codeRotatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        restaurantId,
        action: 'VISIT_CODE_ROTATED',
        actorId: userId,
        entityName: 'Visit',
        entityId: visitId,
        newStateJson: { codeRotatedAt: updated.codeRotatedAt, codeMasked: '****' },
      },
    });

    return {
      visitId: updated.id,
      pinCode: updated.pinCode,
      codeRotatedAt: updated.codeRotatedAt,
    };
  }

  /**
   * Tashrifni yopish (Item checks va Billing checks bilan)
   * Yopilganda:
   * 1. Barcha mehmon sessiyalari bekor qilinadi (GuestSession.isRevoked = true)
   * 2. Stol OCCUPIED -> DIRTY holatiga o'tadi
   */
  async closeVisit(
    restaurantId: string,
    visitId: string,
    userId: string,
    forceSettlement = false
  ) {
    const visit = await prisma.visit.findFirst({
      where: { id: visitId, restaurantId, status: VisitStatus.ACTIVE },
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
      },
    });
    if (!visit) {
      throw new Error('ACTIVE_VISIT_NOT_FOUND: Faol tashrif topilmadi');
    }

    // 1. Item checks: Hali oshxonada tayyorlanayotgan yoki kutilayotgan taomlar bormi?
    const allItems = visit.orders.flatMap((o) => o.items);
    const unfinishedItems = allItems.filter(
      (item) =>
        item.status === OrderItemStatus.PENDING ||
        item.status === OrderItemStatus.ACCEPTED ||
        item.status === OrderItemStatus.PREPARING
    );

    if (unfinishedItems.length > 0) {
      throw new Error(
        `ACTIVE_ITEMS_EXIST: Tashrifda hali tayyorlanayotgan (${unfinishedItems.length} ta) taomlar mavjud. Avval taomlar yetkazilishi yoki bekor qilinishi shart.`
      );
    }

    // 2. Billing checks: To'lanmagan hisob yoki qaytarish kerak bo'lgan qoldiq bormi?
    const serviceChargeBps =
      visit.serviceChargeBpsSnapshot ?? visit.restaurant.serviceChargeBps ?? 0;
    const bill = computeDetailedBill(
      allItems,
      serviceChargeBps,
      visit.adjustments,
      visit.payments
    );

    if (bill.balanceTiyin > 0n && !forceSettlement) {
      throw new Error(
        `UNPAID_BALANCE: To'lanmagan hisob mavjud. Qoldiq: ${bill.balanceTiyin} tiyin.`
      );
    }

    if (bill.balanceTiyin < 0n) {
      throw new Error(
        `REFUND_DUE: Hisobda ortiqcha to'lov mavjud (${-bill.balanceTiyin} tiyin). Avval mijozga pul qaytarilishi shart, shundan so'ng tashrif yopiladi.`
      );
    }

    // 3. Tashrifni yopish va stolni DIRTY holatiga o'tkazish
    const result = await prisma.$transaction(async (tx) => {
      // Tashrifni yopish
      const closedVisit = await tx.visit.update({
        where: { id: visitId },
        data: {
          status: VisitStatus.CLOSED,
          closedAt: new Date(),
          closedByUserId: userId,
        },
      });

      // Barcha faol guest sessionlarni darhol bekor qilish (Revoke)
      await tx.guestSession.updateMany({
        where: { visitId },
        data: { isRevoked: true },
      });

      // Stol holati: OCCUPIED -> DIRTY
      await tx.table.update({
        where: { id: visit.tableId },
        data: { status: TableStatus.DIRTY },
      });

      // Audit log
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
            previousTableStatus: TableStatus.OCCUPIED,
            newTableStatus: TableStatus.DIRTY,
            closedAt: closedVisit.closedAt,
          },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'visit.closed',
        payload: {
          visitId,
          tableId: visit.tableId,
          status: VisitStatus.CLOSED,
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
        payload: {
          tableId: visit.tableId,
          status: TableStatus.DIRTY,
        },
        scope: {
          restaurantId,
          tableId: visit.tableId,
        },
      });

      return closedVisit;
    });

    outboxService.trigger();

    return {
      visitId: result.id,
      status: result.status,
      closedAt: result.closedAt,
      tableStatus: TableStatus.DIRTY,
    };
  }
}

export const visitsService = new VisitsService();
