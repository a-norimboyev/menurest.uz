import { prisma } from '../../db.js';
import {
  OrderStatus,
  OrderItemStatus,
  ServiceCallStatus,
  ServiceCallType,
  deriveOrderStatus,
  Role,
  stripParentheses,
} from '@menurest/shared';
import { recordOutboxEvent, outboxService } from '../realtime/outbox.service.js';

export interface CreateStaffOrderDto {
  visitId: string;
  orderNotes?: string;
  items: {
    menuItemId: string;
    variantId?: string;
    addonOptionIds?: string[];
    notes?: string;
    quantity: number;
  }[];
}

async function resolveRestaurantId(idOrSlug: string): Promise<string> {
  const rest = await prisma.restaurant.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true },
  });
  return rest?.id || idOrSlug;
}

export class WaiterService {
  /**
   * 1. Ofitsiant Asosiy Dashboardi
   * Yangi chaqiruvlar, tayyor taomlar, tasdiq kutayotgan buyurtmalar, hisob so'ragan stollar va mening stollarim
   */
  async getDashboard(restaurantIdInput: string, userId: string, isManager: boolean) {
    const restaurantId = await resolveRestaurantId(restaurantIdInput);
    // 1. Faol chaqiruvlar (Faqat OFITSIANT chaqiruvlari)
    const activeCalls = await prisma.serviceCall.findMany({
      where: {
        restaurantId,
        type: ServiceCallType.WAITER,
        status: { in: [ServiceCallStatus.PENDING, ServiceCallStatus.ACKNOWLEDGED] },
      },
      include: {
        table: {
          select: {
            id: true,
            number: true,
            assignedWaiterId: true,
            hall: { select: { id: true, name: true } },
          },
        },
        visit: {
          select: {
            id: true,
            pinCode: true,
            waiterId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Tayyor bo'lgan taomlar (READY holatida, yetkazilishini kutmoqda)
    const readyItems = await prisma.orderItem.findMany({
      where: {
        restaurantId,
        status: OrderItemStatus.READY,
      },
      include: {
        station: { select: { id: true, name: true, type: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            visit: {
              select: {
                id: true,
                waiterId: true,
                table: {
                  select: {
                    id: true,
                    number: true,
                    assignedWaiterId: true,
                    hall: { select: { name: true } },
                  },
                },
                orders: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    id: true,
                    orderNumber: true,
                    createdAt: true,
                    status: true,
                    items: {
                      select: {
                        id: true,
                        snapshotName: true,
                        snapshotVariantName: true,
                        quantity: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { order: { createdAt: 'asc' } },
    });

    // 3. Tasdiq kutayotgan mehmon buyurtmalari (NEW holatida)
    const pendingOrders = await prisma.order.findMany({
      where: {
        restaurantId,
        status: OrderStatus.NEW,
      },
      include: {
        items: {
          include: {
            addonSnapshots: true,
          },
        },
        visit: {
          select: {
            id: true,
            waiterId: true,
            table: {
              select: {
                id: true,
                number: true,
                assignedWaiterId: true,
                hall: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 4. Stollar ro'yxati (Ofitsiantga biriktirilgan yoki barcha stollar)
    const tables = await prisma.table.findMany({
      where: {
        restaurantId,
      },
      include: {
        hall: { select: { id: true, name: true } },
        assignedWaiter: { select: { id: true, fullName: true, phone: true } },
        visits: {
          where: { status: 'ACTIVE' },
          include: {
            waiter: { select: { id: true, fullName: true, phone: true } },
            orders: {
              include: {
                items: {
                  include: {
                    addonSnapshots: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { number: 'asc' },
    });

    // Stollar ma'lumotlarini hisoblash
    const myTables = tables.map((tbl) => {
      const activeVisit = tbl.visits[0] || null;
      let totalBillTiyin = 0n;
      let ordersCount = 0;
      let itemsCount = 0;

      if (activeVisit) {
        ordersCount = activeVisit.orders.length;
        for (const ord of activeVisit.orders) {
          for (const item of ord.items) {
            if (item.status !== OrderItemStatus.CANCELLED) {
              itemsCount += item.quantity;
              const itemTotal = item.snapshotPriceTiyin * BigInt(item.quantity);
              const addonsTotal = item.addonSnapshots.reduce(
                (sum, a) => sum + a.priceTiyin * BigInt(item.quantity),
                0n
              );
              totalBillTiyin += itemTotal + addonsTotal;
            }
          }
        }
      }

      const assignedWaiter =
        tbl.assignedWaiter ||
        (activeVisit?.waiter
          ? {
              id: activeVisit.waiter.id,
              fullName: activeVisit.waiter.fullName,
              phone: activeVisit.waiter.phone || '',
            }
          : null);
      const isMyTable =
        tbl.assignedWaiterId === userId || activeVisit?.waiterId === userId;

      return {
        id: tbl.id,
        number: tbl.number,
        capacity: tbl.capacity,
        status: tbl.status,
        qrToken: tbl.qrToken,
        hall: tbl.hall,
        assignedWaiter,
        isMyTable,
        activeVisit: activeVisit
          ? {
              id: activeVisit.id,
              openedAt: activeVisit.openedAt,
              pinCode: activeVisit.pinCode,
              ordersCount,
              itemsCount,
              totalBillTiyin: totalBillTiyin.toString(),
              items: (activeVisit.orders || []).flatMap((o: any) =>
                (o.items || []).map((it: any) => ({
                  id: it.id,
                  orderId: o.id,
                  orderNumber: o.orderNumber,
                  orderStatus: o.status,
                  name: stripParentheses(it.snapshotName),
                  variantName: it.snapshotVariantName ? stripParentheses(it.snapshotVariantName) : null,
                  quantity: it.quantity,
                  status: it.status,
                  priceTiyin: it.snapshotPriceTiyin.toString(),
                }))
              ),
            }
          : null,
      };
    });

    // Agar stol hali biriktirilmagan bo'lsa, barcha ofitsiantlar ko'radi (mas'uliyatni olish uchun)
    // Biriktirilgan bo'lsa, faqat mas'ul ofitsiant ko'radi (menejer barchasini ko'radi)
    const isStaffTable = (tbl: { assignedWaiterId: string | null }, vst?: { waiterId: string | null } | null) => {
      const assigned = tbl.assignedWaiterId || vst?.waiterId;
      if (!assigned) {
        return true;
      }
      return assigned === userId;
    };

    const visibleCalls = isManager
      ? activeCalls
      : activeCalls.filter((c) => isStaffTable(c.table, c.visit));

    const visibleReadyItems = isManager
      ? readyItems
      : readyItems.filter((i) => isStaffTable(i.order.visit.table, i.order.visit));

    const visiblePendingOrders = isManager
      ? pendingOrders
      : pendingOrders.filter((o) => isStaffTable(o.visit.table, o.visit));

    // Metrikalar
    const openCallsCount = visibleCalls.filter((c) => c.status === ServiceCallStatus.PENDING).length;
    const billRequestsCount = visibleCalls.filter((c) => c.type === ServiceCallType.BILL).length;
    const readyItemsCount = visibleReadyItems.length;
    const pendingOrdersCount = visiblePendingOrders.length;

    return {
      metrics: {
        openCallsCount,
        readyItemsCount,
        pendingOrdersCount,
        billRequestsCount,
      },
      serviceCalls: visibleCalls.map((c) => ({
        id: c.id,
        tableId: c.tableId,
        tableNumber: c.table.number,
        hallName: c.table.hall.name,
        type: c.type,
        status: c.status,
        acknowledgedByUserId: c.acknowledgedByUserId,
        isMyTable: c.table.assignedWaiterId === userId || c.visit.waiterId === userId,
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
      })),
      readyItems: visibleReadyItems.map((i) => ({
        id: i.id,
        orderId: i.orderId,
        orderNumber: i.order.orderNumber,
        tableId: i.order.visit.table.id,
        tableNumber: i.order.visit.table.number,
        hallName: i.order.visit.table.hall.name,
        name: stripParentheses(i.snapshotName),
        variantName: i.snapshotVariantName ? stripParentheses(i.snapshotVariantName) : null,
        quantity: i.quantity,
        stationName: i.station.name,
        status: i.status,
        priceTiyin: i.snapshotPriceTiyin.toString(),
        isMyTable:
          i.order.visit.table.assignedWaiterId === userId || i.order.visit.waiterId === userId,
        allTableItems: (i.order.visit.orders || []).flatMap((o: any) =>
          (o.items || []).map((it: any) => ({
            id: it.id,
            orderNumber: o.orderNumber,
            name: stripParentheses(it.snapshotName),
            variantName: it.snapshotVariantName ? stripParentheses(it.snapshotVariantName) : null,
            quantity: it.quantity,
            status: it.status,
          }))
        ),
      })),
      pendingOrders: visiblePendingOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        tableId: o.visit.table.id,
        tableNumber: o.visit.table.number,
        hallName: o.visit.table.hall.name,
        status: o.status,
        notes: o.notes,
        createdAt: o.createdAt,
        isMyTable: o.visit.table.assignedWaiterId === userId || o.visit.waiterId === userId,
        items: o.items.map((item) => ({
          id: item.id,
          name: stripParentheses(item.snapshotName),
          variantName: item.snapshotVariantName ? stripParentheses(item.snapshotVariantName) : null,
          quantity: item.quantity,
          status: item.status,
          priceTiyin: item.snapshotPriceTiyin.toString(),
          addons: item.addonSnapshots.map((a) => ({
            name: a.name,
            priceTiyin: a.priceTiyin.toString(),
          })),
        })),
      })),
      myTables,
    };
  }

  /**
   * 2. Xizmat chaqiruvini qabul qilish (Claim)
   * DB conditional atomic update orqali parallel so'rovlarda faqat bitta ofitsiant yutishi kafolatlanadi.
   */
  async claimServiceCall(
    restaurantId: string,
    callId: string,
    waiterId: string,
    isManager: boolean
  ) {
    // 1. Chaqiruvni va stol biriktirilishini tekshirish
    const call = await prisma.serviceCall.findFirst({
      where: { id: callId, restaurantId },
      include: {
        table: true,
        visit: true,
      },
    });

    if (!call) {
      throw new Error('CALL_NOT_FOUND: Xizmat chaqiruvi topilmadi');
    }

    // Idempotentlik tekshiruvi: agar xodim allaqachon o'zi qabul qilgan bo'lsa
    if (call.status === ServiceCallStatus.ACKNOWLEDGED && call.acknowledgedByUserId === waiterId) {
      return { call, isIdempotentReplay: true };
    }

    // Agar chaqiruv boshqa xodim tomonidan qabul qilingan bo'lsa
    if (call.status === ServiceCallStatus.ACKNOWLEDGED) {
      throw new Error('CALL_ALREADY_CLAIMED: Boshqa xodim qabul qilgan');
    }

    if (call.status === ServiceCallStatus.RESOLVED || call.status === ServiceCallStatus.CANCELLED) {
      throw new Error('CALL_ALREADY_CLOSED: Chaqiruv yakunlangan yoki bekor qilingan');
    }

    // Policy: Agar stolga boshqa ofitsiant biriktirilgan bo'lsa (va amaldagi foydalanuvchi manager bo'lmasa)
    if (!isManager) {
      const assignedToOther =
        (call.table.assignedWaiterId && call.table.assignedWaiterId !== waiterId) ||
        (call.visit.waiterId && call.visit.waiterId !== waiterId);

      if (assignedToOther) {
        throw new Error('NOT_ASSIGNED_WAITER: Ushbu stol boshqa ofitsiantga biriktirilgan');
      }
    }

    // 2. Atomik conditional update: status aynan PENDING bo'lsa yangilanadi
    const claimedCall = await prisma.$transaction(async (tx) => {
      const updated = await tx.serviceCall.updateMany({
        where: {
          id: callId,
          restaurantId,
          status: ServiceCallStatus.PENDING,
        },
        data: {
          status: ServiceCallStatus.ACKNOWLEDGED,
          acknowledgedByUserId: waiterId,
        },
      });

      if (updated.count === 0) {
        // Parallel ikkinchi ofitsiant so'rovi bu yerga tushadi
        throw new Error('CALL_ALREADY_CLAIMED: Boshqa xodim qabul qilgan');
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'SERVICE_CALL_CLAIMED',
          actorId: waiterId,
          entityName: 'ServiceCall',
          entityId: callId,
          newStateJson: { status: 'CLAIMED', acknowledgedByUserId: waiterId },
        },
      });

      const rec = await tx.serviceCall.findUnique({ where: { id: callId } });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'call.claimed',
        payload: {
          callId,
          tableId: call.tableId,
          visitId: call.visitId,
          acknowledgedByUserId: waiterId,
          type: call.type,
        },
        scope: {
          restaurantId,
          tableId: call.tableId,
          visitId: call.visitId || undefined,
        },
      });

      return rec;
    });

    outboxService.trigger();
    return { call: claimedCall!, isIdempotentReplay: false };
  }

  /**
   * 3. Chaqiruvni yakunlash (Resolve)
   */
  async resolveServiceCall(
    restaurantId: string,
    callId: string,
    waiterId: string,
    isManager: boolean
  ) {
    const call = await prisma.serviceCall.findFirst({
      where: { id: callId, restaurantId },
    });

    if (!call) {
      throw new Error('CALL_NOT_FOUND: Xizmat chaqiruvi topilmadi');
    }

    if (call.status === ServiceCallStatus.RESOLVED) {
      return { call, isIdempotentReplay: true };
    }

    if (call.status === ServiceCallStatus.CANCELLED) {
      throw new Error('CALL_ALREADY_CLOSED: Chaqiruv bekor qilingan');
    }

    // Faqat qabul qilgan ofitsiant yoki menejer yakunlay oladi
    if (!isManager && call.acknowledgedByUserId && call.acknowledgedByUserId !== waiterId) {
      throw new Error('FORBIDDEN: Faqat qabul qilgan ofitsiant chaqiruvni yakunlay oladi');
    }

    const resolved = await prisma.$transaction(async (tx) => {
      const res = await tx.serviceCall.update({
        where: { id: callId },
        data: {
          status: ServiceCallStatus.RESOLVED,
          resolvedByUserId: waiterId,
          resolvedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'SERVICE_CALL_RESOLVED',
          actorId: waiterId,
          entityName: 'ServiceCall',
          entityId: callId,
          newStateJson: { status: 'RESOLVED', resolvedByUserId: waiterId },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'call.resolved',
        payload: {
          callId,
          tableId: call.tableId,
          visitId: call.visitId,
          status: 'RESOLVED',
          resolvedByUserId: waiterId,
        },
        scope: {
          restaurantId,
          tableId: call.tableId,
          visitId: call.visitId || undefined,
        },
      });

      return res;
    });

    outboxService.trigger();
    return { call: resolved, isIdempotentReplay: false };
  }

  /**
   * 4. Menejer tomonidan chaqiruvni boshqa ofitsiantga o'tkazish (Reassign)
   */
  async reassignServiceCall(
    restaurantId: string,
    callId: string,
    managerId: string,
    targetWaiterId: string,
    reason?: string
  ) {
    const call = await prisma.serviceCall.findFirst({
      where: { id: callId, restaurantId },
    });

    if (!call) {
      throw new Error('CALL_NOT_FOUND: Xizmat chaqiruvi topilmadi');
    }

    if (call.status === ServiceCallStatus.RESOLVED || call.status === ServiceCallStatus.CANCELLED) {
      throw new Error('CANNOT_REASSIGN: Yakunlangan yoki bekor qilingan chaqiruvni o\'tkazib bo\'lmaydi');
    }

    const previousWaiterId = call.acknowledgedByUserId;

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.serviceCall.update({
        where: { id: callId },
        data: {
          status: ServiceCallStatus.ACKNOWLEDGED,
          acknowledgedByUserId: targetWaiterId,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'SERVICE_CALL_REASSIGNED',
          actorId: managerId,
          entityName: 'ServiceCall',
          entityId: callId,
          oldStateJson: { acknowledgedByUserId: previousWaiterId },
          newStateJson: { acknowledgedByUserId: targetWaiterId, reason: reason || 'Menejer ko\'rsatmasi' },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'call.claimed',
        payload: {
          callId,
          tableId: call.tableId,
          visitId: call.visitId,
          acknowledgedByUserId: targetWaiterId,
          reassigned: true,
        },
        scope: {
          restaurantId,
          tableId: call.tableId,
          visitId: call.visitId || undefined,
        },
      });

      return up;
    });

    outboxService.trigger();
    return updated;
  }

  /**
   * 5. Chaqiruvni audit bilan bekor qilish
   */
  async cancelServiceCall(
    restaurantId: string,
    callId: string,
    userId: string,
    reason: string
  ) {
    if (!reason || !reason.trim()) {
      throw new Error('REASON_REQUIRED: Bekor qilish sababi kiritilishi shart');
    }

    const call = await prisma.serviceCall.findFirst({
      where: { id: callId, restaurantId },
    });

    if (!call) {
      throw new Error('CALL_NOT_FOUND: Xizmat chaqiruvi topilmadi');
    }

    if (call.status === ServiceCallStatus.CANCELLED) {
      return call;
    }

    const cancelled = await prisma.$transaction(async (tx) => {
      const canc = await tx.serviceCall.update({
        where: { id: callId },
        data: {
          status: ServiceCallStatus.CANCELLED,
          resolvedByUserId: userId,
          resolvedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'SERVICE_CALL_CANCELLED',
          actorId: userId,
          entityName: 'ServiceCall',
          entityId: callId,
          newStateJson: { status: 'CANCELLED', reason },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'call.resolved',
        payload: {
          callId,
          tableId: call.tableId,
          visitId: call.visitId,
          status: 'CANCELLED',
          reason,
        },
        scope: {
          restaurantId,
          tableId: call.tableId,
          visitId: call.visitId || undefined,
        },
      });

      return canc;
    });

    outboxService.trigger();
    return cancelled;
  }

  /**
   * 6. Mehmon buyurtmasini tasdiqlash (Confirm Order)
   * Buyurtma NEW -> CONFIRMED, taomlar PENDING -> ACCEPTED (oshxonaga yo'naltiriladi)
   */
  async confirmOrder(restaurantId: string, orderId: string, waiterId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { items: true },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND: Buyurtma topilmadi');
    }

    if (order.status === OrderStatus.CONFIRMED) {
      return { order, isIdempotentReplay: true };
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new Error('CANNOT_CONFIRM_CANCELLED: Bekor qilingan buyurtmani tasdiqlab bo\'lmaydi');
    }

    if (order.status !== OrderStatus.NEW) {
      throw new Error('INVALID_ORDER_STATUS: Faqat YANGI (NEW) holatidagi buyurtmani tasdiqlash mumkin');
    }

    // Agar restoran kichik kafe/oshxonasiz rejimda bo'lsa (KITCHEN o'chirilgan yoki START / CAFE), buyurtma tasdiqlanganda to'g'ridan-to'g'ri READY bo'ladi
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { subscriptionPlan: true, allowedRoles: true },
    });
    const isNoKitchenMode =
      (restaurant?.allowedRoles && !restaurant.allowedRoles.includes('KITCHEN')) ||
      restaurant?.subscriptionPlan === 'START' ||
      restaurant?.subscriptionPlan === 'NO_KITCHEN' ||
      restaurant?.subscriptionPlan === 'CAFE';
    const targetItemStatus = isNoKitchenMode ? OrderItemStatus.READY : OrderItemStatus.ACCEPTED;
    const targetOrderStatus = isNoKitchenMode ? OrderStatus.READY : OrderStatus.CONFIRMED;

    // Atomik tranzaksiya
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id: orderId },
        data: { status: targetOrderStatus },
        include: {
          items: { include: { addonSnapshots: true } },
          visit: { include: { table: true } },
        },
      });

      // Tasdiqlovchi ofitsiantni ushbu stol va tashrifga mas'ul etib biriktiramiz
      await tx.visit.update({
        where: { id: ord.visitId },
        data: { waiterId },
      });
      await tx.table.update({
        where: { id: ord.visit.tableId },
        data: { assignedWaiterId: waiterId },
      });

      await tx.orderItem.updateMany({
        where: {
          orderId,
          restaurantId,
          status: OrderItemStatus.PENDING,
        },
        data: {
          status: targetItemStatus,
          ...(isNoKitchenMode ? { readyAt: new Date() } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'ORDER_CONFIRMED',
          actorId: waiterId,
          entityName: 'Order',
          entityId: orderId,
          newStateJson: { status: targetOrderStatus },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'order.confirmed',
        payload: {
          orderId,
          orderNumber: ord.orderNumber,
          visitId: ord.visitId,
          tableId: ord.visit.tableId,
          tableNumber: ord.visit.table.number,
          status: targetOrderStatus,
        },
        scope: {
          restaurantId,
          visitId: ord.visitId,
          tableId: ord.visit.tableId,
        },
      });

      for (const it of ord.items) {
        await recordOutboxEvent(tx, {
          restaurantId,
          eventType: 'item.state_changed',
          payload: {
            orderId,
            itemId: it.id,
            name: it.snapshotName,
            status: targetItemStatus,
            stationId: it.stationId,
          },
          scope: {
            restaurantId,
            visitId: ord.visitId,
            tableId: ord.visit.tableId,
            stationId: it.stationId,
          },
        });
      }

      return ord;
    });

    outboxService.trigger();
    return { order: updatedOrder, isIdempotentReplay: false };
  }

  /**
   * 7. Mehmon buyurtmasini sabab bilan rad etish (Reject / Cancel Order)
   */
  async rejectOrder(
    restaurantId: string,
    orderId: string,
    waiterId: string,
    reason: string
  ) {
    if (!reason || !reason.trim()) {
      throw new Error('REASON_REQUIRED: Rad etish sababi kiritilishi shart');
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { items: true },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND: Buyurtma topilmadi');
    }

    if (order.status === OrderStatus.CANCELLED) {
      return { order, isIdempotentReplay: true };
    }

    if (order.status === OrderStatus.SERVED) {
      throw new Error('CANNOT_CANCEL_SERVED: Yetkazilgan buyurtmani bekor qilib bo\'lmaydi');
    }

    const cancelledOrder = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
        include: { items: true, visit: { include: { table: true } } },
      });

      await tx.orderItem.updateMany({
        where: {
          orderId,
          restaurantId,
          status: { not: OrderItemStatus.CANCELLED },
        },
        data: {
          status: OrderItemStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancelledByUserId: waiterId,
          cancelledAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'ORDER_REJECTED',
          actorId: waiterId,
          entityName: 'Order',
          entityId: orderId,
          newStateJson: { status: OrderStatus.CANCELLED, reason },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'order.confirmed',
        payload: {
          orderId,
          orderNumber: ord.orderNumber,
          visitId: ord.visitId,
          tableId: ord.visit.tableId,
          status: OrderStatus.CANCELLED,
          reason,
        },
        scope: {
          restaurantId,
          visitId: ord.visitId,
          tableId: ord.visit.tableId,
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'bill.updated',
        payload: {
          visitId: ord.visitId,
          reason: 'ORDER_CANCELLED',
        },
        scope: {
          restaurantId,
          visitId: ord.visitId,
          isFinancial: true,
        },
      });

      return ord;
    });

    outboxService.trigger();
    return { order: cancelledOrder, isIdempotentReplay: false };
  }

  /**
   * 8. Tayyor taomni yetkazilgan qilish (Serve Item)
   * Qat'iy Invariant: Faqat READY holatidagi taom SERVED qilinishi mumkin!
   */
  async serveItem(restaurantId: string, orderItemId: string, waiterId: string) {
    const item = await prisma.orderItem.findFirst({
      where: { id: orderItemId, restaurantId },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!item) {
      throw new Error('ITEM_NOT_FOUND: Taom topilmadi');
    }

    // Idempotentlik
    if (item.status === OrderItemStatus.SERVED) {
      return { item, isIdempotentReplay: true };
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { subscriptionPlan: true, allowedRoles: true },
    });
    const isNoKitchenMode =
      (restaurant?.allowedRoles && !restaurant.allowedRoles.includes('KITCHEN')) ||
      restaurant?.subscriptionPlan === 'START' ||
      restaurant?.subscriptionPlan === 'NO_KITCHEN' ||
      restaurant?.subscriptionPlan === 'CAFE';

    // QAT'IY INVARIANT TEKSHIRUVI (Oshxonasiz rejimda ACCEPTED ham yetkazilishi mumkin)
    if (item.status !== OrderItemStatus.READY && (!isNoKitchenMode || item.status !== OrderItemStatus.ACCEPTED)) {
      throw new Error(
        `CANNOT_SERVE_UNREADY_ITEM: Faqat TAYYOR (READY) holatidagi taomni yetkazilgan deb belgilash mumkin. Hozirgi holat: ${item.status}`
      );
    }

    const { updatedItem, newOrderStatus } = await prisma.$transaction(async (tx) => {
      const updated = await tx.orderItem.update({
        where: { id: orderItemId },
        data: { status: OrderItemStatus.SERVED },
      });

      const updatedSiblings = item.order.items.map((i) => ({
        status: (i.id === orderItemId ? OrderItemStatus.SERVED : i.status) as OrderItemStatus,
      }));
      const derived = deriveOrderStatus(updatedSiblings);

      if (derived !== item.order.status) {
        await tx.order.update({
          where: { id: item.orderId },
          data: { status: derived },
        });
      }

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'ITEM_SERVED',
          actorId: waiterId,
          entityName: 'OrderItem',
          entityId: orderItemId,
          newStateJson: { status: OrderItemStatus.SERVED, orderStatus: derived },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'item.state_changed',
        payload: {
          orderId: item.orderId,
          itemId: orderItemId,
          name: item.snapshotName,
          status: OrderItemStatus.SERVED,
          orderStatus: derived,
          stationId: item.stationId,
        },
        scope: {
          restaurantId,
          visitId: item.order.visitId,
          stationId: item.stationId,
        },
      });

      return { updatedItem: updated, newOrderStatus: derived };
    });

    outboxService.trigger();
    return { item: updatedItem, newOrderStatus, isIdempotentReplay: false };
  }

  /**
   * 8.1. Stolning barcha faol taomlarini yetkazilgan deb belgilash (Serve All Items for Visit)
   */
  async serveVisitItems(restaurantId: string, visitId: string, waiterId: string) {
    const items = await prisma.orderItem.findMany({
      where: {
        order: { visitId, restaurantId },
        status: { in: [OrderItemStatus.READY, OrderItemStatus.ACCEPTED, OrderItemStatus.PREPARING] },
      },
      include: { order: true },
    });

    if (items.length === 0) return { count: 0 };

    await prisma.$transaction(async (tx) => {
      // Mas'ul ofitsiant belgilanmagan bo'lsa, yetkazib bergan ofitsiantni biriktiramiz
      const visit = await tx.visit.findUnique({
        where: { id: visitId },
        select: { tableId: true, waiterId: true },
      });
      if (visit && !visit.waiterId) {
        await tx.visit.update({
          where: { id: visitId },
          data: { waiterId },
        });
        await tx.table.update({
          where: { id: visit.tableId },
          data: { assignedWaiterId: waiterId },
        });
      }

      await tx.orderItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: { status: OrderItemStatus.SERVED },
      });

      const orderIds = [...new Set(items.map((i) => i.orderId))];
      for (const orderId of orderIds) {
        const orderItems = await tx.orderItem.findMany({
          where: { orderId },
          select: { status: true },
        });
        const derived = deriveOrderStatus(
          orderItems.map((i) => ({ status: i.status as unknown as OrderItemStatus }))
        );
        await tx.order.update({
          where: { id: orderId },
          data: { status: derived },
        });
      }

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'VISIT_ITEMS_SERVED',
          actorId: waiterId,
          entityName: 'Visit',
          entityId: visitId,
          newStateJson: { count: items.length },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'item.state_changed',
        payload: { visitId, count: items.length },
        scope: { restaurantId, visitId },
      });
    });

    outboxService.trigger();
    return { count: items.length };
  }

  /**
   * 9. Ofitsiant tomonidan mehmon nomidan buyurtma yaratish (Staff Order)
   */
  async createStaffOrder(
    restaurantId: string,
    waiterId: string,
    payload: CreateStaffOrderDto,
    isManager: boolean = false
  ) {
    const { visitId, orderNotes, items } = payload;

    const rest = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { isActive: true, subscriptionExpiresAt: true },
    });
    if (!rest || !rest.isActive || (rest.subscriptionExpiresAt && new Date() > rest.subscriptionExpiresAt)) {
      throw new Error('RESTAURANT_SUSPENDED: Restoran xizmati to\'xtatilgan (SUSPENDED). Yangi buyurtma kiritish taqiqlanadi.');
    }

    const visit = await prisma.visit.findFirst({
      where: { id: visitId, restaurantId },
      include: { table: true },
    });

    if (!visit || visit.status !== 'ACTIVE') {
      throw new Error('VISIT_NOT_ACTIVE: Faol tashrif mavjud emas');
    }

    // Stol yoki tashrif boshqa ofitsiantga biriktirilgan bo'lsa va chaqiruvchi menejer bo'lmasa
    if (!isManager) {
      const assignedToOther =
        (visit.table.assignedWaiterId && visit.table.assignedWaiterId !== waiterId) ||
        (visit.waiterId && visit.waiterId !== waiterId);
      if (assignedToOther) {
        throw new Error('NOT_ASSIGNED_WAITER: Ushbu stol boshqa ofitsiantga biriktirilgan');
      }
    }

    if (!items || items.length === 0) {
      throw new Error('EMPTY_ORDER: Savat bo\'sh bo\'lishi mumkin emas');
    }

    // Taomlarni bazadan o'qish (Server-Authoritative narxlar)
    const menuItemIds = items.map((i) => i.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        restaurantId,
      },
      include: {
        variants: true,
        addonGroups: {
          include: {
            options: true,
          },
        },
      },
    });

    const menuMap = new Map(dbMenuItems.map((m) => [m.id, m]));

    // Narx va snapshotlarni tekshirish
    interface PreparedStaffOrderItem {
      menuItemId: string;
      stationId: string;
      quantity: number;
      notes: string | null;
      snapshotName: string;
      snapshotPriceTiyin: bigint;
      snapshotVariantName: string | null;
      addons: { name: string; priceTiyin: bigint }[];
    }
    const preparedItems: PreparedStaffOrderItem[] = [];
    for (const item of items) {
      const dbItem = menuMap.get(item.menuItemId);
      if (!dbItem || dbItem.isArchived) {
        throw new Error(`ITEM_NOT_FOUND: Taom topilmadi (${item.menuItemId})`);
      }
      if (!dbItem.isAvailable) {
        throw new Error(`ITEM_UNAVAILABLE: Taom vaqtincha tugagan: "${dbItem.name}"`);
      }

      let variantName: string | null = null;
      let variantDiff = 0n;
      if (item.variantId) {
        const dbVariant = dbItem.variants.find((v) => v.id === item.variantId);
        if (!dbVariant || !dbVariant.isAvailable) {
          throw new Error(`VARIANT_UNAVAILABLE: Variant mavjud emas`);
        }
        variantName = dbVariant.name;
        variantDiff = dbVariant.priceDifferenceTiyin;
      }

      const finalUnitPriceTiyin = dbItem.basePriceTiyin + variantDiff;

      // Addonlar
      const addonSnapshots = [];
      if (item.addonOptionIds && item.addonOptionIds.length > 0) {
        const allOptions = dbItem.addonGroups.flatMap((g) => g.options);
        for (const optId of item.addonOptionIds) {
          const opt = allOptions.find((o) => o.id === optId);
          if (!opt || !opt.isAvailable) {
            throw new Error(`ADDON_UNAVAILABLE: Qo'shimcha mavjud emas`);
          }
          addonSnapshots.push({
            name: opt.name,
            priceTiyin: opt.priceTiyin,
          });
        }
      }

      preparedItems.push({
        menuItemId: dbItem.id,
        stationId: dbItem.stationId,
        quantity: item.quantity,
        notes: item.notes?.trim() || null,
        snapshotName: stripParentheses(dbItem.name),
        snapshotPriceTiyin: finalUnitPriceTiyin,
        snapshotVariantName: variantName ? stripParentheses(variantName) : null,
        addons: addonSnapshots,
      });
    }

    // Buyurtma raqami
    const existingOrdersCount = await prisma.order.count({
      where: { visitId, restaurantId },
    });
    const orderNumber = existingOrdersCount + 1;

    // Tranzaksiyada yaratish: xodim yaratgan buyurtma avtomatik CONFIRMED va taomlar ACCEPTED
    const createdOrder = await prisma.$transaction(async (tx) => {
      // Agar tashrif yoki stolda ofitsiant hali belgilanmagan bo'lsa, avtomatik biriktirish
      if (!visit.waiterId) {
        await tx.visit.update({
          where: { id: visitId },
          data: { waiterId },
        });
      }
      if (!visit.table.assignedWaiterId) {
        await tx.table.update({
          where: { id: visit.tableId },
          data: { assignedWaiterId: waiterId },
        });
      }

      const ord = await tx.order.create({
        data: {
          restaurantId,
          visitId,
          orderNumber,
          status: OrderStatus.CONFIRMED,
          notes: orderNotes?.trim() || null,
          createdByRole: Role.WAITER,
          createdById: waiterId,
        },
      });

      for (const pItem of preparedItems) {
        const orderItem = await tx.orderItem.create({
          data: {
            restaurantId,
            orderId: ord.id,
            menuItemId: pItem.menuItemId,
            stationId: pItem.stationId,
            status: OrderItemStatus.ACCEPTED,
            quantity: pItem.quantity,
            notes: pItem.notes,
            snapshotName: pItem.snapshotName,
            snapshotPriceTiyin: pItem.snapshotPriceTiyin,
            snapshotVariantName: pItem.snapshotVariantName,
          },
        });

        if (pItem.addons.length > 0) {
          await tx.orderItemAddonSnapshot.createMany({
            data: pItem.addons.map((a) => ({
              orderItemId: orderItem.id,
              name: a.name,
              priceTiyin: a.priceTiyin,
            })),
          });
        }
      }

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'STAFF_ORDER_CREATED',
          actorId: waiterId,
          entityName: 'Order',
          entityId: ord.id,
          newStateJson: { orderNumber, status: OrderStatus.CONFIRMED, itemsCount: preparedItems.length },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'order.created',
        payload: {
          orderId: ord.id,
          orderNumber,
          visitId,
          tableId: visit.tableId,
          tableNumber: visit.table.number,
          status: OrderStatus.CONFIRMED,
        },
        scope: {
          restaurantId,
          visitId,
          tableId: visit.tableId,
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'order.confirmed',
        payload: {
          orderId: ord.id,
          orderNumber,
          visitId,
          tableId: visit.tableId,
          status: OrderStatus.CONFIRMED,
        },
        scope: {
          restaurantId,
          visitId,
          tableId: visit.tableId,
        },
      });

      for (const pItem of preparedItems) {
        await recordOutboxEvent(tx, {
          restaurantId,
          eventType: 'item.state_changed',
          payload: {
            orderId: ord.id,
            name: pItem.snapshotName,
            status: OrderItemStatus.ACCEPTED,
            stationId: pItem.stationId,
          },
          scope: {
            restaurantId,
            visitId,
            tableId: visit.tableId,
            stationId: pItem.stationId,
          },
        });
      }

      return ord;
    });

    outboxService.trigger();
    return createdOrder;
  }

  /**
   * 10. Ofitsiant tomonidan bo'sh/biriktirilmagan stolni o'ziga biriktirish (Claim Table)
   */
  async claimTable(restaurantId: string, tableId: string, waiterId: string, isManager: boolean = false) {
    const table = await prisma.table.findFirst({
      where: { id: tableId, restaurantId },
      include: { assignedWaiter: true, visits: { where: { status: 'ACTIVE' } } },
    });

    if (!table) {
      throw new Error('TABLE_NOT_FOUND: Stol topilmadi');
    }

    if (!isManager && table.assignedWaiterId && table.assignedWaiterId !== waiterId) {
      throw new Error(
        `TABLE_ALREADY_ASSIGNED: Ushbu stol ${table.assignedWaiter?.fullName || 'boshqa ofitsiant'}ga biriktirilgan`
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.table.update({
        where: { id: tableId },
        data: { assignedWaiterId: waiterId },
        include: {
          assignedWaiter: { select: { id: true, fullName: true, phone: true } },
          hall: { select: { id: true, name: true } },
        },
      });

      // Agar stolda faol tashrif bo'lsa, uni ham ofitsiantga biriktirish
      await tx.visit.updateMany({
        where: { tableId, status: 'ACTIVE' },
        data: { waiterId },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'TABLE_WAITER_CLAIMED',
          actorId: waiterId,
          entityName: 'Table',
          entityId: tableId,
          newStateJson: { assignedWaiterId: waiterId },
        },
      });

      return up;
    });

    return updated;
  }

  /**
   * 11. Stol biriktirilishini bekor qilish / bo'shatish (Unclaim Table)
   */
  async unclaimTable(restaurantId: string, tableId: string, waiterId: string, isManager: boolean = false) {
    const table = await prisma.table.findFirst({
      where: { id: tableId, restaurantId },
      include: { visits: { where: { status: 'ACTIVE' } } },
    });

    if (!table) {
      throw new Error('TABLE_NOT_FOUND: Stol topilmadi');
    }

    if (!isManager && table.assignedWaiterId !== waiterId) {
      throw new Error('FORBIDDEN: Siz faqat o\'zingizga biriktirilgan stolni ajrata olasiz');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.table.update({
        where: { id: tableId },
        data: { assignedWaiterId: null },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'TABLE_WAITER_UNCLAIMED',
          actorId: waiterId,
          entityName: 'Table',
          entityId: tableId,
          newStateJson: { assignedWaiterId: null },
        },
      });

      return up;
    });

    return updated;
  }
}

export const waiterService = new WaiterService();
