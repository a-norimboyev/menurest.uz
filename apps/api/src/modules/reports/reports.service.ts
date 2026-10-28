import { prisma } from '../../db.js';
import { computeDetailedBill } from '@menurest/shared';
import type {
  BossDashboardMetrics,
  ManagerOperationsSummary,
  PopularDishItem,
  WaiterPerformanceItem,
  DailyBreakdownItem,
} from '@menurest/shared';

export function generateTashkentDateList(fromDateStr: string, toDateStr: string): string[] {
  const result: string[] = [];
  const [sy, sm, sd] = fromDateStr.split('-').map(Number);
  const [ey, em, ed] = toDateStr.split('-').map(Number);

  let cur = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
  const end = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));

  let count = 0;
  while (cur <= end && count < 366) {
    result.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
    count++;
  }
  return result;
}

export function getTashkentDayLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const day = parts[2];
  const monthNum = parseInt(parts[1], 10);
  const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
  const monthName = months[monthNum - 1] || parts[1];
  return `${day}-${monthName}`;
}

/**
 * Asia/Tashkent (UTC+5) sanasining UTC boshlanishi va tugashini hisoblash
 * Tashkentda yil davomida UTC+5 qat'iy o'zgarmas ofset ishlatiladi.
 */
export function getTashkentDayBounds(dateStr?: string): { fromUtc: Date; toUtc: Date; dateStr: string } {
  const now = new Date();
  let targetStr = dateStr;
  if (!targetStr) {
    const tashkentTime = new Date(now.getTime() + 5 * 3600 * 1000);
    targetStr = tashkentTime.toISOString().slice(0, 10);
  } else if (targetStr.length > 10) {
    targetStr = targetStr.slice(0, 10);
  }

  const [yearStr, monthStr, dayStr] = targetStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  // Tashkent 00:00:00.000 = UTC - 5 soat
  const fromUtc = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - 5 * 3600 * 1000);
  // Tashkent 23:59:59.999 = UTC - 5 soat
  const toUtc = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - 5 * 3600 * 1000);

  return { fromUtc, toUtc, dateStr: targetStr };
}

export function getTashkentRangeBounds(
  fromStr?: string,
  toStr?: string
): { fromUtc: Date; toUtc: Date; fromDateStr: string; toDateStr: string } {
  const fromBounds = getTashkentDayBounds(fromStr);
  const toBounds = getTashkentDayBounds(toStr || fromStr);
  return {
    fromUtc: fromBounds.fromUtc,
    toUtc: toBounds.toUtc,
    fromDateStr: fromBounds.dateStr,
    toDateStr: toBounds.dateStr,
  };
}

export class ReportsService {
  private async resolveRestaurantId(idOrSlug: string): Promise<string> {
    const rest = await prisma.restaurant.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true },
    });
    return rest?.id || idOrSlug;
  }

  /**
   * 1. Boss Dashboard Asosiy Ko'rsatkichlari (Haqiqiy server aggregatsiyasi)
   * Diqqat: Xarajat/tannarx moduli yo'qligi sababli "sof foyda" raqami aslo yasalmaydi!
   */
  async getBossDashboardMetrics(restaurantIdInput: string, dateStr?: string): Promise<BossDashboardMetrics> {
    const restaurantId = await this.resolveRestaurantId(restaurantIdInput);
    const { fromUtc, toUtc, dateStr: canonicalDate } = getTashkentDayBounds(dateStr);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { currency: true, serviceChargeBps: true },
    });
    const currency = restaurant?.currency || 'UZS';

    // 1.1 Bugun berilgan buyurtmalar qiymati (Order created_at bo'yicha)
    const todayOrders = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: fromUtc, lte: toUtc },
      },
      include: {
        items: {
          include: { addonSnapshots: true },
        },
      },
    });

    let todayOrdersTotalTiyin = 0n;
    for (const order of todayOrders) {
      for (const item of order.items) {
        if (item.status !== 'CANCELLED') {
          const itemPrice = BigInt(item.snapshotPriceTiyin);
          const addonsTotal = (item.addonSnapshots || []).reduce(
            (acc: bigint, a: { priceTiyin: bigint }) => acc + BigInt(a.priceTiyin),
            0n
          );
          todayOrdersTotalTiyin += (itemPrice + addonsTotal) * BigInt(item.quantity);
        }
      }
    }

    // 1.2 Bugungi chegirmalar (BillAdjustment created_at bo'yicha)
    const todayDiscounts = await prisma.billAdjustment.findMany({
      where: {
        restaurantId,
        type: 'DISCOUNT',
        createdAt: { gte: fromUtc, lte: toUtc },
      },
    });
    const todayDiscountsTiyin = todayDiscounts.reduce(
      (acc: bigint, d: { amountTiyin: bigint }) => acc + BigInt(d.amountTiyin),
      0n
    );

    // 1.3 Bugungi qabul qilingan to'lovlar (Faqat COMPLETED, payment created_at bo'yicha)
    const todayPayments = await prisma.payment.findMany({
      where: {
        restaurantId,
        status: 'COMPLETED',
        createdAt: { gte: fromUtc, lte: toUtc },
      },
    });
    const todayPaymentsTiyin = todayPayments.reduce(
      (acc: bigint, p: { amountTiyin: bigint }) => acc + BigInt(p.amountTiyin),
      0n
    );

    // 1.4 Bugungi qaytarilgan summalar (refund created_at bo'yicha)
    const todayRefunds = await prisma.refund.findMany({
      where: {
        restaurantId,
        createdAt: { gte: fromUtc, lte: toUtc },
      },
    });
    const todayRefundsTiyin = todayRefunds.reduce(
      (acc: bigint, r: { amountTiyin: bigint }) => acc + BigInt(r.amountTiyin),
      0n
    );

    // 1.5 Bugungi xizmat haqi (bugungi faol buyurtmalardan hisoblangan servis)
    const discountedFoodTiyin = todayOrdersTotalTiyin > todayDiscountsTiyin
      ? todayOrdersTotalTiyin - todayDiscountsTiyin
      : 0n;
    const defaultServiceChargeBps = restaurant?.serviceChargeBps || 1000;
    const todayServiceFeeTiyin = (discountedFoodTiyin * BigInt(defaultServiceChargeBps)) / 10000n;

    // 1.6 Hozirgi ochiq tashriflar bo'yicha qarzdorlik va qaytarish qoldig'i
    const activeVisits = await prisma.visit.findMany({
      where: {
        restaurantId,
        status: 'ACTIVE',
      },
      include: {
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

    let openDebtTiyin = 0n;
    let refundDueTiyin = 0n;

    for (const v of activeVisits) {
      const bill = this.computeVisitBillFromData(v, restaurant?.serviceChargeBps || 1000);
      if (bill.balanceTiyin > 0n) {
        openDebtTiyin += bill.balanceTiyin;
      } else if (bill.balanceTiyin < 0n) {
        refundDueTiyin += -bill.balanceTiyin;
      }
    }

    // 1.7 Band stollar soni
    const activeTablesCount = await prisma.table.count({
      where: {
        restaurantId,
        status: 'OCCUPIED',
      },
    });

    const todayNetRevenueTiyin = todayPaymentsTiyin > todayRefundsTiyin
      ? todayPaymentsTiyin - todayRefundsTiyin
      : 0n;

    return {
      restaurantId,
      currency,
      date: canonicalDate,
      todayOrdersTotalTiyin,
      todayDiscountsTiyin,
      todayServiceFeeTiyin,
      todayServiceChargeTiyin: todayServiceFeeTiyin,
      todayPaymentsTiyin,
      todayGrossPaymentsTiyin: todayPaymentsTiyin,
      todayRefundsTiyin,
      todayNetRevenueTiyin,
      openDebtTiyin,
      refundDueTiyin,
      activeVisitsCount: activeVisits.length,
      activeTablesCount,
    };
  }

  /**
   * 2. Manager Operatsion Ko'rsatkichlari (Zal, stollar, kechikishlar, calls)
   */
  async getManagerOperationsSummary(restaurantIdInput: string): Promise<ManagerOperationsSummary> {
    const restaurantId = await this.resolveRestaurantId(restaurantIdInput);
    const { fromUtc, toUtc } = getTashkentDayBounds();

    // 2.1 Stollar holati
    const tables = await prisma.table.findMany({
      where: { restaurantId },
      select: { status: true },
    });
    const totalTables = tables.length;
    const freeTables = tables.filter((t) => t.status === 'FREE').length;
    const occupiedTables = tables.filter((t) => t.status === 'OCCUPIED').length;
    const dirtyTables = tables.filter((t) => t.status === 'DIRTY').length;
    const occupancyRate = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0;

    // 2.2 Bugungi buyurtmalar va kechikishlar
    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: fromUtc, lte: toUtc },
      },
      include: {
        items: true,
      },
    });

    const now = Date.now();
    const delayThresholdMs = 20 * 60 * 1000; // 20 daqiqadan oshgan taomlar kechikkan

    let newCount = 0;
    let confirmedCount = 0;
    let preparingCount = 0;
    let readyCount = 0;
    let delayedCount = 0;
    let activeOrdersCount = 0;

    for (const order of orders) {
      if (order.status !== 'SERVED' && order.status !== 'CANCELLED') {
        activeOrdersCount++;
        if (order.status === 'NEW') newCount++;
        if (order.status === 'CONFIRMED') confirmedCount++;
        if (order.status === 'PREPARING') preparingCount++;
        if (order.status === 'READY' || order.status === 'PARTIALLY_READY') readyCount++;

        // Kechikishni tekshirish
        const elapsed = now - new Date(order.createdAt).getTime();
        if (elapsed > delayThresholdMs && (order.status === 'CONFIRMED' || order.status === 'PREPARING')) {
          delayedCount++;
        }
      }
    }

    // 2.3 Javobsiz chaqiruvlar (PENDING service calls)
    const unansweredCallsCount = await prisma.serviceCall.count({
      where: {
        restaurantId,
        status: 'PENDING',
      },
    });

    // 2.4 Bekor qilish tasdig'i kutilayotgan taomlar
    const pendingCancellationsCount = await prisma.orderItem.count({
      where: {
        restaurantId,
        status: 'PREPARING',
        cancellationReason: { not: null },
      },
    });

    return {
      restaurantId,
      tables: {
        total: totalTables,
        free: freeTables,
        occupied: occupiedTables,
        dirty: dirtyTables,
        occupancyRate,
      },
      orders: {
        totalToday: orders.length,
        activeCount: activeOrdersCount,
        newCount,
        confirmedCount,
        preparingCount,
        readyCount,
        delayedCount,
      },
      unansweredCallsCount,
      pendingCancellationsCount,
    };
  }

  /**
   * 3. Davr Bo'yicha Kengaytirilgan Hisobotlar (Orders, Payments, Refunds, Shifts, Dishes, Waiters)
   */
  async getDetailedReports(restaurantIdInput: string, filter?: { from?: string; to?: string }) {
    const restaurantId = await this.resolveRestaurantId(restaurantIdInput);
    const { fromUtc, toUtc, fromDateStr, toDateStr } = getTashkentRangeBounds(filter?.from, filter?.to);

    // 3.1 To'lovlar va Qaytarishlar hisoboti
    const payments = await prisma.payment.findMany({
      where: {
        restaurantId,
        createdAt: { gte: fromUtc, lte: toUtc },
      },
      include: { refunds: true },
    });

    let cashPaymentsTiyin = 0n;
    let terminalPaymentsTiyin = 0n;
    let cashReversalsTiyin = 0n;
    let terminalReversalsTiyin = 0n;

    for (const p of payments) {
      if (p.status === 'COMPLETED') {
        if (p.method === 'CASH') cashPaymentsTiyin += BigInt(p.amountTiyin);
        if (p.method === 'TERMINAL') terminalPaymentsTiyin += BigInt(p.amountTiyin);
      } else if (p.status === 'REVERSED') {
        if (p.method === 'CASH') cashReversalsTiyin += BigInt(p.amountTiyin);
        if (p.method === 'TERMINAL') terminalReversalsTiyin += BigInt(p.amountTiyin);
      }
    }

    const refunds = await prisma.refund.findMany({
      where: {
        restaurantId,
        createdAt: { gte: fromUtc, lte: toUtc },
      },
    });
    const totalRefundsTiyin = refunds.reduce(
      (acc: bigint, r: { amountTiyin: bigint }) => acc + BigInt(r.amountTiyin),
      0n
    );

    const grossPaymentsTiyin = cashPaymentsTiyin + terminalPaymentsTiyin;
    const netReceiptsTiyin = grossPaymentsTiyin - totalRefundsTiyin;

    // 3.2 Buyurtmalar hisoboti
    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: fromUtc, lte: toUtc },
      },
      include: {
        items: {
          include: { addonSnapshots: true, menuItem: { include: { category: true } } },
        },
      },
    });

    const ordersByStatus: Record<string, number> = {};
    let totalOrderValueTiyin = 0n;
    const dishSalesMap = new Map<string, { name: string; categoryName: string; quantity: number; revenueTiyin: bigint }>();

    for (const order of orders) {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
      for (const item of order.items) {
        if (item.status !== 'CANCELLED') {
          const itemPrice = BigInt(item.snapshotPriceTiyin);
          const addonsTotal = (item.addonSnapshots || []).reduce(
            (acc: bigint, a: { priceTiyin: bigint }) => acc + BigInt(a.priceTiyin),
            0n
          );
          const lineTotal = (itemPrice + addonsTotal) * BigInt(item.quantity);
          totalOrderValueTiyin += lineTotal;

          const existing = dishSalesMap.get(item.menuItemId) || {
            name: item.snapshotName,
            categoryName: item.menuItem?.category?.name || 'Boshqa',
            quantity: 0,
            revenueTiyin: 0n,
          };
          existing.quantity += item.quantity;
          existing.revenueTiyin += lineTotal;
          dishSalesMap.set(item.menuItemId, existing);
        }
      }
    }

    // Mashhur taomlar saralash (barcha sotilgan taomlar to'liq qaytariladi, TOP 10 bilan cheklanmaydi)
    const popularDishes: PopularDishItem[] = Array.from(dishSalesMap.entries())
      .map(([menuItemId, data]) => ({
        menuItemId,
        name: data.name,
        categoryName: data.categoryName,
        totalQuantity: data.quantity,
        totalRevenueTiyin: data.revenueTiyin,
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    // 3.3 Smenalar hisoboti
    const shifts = await prisma.shift.findMany({
      where: {
        restaurantId,
        openedAt: { gte: fromUtc, lte: toUtc },
      },
      include: {
        user: { select: { fullName: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    // 3.4 Ofitsiantlar ko'rsatkichi (Waiter performance)
    // Restorandagi BARCHA ofitsiantlarni olish (ro'yxatda barcha ofitsiantlar to'liq ko'rinishi uchun)
    const waiterMemberships = await prisma.restaurantMembership.findMany({
      where: {
        restaurantId,
        roles: {
          some: {
            role: 'WAITER',
          },
        },
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
      },
    });

    const waiterMap = new Map<string, {
      waiterId: string;
      waiterName: string;
      phone?: string;
      servedOrdersCount: number;
      totalValueTiyin: bigint;
      resolvedCallsCount: number;
    }>();

    // Avval restorandagi barcha ofitsiantlarni 0 qiymati bilan xaritaga kiritamiz
    for (const m of waiterMemberships) {
      if (m.user) {
        waiterMap.set(m.user.id, {
          waiterId: m.user.id,
          waiterName: m.user.fullName,
          phone: m.user.phone,
          servedOrdersCount: 0,
          totalValueTiyin: 0n,
          resolvedCallsCount: 0,
        });
      }
    }

    const visits = await prisma.visit.findMany({
      where: {
        restaurantId,
        openedAt: { gte: fromUtc, lte: toUtc },
      },
      include: {
        waiter: { select: { id: true, fullName: true, phone: true } },
        orders: {
          include: {
            items: { include: { addonSnapshots: true } },
          },
        },
        serviceCalls: {
          where: { status: 'RESOLVED' },
        },
      },
    });

    for (const v of visits) {
      if (v.waiter) {
        const wId = v.waiter.id;
        let existing = waiterMap.get(wId);
        if (!existing) {
          existing = {
            waiterId: wId,
            waiterName: v.waiter.fullName,
            phone: v.waiter.phone,
            servedOrdersCount: 0,
            totalValueTiyin: 0n,
            resolvedCallsCount: 0,
          };
          waiterMap.set(wId, existing);
        }

        existing.resolvedCallsCount += v.serviceCalls.length;

        for (const order of v.orders) {
          if (order.status !== 'CANCELLED') {
            let hasServed = false;
            for (const item of order.items) {
              if (item.status === 'SERVED' || v.status === 'CLOSED' || order.status === 'SERVED') {
                hasServed = true;
                const itemPrice = BigInt(item.snapshotPriceTiyin);
                const addonsTotal = (item.addonSnapshots || []).reduce(
                  (acc: bigint, a: { priceTiyin: bigint }) => acc + BigInt(a.priceTiyin),
                  0n
                );
                existing.totalValueTiyin += (itemPrice + addonsTotal) * BigInt(item.quantity);
              }
            }
            if (hasServed || order.status === 'SERVED' || v.status === 'CLOSED') {
              existing.servedOrdersCount++;
            }
          }
        }
      }
    }

    const waiterPerformance: WaiterPerformanceItem[] = Array.from(waiterMap.entries())
      .map(([waiterId, d]) => ({
        waiterId,
        waiterName: d.waiterName,
        phone: d.phone,
        servedOrdersCount: d.servedOrdersCount,
        totalOrderValueTiyin: d.totalValueTiyin,
        resolvedCallsCount: d.resolvedCallsCount,
      }))
      .sort((a, b) => {
        if (b.servedOrdersCount !== a.servedOrdersCount) {
          return b.servedOrdersCount - a.servedOrdersCount;
        }
        if (b.totalOrderValueTiyin !== a.totalOrderValueTiyin) {
          return b.totalOrderValueTiyin > a.totalOrderValueTiyin ? 1 : -1;
        }
        return a.waiterName.localeCompare(b.waiterName);
      });

    // 3.5 Kunlik trend (Daily Breakdown)
    const dateList = generateTashkentDateList(fromDateStr, toDateStr);
    const dailyMap = new Map<string, DailyBreakdownItem>();

    for (const dStr of dateList) {
      dailyMap.set(dStr, {
        date: dStr,
        dayLabel: getTashkentDayLabel(dStr),
        netReceiptsTiyin: 0n,
        cashTiyin: 0n,
        terminalTiyin: 0n,
        ordersCount: 0,
        orderTotalTiyin: 0n,
      });
    }

    for (const p of payments) {
      const pDay = new Date(p.createdAt.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
      let entry = dailyMap.get(pDay);
      if (!entry) {
        entry = {
          date: pDay,
          dayLabel: getTashkentDayLabel(pDay),
          netReceiptsTiyin: 0n,
          cashTiyin: 0n,
          terminalTiyin: 0n,
          ordersCount: 0,
          orderTotalTiyin: 0n,
        };
        dailyMap.set(pDay, entry);
      }
      if (p.status === 'COMPLETED') {
        const amt = BigInt(p.amountTiyin);
        entry.netReceiptsTiyin += amt;
        if (p.method === 'CASH') entry.cashTiyin += amt;
        if (p.method === 'TERMINAL') entry.terminalTiyin += amt;
      }
    }

    for (const r of refunds) {
      const rDay = new Date(r.createdAt.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
      const entry = dailyMap.get(rDay);
      if (entry) {
        entry.netReceiptsTiyin -= BigInt(r.amountTiyin);
      }
    }

    for (const order of orders) {
      const oDay = new Date(order.createdAt.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
      let entry = dailyMap.get(oDay);
      if (!entry) {
        entry = {
          date: oDay,
          dayLabel: getTashkentDayLabel(oDay),
          netReceiptsTiyin: 0n,
          cashTiyin: 0n,
          terminalTiyin: 0n,
          ordersCount: 0,
          orderTotalTiyin: 0n,
        };
        dailyMap.set(oDay, entry);
      }
      entry.ordersCount += 1;
      let oTotal = 0n;
      for (const item of order.items) {
        if (item.status !== 'CANCELLED') {
          const itemPrice = BigInt(item.snapshotPriceTiyin);
          const addonsTotal = (item.addonSnapshots || []).reduce(
            (acc: bigint, a: { priceTiyin: bigint }) => acc + BigInt(a.priceTiyin),
            0n
          );
          oTotal += (itemPrice + addonsTotal) * BigInt(item.quantity);
        }
      }
      entry.orderTotalTiyin += oTotal;
    }

    const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      restaurantId,
      dateRange: { from: fromDateStr, to: toDateStr },
      paymentsSummary: {
        grossPaymentsTiyin,
        cashPaymentsTiyin,
        terminalPaymentsTiyin,
        cashReversalsTiyin,
        terminalReversalsTiyin,
        refundsTiyin: totalRefundsTiyin,
        netReceiptsTiyin,
      },
      ordersSummary: {
        totalOrdersCount: orders.length,
        totalOrderValueTiyin,
        byStatus: ordersByStatus,
      },
      popularDishes,
      shiftsSummary: shifts.map((s) => ({
        id: s.id,
        cashierName: s.user.fullName,
        status: s.status,
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt?.toISOString() || null,
        startingCashTiyin: s.startingCashTiyin,
        countedCashTiyin: s.countedCashTiyin,
        differenceTiyin: s.differenceTiyin,
        expectedCashTiyin: s.expectedCashTiyin,
      })),
      waiterPerformance,
      dailyBreakdown,
    };
  }

  /**
   * Yordamchi metod: Visit ob'ektidan butun sonli bill hisoblash
   */
  private computeVisitBillFromData(visit: any, defaultServiceChargeBps: number) {
    const rawItems: any[] = [];
    for (const order of visit.orders || []) {
      for (const item of order.items || []) {
        rawItems.push({
          status: item.status,
          snapshotPriceTiyin: BigInt(item.snapshotPriceTiyin),
          quantity: item.quantity,
          addonSnapshots: (item.addonSnapshots || []).map((a: any) => ({
            priceTiyin: BigInt(a.priceTiyin),
          })),
        });
      }
    }

    const rawAdjustments: any[] = (visit.adjustments || []).map((a: any) => ({
      type: a.type,
      amountTiyin: BigInt(a.amountTiyin),
      percentageBps: a.percentageBps,
    }));

    const rawPayments: any[] = (visit.payments || []).map((p: any) => ({
      method: p.method,
      amountTiyin: BigInt(p.amountTiyin),
      status: p.status,
      refunds: (p.refunds || []).map((r: any) => ({
        amountTiyin: BigInt(r.amountTiyin),
      })),
    }));

    const serviceChargeBps = visit.serviceChargeBpsSnapshot ?? defaultServiceChargeBps;
    return computeDetailedBill(rawItems, serviceChargeBps, rawAdjustments, rawPayments);
  }
}

export const reportsService = new ReportsService();
