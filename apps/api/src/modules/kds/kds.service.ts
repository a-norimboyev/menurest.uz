import { prisma } from '../../db.js';
import { recordOutboxEvent, outboxService } from '../realtime/outbox.service.js';
import {
  OrderItemStatus,
  OrderStatus,
  Role,
  ServiceCallStatus,
  ServiceCallType,
  deriveOrderStatus,
} from '@menurest/shared';

export interface KdsFilterQuery {
  stationId?: string;
  status?: string; // 'ALL' | 'ACCEPTED' | 'PREPARING' | 'READY'
  sort?: 'oldest' | 'newest';
}

export class KdsService {
  /**
   * 1. Xodim uchun ruxsat berilgan stansiyalar ro'yxatini olish
   */
  async getAccessibleStationIds(
    restaurantId: string,
    userId: string,
    isManager: boolean
  ): Promise<{ stationIds: string[]; isScoped: boolean }> {
    // Menejer va Bosslar barcha stansiyalarga to'liq kirish huquqiga ega
    if (isManager) {
      const allStations = await prisma.preparationStation.findMany({
        where: { restaurantId },
        select: { id: true },
      });
      return { stationIds: allStations.map((s: { id: string }) => s.id), isScoped: false };
    }

    // Oshxona xodimining maxsus biriktirilgan stansiyalari
    const assignments = await prisma.staffStationAssignment.findMany({
      where: { restaurantId, userId },
      select: { stationId: true },
    });

    if (assignments.length > 0) {
      return { stationIds: assignments.map((a: { stationId: string }) => a.stationId), isScoped: true };
    }

    // Agar maxsus biriktirilmagan bo'lsa, umumiy barcha stansiyalar ko'rinadi
    const defaultStations = await prisma.preparationStation.findMany({
      where: { restaurantId },
      select: { id: true },
    });
    return { stationIds: defaultStations.map((s: { id: string }) => s.id), isScoped: false };
  }

  /**
   * 2. KDS Displeyi uchun stansiyalar ro'yxati
   */
  async getStations(restaurantId: string, userId: string, isManager: boolean) {
    const { stationIds, isScoped } = await this.getAccessibleStationIds(
      restaurantId,
      userId,
      isManager
    );

    const stations = await prisma.preparationStation.findMany({
      where: {
        restaurantId,
        id: { in: stationIds },
      },
      orderBy: { name: 'asc' },
    });

    return {
      stations,
      isScoped,
    };
  }

  /**
   * 3. KDS Chiptalari (Tickets & Items) ro'yxati
   */
  async getTickets(
    restaurantId: string,
    userId: string,
    isManager: boolean,
    query: KdsFilterQuery
  ) {
    const { stationIds: allowedStationIds, isScoped } = await this.getAccessibleStationIds(
      restaurantId,
      userId,
      isManager
    );

    // Agar foydalanuvchi ma'lum stansiyaga cheklangan bo'lsa va begona stansiyani so'rasa -> 403
    let targetStationIds = allowedStationIds;
    if (query.stationId && query.stationId !== 'all') {
      if (isScoped && !allowedStationIds.includes(query.stationId)) {
        throw new Error('STATION_ACCESS_DENIED: Ushbu stansiya sizning profilingizga biriktirilmagan');
      }
      targetStationIds = [query.stationId];
    }

    // Status filtri: Faqat oshxona ko'rishi kerak bo'lgan holatlar
    let targetStatuses: OrderItemStatus[] = [
      OrderItemStatus.ACCEPTED,
      OrderItemStatus.PREPARING,
      OrderItemStatus.READY,
    ];

    if (query.status && query.status !== 'ALL') {
      if (Object.values(OrderItemStatus).includes(query.status as any)) {
        targetStatuses = [query.status as OrderItemStatus];
      }
    }

    // Oshxona taomlarini bazadan olish
    const items = await prisma.orderItem.findMany({
      where: {
        restaurantId,
        stationId: { in: targetStationIds },
        status: { in: targetStatuses },
        order: {
          status: { notIn: [OrderStatus.CANCELLED] },
          visit: { status: 'ACTIVE' },
        },
      },
      include: {
        station: { select: { id: true, name: true, type: true } },
        addonSnapshots: { select: { id: true, name: true, priceTiyin: true } },
        order: {
          include: {
            visit: {
              include: {
                table: {
                  include: {
                    hall: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        order: {
          createdAt: query.sort === 'newest' ? 'desc' : 'asc',
        },
      },
    });

    const now = Date.now();

    // Chiptalarni buyurtmalar bo'yicha guruhlash
    const ticketsMap = new Map<string, any>();

    for (const itm of items) {
      const order = itm.order;
      const orderId = order.id;

      if (!ticketsMap.has(orderId)) {
        const orderCreatedTime = new Date(order.createdAt).getTime();
        const elapsedMinutes = Math.max(0, Math.floor((now - orderCreatedTime) / (1000 * 60)));

        ticketsMap.set(orderId, {
          orderId,
          orderNumber: order.orderNumber,
          tableId: order.visit.table.id,
          tableNumber: order.visit.table.number,
          hallName: order.visit.table.hall.name,
          orderStatus: order.status,
          orderNotes: order.notes,
          orderCreatedAt: order.createdAt,
          elapsedMinutes,
          items: [],
        });
      }

      const itemCreatedTime = itm.preparedAt
        ? new Date(itm.preparedAt).getTime()
        : new Date(order.createdAt).getTime();
      const itemElapsedMinutes = Math.max(0, Math.floor((now - itemCreatedTime) / (1000 * 60)));

      ticketsMap.get(orderId).items.push({
        id: itm.id,
        menuItemId: itm.menuItemId,
        name: itm.snapshotName,
        variantName: itm.snapshotVariantName,
        quantity: itm.quantity,
        status: itm.status,
        notes: itm.notes, // Izohlar taom nomidan yo'qolmagan holda alohida
        version: itm.version,
        stationId: itm.stationId,
        stationName: itm.station.name,
        stationType: itm.station.type,
        addons: itm.addonSnapshots.map((a: any) => a.name),
        preparedAt: itm.preparedAt,
        readyAt: itm.readyAt,
        elapsedMinutes: itemElapsedMinutes,
      });
    }

    const tickets = Array.from(ticketsMap.values());

    // Metrikalar
    const acceptedCount = items.filter((i: any) => i.status === OrderItemStatus.ACCEPTED).length;
    const preparingCount = items.filter((i: any) => i.status === OrderItemStatus.PREPARING).length;
    const readyCount = items.filter((i: any) => i.status === OrderItemStatus.READY).length;

    return {
      metrics: {
        acceptedCount,
        preparingCount,
        readyCount,
        totalActiveCount: items.length,
      },
      tickets,
      itemsCount: items.length,
    };
  }

  /**
   * 4. Taomni tayyorlashni boshlash (ACCEPTED -> PREPARING)
   */
  async prepareItem(
    restaurantId: string,
    itemId: string,
    userId: string,
    isManager: boolean,
    expectedVersion?: number
  ) {
    // 1. Taomni olish va mavjudligini tekshirish
    const item = await prisma.orderItem.findFirst({
      where: { id: itemId, restaurantId },
      include: {
        station: true,
        order: { include: { items: true } },
      },
    });

    if (!item) {
      throw new Error('ITEM_NOT_FOUND: Taom topilmadi');
    }

    // 2. Stansiya ruxsatini tekshirish
    const { stationIds } = await this.getAccessibleStationIds(restaurantId, userId, isManager);
    if (!stationIds.includes(item.stationId)) {
      throw new Error('STATION_ACCESS_DENIED: Ushbu taom sizning stansiyangizga tegishli emas');
    }

    // 3. Idempotentlik: agar allaqachon PREPARING bo'lsa
    if (item.status === OrderItemStatus.PREPARING) {
      return { item, orderStatus: item.order.status, isIdempotentReplay: true };
    }

    // 4. Invariant tekshiruvlari
    if (item.status === OrderItemStatus.CANCELLED) {
      throw new Error('CANNOT_PREPARE_CANCELLED: Bekor qilingan taomni tayyorlab bo\'lmaydi');
    }

    if (item.status === OrderItemStatus.PENDING) {
      throw new Error('ORDER_NOT_CONFIRMED: Ofitsiant tasdiqlamagan (PENDING) taomni tayyorlash mumkin emas');
    }

    if (item.status === OrderItemStatus.READY || item.status === OrderItemStatus.SERVED) {
      throw new Error(`INVALID_STATUS_TRANSITION: Taom allaqachon ${item.status} holatida`);
    }

    // 5. Optimistic Concurrency tekshiruvi (expectedVersion)
    if (expectedVersion !== undefined && item.version !== expectedVersion) {
      throw new Error('ITEM_VERSION_CONFLICT: Taom holati boshqa xodim tomonidan yangilangan');
    }

    // 6. Atomik tranzaksiya: taom holati va buyurtma xulosasini yangilash
    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.orderItem.update({
        where: { id: itemId },
        data: {
          status: OrderItemStatus.PREPARING,
          version: { increment: 1 },
          preparedAt: new Date(),
        },
        include: { addonSnapshots: true, station: true },
      });

      // Buyurtmaning barcha taomlari bo'yicha yangi holatni hisoblash
      const allSiblings = await tx.orderItem.findMany({ where: { orderId: item.orderId } });
      const newOrderStatus = deriveOrderStatus(allSiblings);

      await tx.order.update({
        where: { id: item.orderId },
        data: { status: newOrderStatus },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'ITEM_PREPARING',
          actorId: userId,
          entityName: 'OrderItem',
          entityId: itemId,
          newStateJson: { status: OrderItemStatus.PREPARING, orderStatus: newOrderStatus },
        },
      });

      // Outbox event: item.state_changed (PREPARING)
      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'item.state_changed',
        payload: {
          itemId,
          orderId: item.orderId,
          menuItemId: item.menuItemId,
          stationId: item.stationId,
          status: OrderItemStatus.PREPARING,
          snapshotName: item.snapshotName,
          orderStatus: newOrderStatus,
        },
        scope: {
          restaurantId,
          visitId: item.order?.visitId,
          stationId: item.stationId,
        },
      });

      return { item: updated, orderStatus: newOrderStatus, isIdempotentReplay: false };
    });

    outboxService.trigger();
    return result;
  }

  /**
   * 5. Taomni tayyor deb belgilash (PREPARING / ACCEPTED -> READY)
   * Qat'iy Invariant: Bir taom READY bo'lsa, qolganlari avtomatik READY qilinmaydi!
   */
  async readyItem(
    restaurantId: string,
    itemId: string,
    userId: string,
    isManager: boolean,
    expectedVersion?: number
  ) {
    const item = await prisma.orderItem.findFirst({
      where: { id: itemId, restaurantId },
      include: {
        station: true,
        order: { include: { items: true } },
      },
    });

    if (!item) {
      throw new Error('ITEM_NOT_FOUND: Taom topilmadi');
    }

    // Stansiya ruxsatini tekshirish
    const { stationIds } = await this.getAccessibleStationIds(restaurantId, userId, isManager);
    if (!stationIds.includes(item.stationId)) {
      throw new Error('STATION_ACCESS_DENIED: Ushbu taom sizning stansiyangizga tegishli emas');
    }

    // Idempotentlik: agar allaqachon READY bo'lsa
    if (item.status === OrderItemStatus.READY) {
      return { item, orderStatus: item.order.status, isIdempotentReplay: true };
    }

    // Invariant tekshiruvlari
    if (item.status === OrderItemStatus.CANCELLED) {
      throw new Error('CANNOT_READY_CANCELLED: Bekor qilingan taomni tayyor deb belgilab bo\'lmaydi');
    }

    if (item.status === OrderItemStatus.PENDING) {
      throw new Error('ORDER_NOT_CONFIRMED: Ofitsiant tasdiqlamagan taomni tayyor deb belgilab bo\'lmaydi');
    }

    if (item.status === OrderItemStatus.SERVED) {
      throw new Error('CANNOT_READY_SERVED: Allaqachon mehmonga yetkazilgan taomni tayyor deb bo\'lmaydi');
    }

    if (expectedVersion !== undefined && item.version !== expectedVersion) {
      throw new Error('ITEM_VERSION_CONFLICT: Taom holati boshqa xodim tomonidan yangilangan');
    }

    // Atomik tranzaksiya
    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.orderItem.update({
        where: { id: itemId },
        data: {
          status: OrderItemStatus.READY,
          version: { increment: 1 },
          readyAt: new Date(),
        },
        include: { addonSnapshots: true, station: true },
      });

      // Buyurtmaning barcha taomlarini olib, umumiy holatni hisoblash
      const allSiblings = await tx.orderItem.findMany({ where: { orderId: item.orderId } });
      const newOrderStatus = deriveOrderStatus(allSiblings);

      await tx.order.update({
        where: { id: item.orderId },
        data: { status: newOrderStatus },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'ITEM_READY',
          actorId: userId,
          entityName: 'OrderItem',
          entityId: itemId,
          newStateJson: { status: OrderItemStatus.READY, orderStatus: newOrderStatus },
        },
      });

      // Outbox event: item.state_changed (READY)
      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'item.state_changed',
        payload: {
          itemId,
          orderId: item.orderId,
          menuItemId: item.menuItemId,
          stationId: item.stationId,
          status: OrderItemStatus.READY,
          snapshotName: item.snapshotName,
          orderStatus: newOrderStatus,
        },
        scope: {
          restaurantId,
          visitId: item.order?.visitId,
          stationId: item.stationId,
        },
      });

      return { item: updated, orderStatus: newOrderStatus, isIdempotentReplay: false };
    });

    outboxService.trigger();
    return result;
  }

  /**
   * 6. Bulk Action: Faqat aniq tanlangan, ruxsat etilgan taomlarga ishlaydi
   */
  async bulkUpdateStatus(
    restaurantId: string,
    itemIds: string[],
    targetStatus: OrderItemStatus.PREPARING | OrderItemStatus.READY,
    userId: string,
    isManager: boolean
  ) {
    if (!itemIds || itemIds.length === 0) {
      throw new Error('EMPTY_SELECTION: Hech qanday taom tanlanmadi');
    }

    const { stationIds } = await this.getAccessibleStationIds(restaurantId, userId, isManager);

    // Barcha tanlangan taomlarni tekshirish
    const items = await prisma.orderItem.findMany({
      where: { id: { in: itemIds }, restaurantId },
      include: { station: true },
    });

    if (items.length !== itemIds.length) {
      throw new Error('ITEM_NOT_FOUND: Ba\'zi taomlar topilmadi');
    }

    // Begona stansiya taomi tanlangan bo'lsa rad etiladi
    const unauthorizedItem = items.find((i: any) => !stationIds.includes(i.stationId));
    if (unauthorizedItem) {
      throw new Error(
        `STATION_ACCESS_DENIED: '${unauthorizedItem.snapshotName}' sizning stansiyangizga tegishli emas`
      );
    }

    const updatedItemIds: string[] = [];
    const affectedOrderIds = new Set<string>();

    await prisma.$transaction(async (tx: any) => {
      for (const itm of items) {
        if (itm.status === OrderItemStatus.CANCELLED || itm.status === OrderItemStatus.PENDING) {
          continue;
        }

        const dataToUpdate: any = {
          status: targetStatus,
          version: { increment: 1 },
        };
        if (targetStatus === OrderItemStatus.PREPARING && !itm.preparedAt) {
          dataToUpdate.preparedAt = new Date();
        } else if (targetStatus === OrderItemStatus.READY) {
          dataToUpdate.readyAt = new Date();
        }

        await tx.orderItem.update({
          where: { id: itm.id },
          data: dataToUpdate,
        });

        updatedItemIds.push(itm.id);
        affectedOrderIds.add(itm.orderId);
      }

      // Ta'sirlangan har bir buyurtmaning holatini qayta hisoblash
      for (const ordId of affectedOrderIds) {
        const siblings = await tx.orderItem.findMany({ where: { orderId: ordId } });
        const newStatus = deriveOrderStatus(siblings);
        await tx.order.update({
          where: { id: ordId },
          data: { status: newStatus },
        });
      }

      // Har bir taom uchun Outbox item.state_changed hodisasi
      for (const itm of items) {
        await recordOutboxEvent(tx, {
          restaurantId,
          eventType: 'item.state_changed',
          payload: {
            itemId: itm.id,
            orderId: itm.orderId,
            menuItemId: itm.menuItemId,
            stationId: itm.stationId,
            status: targetStatus,
            snapshotName: itm.snapshotName,
          },
          scope: {
            restaurantId,
            stationId: itm.stationId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'ITEMS_BULK_STATUS_UPDATED',
          actorId: userId,
          entityName: 'OrderItem',
          entityId: updatedItemIds.join(','),
          newStateJson: { targetStatus, count: updatedItemIds.length },
        },
      });
    });

    outboxService.trigger();

    return {
      updatedCount: updatedItemIds.length,
      updatedItemIds,
    };
  }

  /**
   * 7. "Tayyorlab bo'lmaydi" (Cannot Prepare) Harakati
   * Waiter/Managerga sababli xabar yuboradi. Kitchen o'zicha moliyaviy bekor qila olmaydi.
   * PREPARING dan keyingi cancellation faqat tegishli vakolat (Manager) orqali hal qilinadi.
   */
  async cannotPrepareItem(
    restaurantId: string,
    itemId: string,
    userId: string,
    isManager: boolean,
    reason: string,
    expectedVersion?: number
  ) {
    if (!reason || !reason.trim()) {
      throw new Error('REASON_REQUIRED: Tayyorlab bo\'lmaslik sababi kiritilishi shart');
    }

    const item = await prisma.orderItem.findFirst({
      where: { id: itemId, restaurantId },
      include: {
        station: true,
        order: {
          include: {
            visit: {
              include: { table: true },
            },
          },
        },
      },
    });

    if (!item) {
      throw new Error('ITEM_NOT_FOUND: Taom topilmadi');
    }

    // Stansiya ruxsati
    const { stationIds } = await this.getAccessibleStationIds(restaurantId, userId, isManager);
    if (!stationIds.includes(item.stationId)) {
      throw new Error('STATION_ACCESS_DENIED: Ushbu taom sizning stansiyangizga tegishli emas');
    }

    if (item.status === OrderItemStatus.CANCELLED) {
      return { item, alertCreated: false, isAlreadyCancelled: true };
    }

    if (item.status === OrderItemStatus.SERVED) {
      throw new Error('CANNOT_CANCEL_SERVED: Mehmonga yetkazilgan taomni bekor qilib bo\'lmaydi');
    }

    if (expectedVersion !== undefined && item.version !== expectedVersion) {
      throw new Error('ITEM_VERSION_CONFLICT: Taom holati boshqa xodim tomonidan o\'zgartirilgan');
    }

    // Qoida: PREPARING holatidagi taomni oddiy Kitchen xodimi o'zboshimchalik bilan bekor qila olmaydi
    // (chunki masalliq sarflangan/isrof qoidasi). Kitchen faqat Manager/Waiterga xabar beradi.
    if (item.status === OrderItemStatus.PREPARING && !isManager) {
      // Oshxona xabarnomasi (ServiceCall) yaratish
      const alertCall = await prisma.serviceCall.create({
        data: {
          restaurantId,
          visitId: item.order.visitId,
          tableId: item.order.visit.tableId,
          type: ServiceCallType.CUSTOM,
          status: ServiceCallStatus.PENDING,
        },
      });

      await prisma.auditLog.create({
        data: {
          restaurantId,
          action: 'ITEM_CANNOT_PREPARE_REQUESTED',
          actorId: userId,
          entityName: 'OrderItem',
          entityId: itemId,
          reason,
          newStateJson: {
            status: item.status,
            alertId: alertCall.id,
            message: 'Oshxona tayyorlab bo\'lmasligini ma\'lum qildi, menejer tasdig\'i kutilmoqda',
          },
        },
      });

      // Outbox call.created
      await recordOutboxEvent(prisma, {
        restaurantId,
        eventType: 'call.created',
        data: {
          callId: alertCall.id,
          tableId: item.order.visit.tableId,
          visitId: item.order.visitId,
          type: alertCall.type,
          status: alertCall.status,
          message: 'Oshxona pishirish jarayonidagi taomni bekor qilish so\'rovini yubordi',
        },
        scope: {
          visitId: item.order.visitId,
          tableId: item.order.visit.tableId,
        },
      });
      outboxService.trigger();

      return {
        item,
        alertCreated: true,
        callId: alertCall.id,
        isCancellationPending: true,
        message: 'Menejer va ofitsiantga xabar yuborildi. Pishirish jarayonidagi taomni faqat menejer bekor qilishi mumkin.',
      };
    }

    // Agar taom hali ACCEPTED holatida bo'lsa (yoki amalni Menejer bajarayotgan bo'lsa), bekor qilinadi
    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.orderItem.update({
        where: { id: itemId },
        data: {
          status: OrderItemStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancelledByUserId: userId,
          cancelledAt: new Date(),
          version: { increment: 1 },
        },
        include: { station: true, addonSnapshots: true },
      });

      // Buyurtma holatini qayta hisoblash
      const allSiblings = await tx.orderItem.findMany({ where: { orderId: item.orderId } });
      const newOrderStatus = deriveOrderStatus(allSiblings);

      await tx.order.update({
        where: { id: item.orderId },
        data: { status: newOrderStatus },
      });

      // Waiter/Manager uchun bildirishnoma (ServiceCall)
      const alertCall = await tx.serviceCall.create({
        data: {
          restaurantId,
          visitId: item.order.visitId,
          tableId: item.order.visit.tableId,
          type: ServiceCallType.CUSTOM,
          status: ServiceCallStatus.PENDING,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'ITEM_CANNOT_PREPARE',
          actorId: userId,
          entityName: 'OrderItem',
          entityId: itemId,
          reason,
          newStateJson: {
            status: OrderItemStatus.CANCELLED,
            orderStatus: newOrderStatus,
            alertCallId: alertCall.id,
          },
        },
      });

      // Outbox item.state_changed (CANCELLED)
      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'item.state_changed',
        payload: {
          itemId,
          orderId: item.orderId,
          menuItemId: item.menuItemId,
          stationId: item.stationId,
          status: OrderItemStatus.CANCELLED,
          reason: reason.trim(),
          orderStatus: newOrderStatus,
        },
        scope: {
          restaurantId,
          visitId: item.order.visitId,
          tableId: item.order.visit.tableId,
          stationId: item.stationId,
        },
      });

      // Outbox call.created
      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'call.created',
        payload: {
          callId: alertCall.id,
          tableId: item.order.visit.tableId,
          visitId: item.order.visitId,
          type: alertCall.type,
          status: alertCall.status,
        },
        scope: {
          restaurantId,
          visitId: item.order.visitId,
          tableId: item.order.visit.tableId,
        },
      });

      return { item: updated, orderStatus: newOrderStatus, alertCreated: true, callId: alertCall.id };
    });

    outboxService.trigger();
    return result;
  }

  /**
   * 8. Xodimlarni stansiyalarga biriktirish (Boss / Manager uchun)
   */
  async assignStaffStations(
    restaurantId: string,
    targetUserId: string,
    stationIds: string[],
    actorUserId: string
  ) {
    // Restorandagi a'zolikni tekshirish
    const membership = await prisma.restaurantMembership.findFirst({
      where: { restaurantId, userId: targetUserId, isActive: true },
    });

    if (!membership) {
      throw new Error('STAFF_NOT_FOUND: Xodim restoranda topilmadi yoki faol emas');
    }

    // Barcha stansiyalarning ushbu restoranga tegishliligini tekshirish
    const stations = await prisma.preparationStation.findMany({
      where: { restaurantId, id: { in: stationIds } },
    });

    if (stations.length !== stationIds.length) {
      throw new Error('INVALID_STATION_TENANT: Ba\'zi stansiyalar ushbu restoranga tegishli emas');
    }

    await prisma.$transaction(async (tx: any) => {
      // Eski biriktiruvlarni tozalash
      await tx.staffStationAssignment.deleteMany({
        where: { restaurantId, userId: targetUserId },
      });

      // Yangi biriktiruvlarni yaratish
      for (const stId of stationIds) {
        await tx.staffStationAssignment.create({
          data: {
            restaurantId,
            userId: targetUserId,
            stationId: stId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'STAFF_STATIONS_ASSIGNED',
          actorId: actorUserId,
          entityName: 'User',
          entityId: targetUserId,
          newStateJson: { assignedStationIds: stationIds },
        },
      });
    });

    return { success: true, assignedStationIds: stationIds };
  }

  /**
   * 9. Xodimning biriktirilgan stansiyalarini ko'rish
   */
  async getStaffStations(restaurantId: string, targetUserId: string) {
    const assignments = await prisma.staffStationAssignment.findMany({
      where: { restaurantId, userId: targetUserId },
      include: {
        station: true,
      },
    });

    return assignments.map((a: any) => a.station);
  }
}

export const kdsService = new KdsService();
