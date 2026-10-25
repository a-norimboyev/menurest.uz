/**
 * MENUREST.UZ Umumiy Turlar va Konstantalar
 */

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  BOSS = 'BOSS',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
  WAITER = 'WAITER',
  KITCHEN = 'KITCHEN',
}

export enum TableStatus {
  FREE = 'FREE',
  OCCUPIED = 'OCCUPIED',
  DIRTY = 'DIRTY',
}

export enum VisitStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum OrderItemStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  CANCELLED = 'CANCELLED',
}

export enum OrderStatus {
  NEW = 'NEW',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  PARTIALLY_READY = 'PARTIALLY_READY',
  READY = 'READY',
  PARTIALLY_SERVED = 'PARTIALLY_SERVED',
  SERVED = 'SERVED',
  CANCELLED = 'CANCELLED',
}

export enum ServiceCallType {
  WAITER = 'WAITER',
  BILL = 'BILL',
  WATER = 'WATER',
  CUSTOM = 'CUSTOM',
}

export enum ServiceCallStatus {
  PENDING = 'PENDING',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  CANCELLED = 'CANCELLED',
}

export const ServiceCallStatusAlias = {
  OPEN: ServiceCallStatus.PENDING,
  CLAIMED: ServiceCallStatus.ACKNOWLEDGED,
  RESOLVED: ServiceCallStatus.RESOLVED,
  CANCELLED: ServiceCallStatus.CANCELLED,
} as const;

export enum PaymentMethod {
  CASH = 'CASH',
  TERMINAL = 'TERMINAL',
}

export enum PaymentStatus {
  COMPLETED = 'COMPLETED',
  REVERSED = 'REVERSED',
}

export enum ShiftStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum CashMovementType {
  CASH_IN = 'CASH_IN',
  CASH_OUT = 'CASH_OUT',
}

export enum AdjustmentType {
  DISCOUNT = 'DISCOUNT',
  SURCHARGE = 'SURCHARGE',
  CORRECTION = 'CORRECTION',
}

export enum StationType {
  KITCHEN = 'KITCHEN',
  BAR = 'BAR',
  GRILL = 'GRILL',
  COLD_DISH = 'COLD_DISH',
  PASTRY = 'PASTRY',
}

/**
 * Taomlar holatidan buyurtma umumiy holatini hisoblash qoidasi
 */
export function deriveOrderStatus(items: { status: OrderItemStatus }[]): OrderStatus {
  if (!items || items.length === 0) return OrderStatus.NEW;

  const nonCancelled = items.filter((i) => i.status !== OrderItemStatus.CANCELLED);
  if (nonCancelled.length === 0) {
    return OrderStatus.CANCELLED;
  }

  const allServed = nonCancelled.every((i) => i.status === OrderItemStatus.SERVED);
  if (allServed) return OrderStatus.SERVED;

  const hasServed = nonCancelled.some((i) => i.status === OrderItemStatus.SERVED);
  if (hasServed) return OrderStatus.PARTIALLY_SERVED;

  const allReady = nonCancelled.every((i) => i.status === OrderItemStatus.READY);
  if (allReady) return OrderStatus.READY;

  const hasReady = nonCancelled.some((i) => i.status === OrderItemStatus.READY);
  if (hasReady) return OrderStatus.PARTIALLY_READY;

  const hasPreparing = nonCancelled.some((i) => i.status === OrderItemStatus.PREPARING);
  if (hasPreparing) return OrderStatus.PREPARING;

  const hasAccepted = nonCancelled.some((i) => i.status === OrderItemStatus.ACCEPTED);
  if (hasAccepted) return OrderStatus.CONFIRMED;

  return OrderStatus.NEW;
}

/**
 * Yagona API Javob Zarfı
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
    pagination?: PaginationMeta;
  };
}

export interface ApiErrorDetail {
  field?: string;
  issue: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Realtime (SSE) Event Turlari va Ma'lumotlar Tuzilmasi
 */
export type RealtimeEventType =
  | 'order.created'
  | 'order.confirmed'
  | 'item.state_changed'
  | 'call.created'
  | 'call.claimed'
  | 'call.resolved'
  | 'payment.recorded'
  | 'refund.recorded'
  | 'bill.updated'
  | 'visit.closed'
  | 'table.state_changed'
  | 'menu.updated'
  | 'access.revoked';

export interface RealtimeScope {
  restaurantId?: string;
  visitId?: string;
  tableId?: string;
  stationId?: string;
  targetUserId?: string;
  isFinancial?: boolean;
  requiredPermission?: string;
}

export interface RealtimeEvent<T = any> {
  id: string; // OutboxEvent.id (deterministic cursor / sequence)
  type: RealtimeEventType;
  restaurantId: string;
  createdAt: string;
  data: T;
  scope?: RealtimeScope;
}

export interface DetailedBillSummary {
  subtotalTiyin: bigint;
  discountTiyin: bigint;
  discountedSubtotalTiyin: bigint;
  serviceChargeBps: number;
  serviceChargeTiyin: bigint;
  adjustmentsTiyin: bigint;
  totalDueTiyin: bigint;
  grossPaidTiyin: bigint;
  reversedPaidTiyin: bigint;
  refundedTiyin: bigint;
  netPaidTiyin: bigint;
  balanceTiyin: bigint;
  isRefundDue: boolean;
  isFullyPaid: boolean;
}

export interface ShiftSummary {
  id: string;
  restaurantId: string;
  userId: string;
  cashierName?: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt?: string | null;
  startingCashTiyin: bigint;
  closingCashTiyin?: bigint | null;
  countedCashTiyin?: bigint | null;
  differenceTiyin?: bigint | null;
  expectedCashTiyin: bigint;
  terminalTotalTiyin: bigint;
  cashReceiptsTiyin: bigint;
  terminalReceiptsTiyin: bigint;
  cashRefundsTiyin: bigint;
  terminalRefundsTiyin: bigint;
  cashReversalsTiyin: bigint;
  terminalReversalsTiyin: bigint;
  cashInTiyin: bigint;
  cashOutTiyin: bigint;
  notes?: string | null;
}

export interface BossDashboardMetrics {
  restaurantId: string;
  currency: string;
  date: string; // YYYY-MM-DD (Asia/Tashkent)
  todayOrdersTotalTiyin: bigint; // Bugungi buyurtmalar qiymati (gross orders value)
  todayDiscountsTiyin: bigint;   // Yozilgan chegirmalar
  todayServiceFeeTiyin: bigint;  // Yozilgan xizmat haqi
  todayServiceChargeTiyin?: bigint; // Yozilgan xizmat haqi (alias)
  todayPaymentsTiyin: bigint;    // Qabul qilingan to'lov (COMPLETED)
  todayGrossPaymentsTiyin?: bigint; // Qabul qilingan to'lov (alias)
  todayRefundsTiyin: bigint;     // Qaytarish (Refunds)
  todayNetRevenueTiyin?: bigint; // Sof tushum (Payments - Refunds)
  openDebtTiyin: bigint;         // Ochiq qarzdorlik (faol tashriflar balance > 0)
  refundDueTiyin: bigint;        // Qaytarish kerak bo'lgan qoldiq (faol tashriflar isRefundDue)
  activeVisitsCount: number;     // Faol tashriflar
  activeTablesCount: number;     // Band stollar
}

export interface ManagerOperationsSummary {
  restaurantId: string;
  tables: {
    total: number;
    free: number;
    occupied: number;
    dirty: number;
    occupancyRate: number; // 0 - 100%
  };
  orders: {
    totalToday: number;
    activeCount: number;
    newCount: number;
    confirmedCount: number;
    preparingCount: number;
    readyCount: number;
    delayedCount: number; // > 20 min kutish
  };
  unansweredCallsCount: number; // PENDING calls
  pendingCancellationsCount: number; // Oshxonada bekor qilish tasdig'i kutilayotgan taomlar
}

export interface RestaurantSettings {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  extraPhones?: string[];
  telegram?: string | null;
  instagram?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  openingHours?: Record<string, { open: string; close: string; isOpen: boolean }> | null;
  defaultLanguage: string;
  serviceChargeBps: number;
  currency: string;
  timezone: string;
  allowedRoles?: string[];
}

export interface AuditLogDto {
  id: string;
  restaurantId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  entityName: string;
  entityId?: string | null;
  oldStateJson?: any;
  newStateJson?: any;
  reason?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface ReportDateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface PopularDishItem {
  menuItemId: string;
  name: string;
  categoryName?: string;
  totalQuantity: number;
  totalRevenueTiyin: bigint;
}

export interface WaiterPerformanceItem {
  waiterId: string;
  waiterName: string;
  servedOrdersCount: number;
  totalOrderValueTiyin: bigint;
  resolvedCallsCount: number;
}

export interface PlatformRestaurantItemDto {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  extraPhones?: string[];
  telegram?: string | null;
  instagram?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  subscriptionPlan: string;
  subscriptionExpiresAt?: string | null;
  allowedRoles?: string[];
  status: 'ACTIVE' | 'SUSPENDED';
  suspendedReason?: string | null;
  suspendedAt?: string | null;
  hallsCount: number;
  tablesCount: number;
  staffCount: number;
  activeVisitsCount: number;
  owner?: {
    id: string;
    fullName: string;
    phone: string;
    plainPassword?: string | null;
  } | null;
  createdAt: string;
}

export interface PlatformOverviewDto {
  totalRestaurants: number;
  activeRestaurants: number;
  suspendedRestaurants: number;
  totalUsers: number;
  totalTables: number;
  todayOrdersCount: number;
  activeTablesCount?: number;
  totalMenuItems?: number;
  topRestaurantToday?: { name: string; ordersCount: number } | null;
  systemHealth: {
    status: 'HEALTHY' | 'DEGRADED';
    dbConnected: boolean;
    dbLatencyMs: number;
    uptimeSeconds: number;
    memoryUsageMb: number;
  };
}

export interface CreateRestaurantDto {
  name: string;
  slug: string;
  phone?: string;
  extraPhones?: string[];
  telegram?: string | null;
  instagram?: string | null;
  address?: string;
  currency?: string;
  serviceChargeBps?: number;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: string | null;
  allowedRoles?: string[];
  ownerUserId?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerPassword?: string;
  initialTablesCount?: number;
}

export interface SupportAccessDto {
  id: string;
  restaurantId: string;
  restaurantName: string;
  superAdminUserId: string;
  superAdminName: string;
  reason: string;
  isReadOnly: boolean;
  expiresAt: string;
  token?: string;
  createdAt: string;
}

