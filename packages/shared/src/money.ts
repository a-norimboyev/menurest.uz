/**
 * MENUREST.UZ Yagona Pul va Moliyaviy Hisob-kitob Qoidalari
 * 
 * Baza va xotiradagi barcha hisob-kitoblar qat'iy Integer Minor Unit (1 UZS = 100 tiyin)
 * da saqlanadi. Hech qanday suzuvchi nuqta (floating point) pul hisobiga aralashtirilmaydi.
 * Foizlar Basis Point (100 bps = 1.00%, 1000 bps = 10.00%) da ifodalanadi.
 */

import { OrderItemStatus, DetailedBillSummary } from './types.js';

export const TIYIN_PER_UZS = 100n;
export const BPS_DIVISOR = 10000n; // 100% = 10 000 bps

/**
 * UZS so'm qiymatini tiyinga o'tkazadi
 * @param uzs Masalan: 45000 -> 4500000n tiyin
 */
export function uzsToTiyin(uzs: number | string): bigint {
  if (typeof uzs === 'string') {
    const cleaned = uzs.replace(/\s+/g, '').replace(/,/g, '.');
    const parts = cleaned.split('.');
    const whole = BigInt(parts[0] || '0');
    const fracStr = (parts[1] || '').padEnd(2, '0').slice(0, 2);
    const frac = BigInt(fracStr);
    return whole * TIYIN_PER_UZS + frac;
  }
  return BigInt(Math.round(uzs)) * TIYIN_PER_UZS;
}

/**
 * Tiyinni so'mga (butun) o'tkazadi
 */
export function tiyinToUzs(tiyin: bigint): number {
  return Number(tiyin / TIYIN_PER_UZS);
}

/**
 * Foizli summani hisoblash (Basis points bo'yicha)
 * Masalan: 100 000 UZS (10 000 000 tiyin) * 1000 bps (10%) = 10 000 UZS (1 000 000 tiyin)
 */
export function calculatePercentTiyin(baseTiyin: bigint, bps: number): bigint {
  if (bps <= 0) return 0n;
  const bigBps = BigInt(bps);
  // Aniq yaxlitlash: (base * bps + 5000) / 10000
  return (baseTiyin * bigBps + 5000n) / BPS_DIVISOR;
}

/**
 * UI uchun standart formatlash: "45 000 UZS"
 */
export function formatMoneyUzs(tiyin: bigint | number | string): string {
  const value = typeof tiyin === 'bigint' ? tiyin : BigInt(tiyin);
  const uzs = value / TIYIN_PER_UZS;
  const remainder = value % TIYIN_PER_UZS;
  
  const formattedWhole = uzs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (remainder === 0n) {
    return `${formattedWhole} UZS`;
  }
  const fracStr = remainder.toString().padStart(2, '0');
  return `${formattedWhole}.${fracStr} UZS`;
}

/**
 * API DTO lari uchun string formatga o'tkazish: "45000.00"
 */
export function tiyinToDecimalString(tiyin: bigint | number): string {
  const value = typeof tiyin === 'bigint' ? tiyin : BigInt(tiyin);
  const whole = value / TIYIN_PER_UZS;
  const frac = value % TIYIN_PER_UZS;
  return `${whole.toString()}.${frac.toString().padStart(2, '0')}`;
}

/**
 * Jami hisob-kitob formulasi
 */
export interface BillSummary {
  subtotalTiyin: bigint;
  serviceChargeBps: number;
  serviceChargeTiyin: bigint;
  discountBps: number;
  discountTiyin: bigint;
  totalTiyin: bigint;
  paidTiyin: bigint;
  balanceTiyin: bigint;
}

export function computeBillSummary(
  subtotalTiyin: bigint,
  serviceChargeBps: number,
  discountBps: number,
  paidTiyin: bigint
): BillSummary {
  const serviceChargeTiyin = calculatePercentTiyin(subtotalTiyin, serviceChargeBps);
  const discountTiyin = calculatePercentTiyin(subtotalTiyin, discountBps);
  const totalTiyin = subtotalTiyin + serviceChargeTiyin - discountTiyin;
  const balanceTiyin = totalTiyin > paidTiyin ? totalTiyin - paidTiyin : 0n;

  return {
    subtotalTiyin,
    serviceChargeBps,
    serviceChargeTiyin,
    discountBps,
    discountTiyin,
    totalTiyin,
    paidTiyin,
    balanceTiyin,
  };
}

/**
 * BigInt qiymatlarni JSON serializatsiyasi uchun xavfsiz stringga aylantirish
 */
export function serializeBigInt<T>(obj: T): any {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
  );
}

export interface BillItemCalcInput {
  status: OrderItemStatus | string;
  snapshotPriceTiyin: bigint | string | number;
  quantity: number;
  addonSnapshots?: { priceTiyin: bigint | string | number }[];
}

export interface BillAdjustmentCalcInput {
  type: 'DISCOUNT' | 'SURCHARGE' | 'CORRECTION' | string;
  amountTiyin: bigint | string | number;
  percentageBps?: number | null;
}

export interface BillPaymentCalcInput {
  method: 'CASH' | 'TERMINAL' | string;
  amountTiyin: bigint | string | number;
  status: 'COMPLETED' | 'REVERSED' | string;
  refunds?: { amountTiyin: bigint | string | number }[];
}

/**
 * Prompt 11 Yagona Hisob-Kitob Qoidasi:
 * 1. Barcha PENDING/ACCEPTED/PREPARING/READY/SERVED, ammo CANCELLED bo'lmagan itemlarning snapshot summasi + addonlar = subtotal.
 * 2. Faqat food subtotalga tegishli flat/percent chegirma; chegirma subtotaldan oshmaydi.
 * 3. So'ng xizmat haqi chegirmadan keyingi food subtotaldan hisoblanadi:
 *    serviceFee = calculatePercentTiyin(subtotal - discount, serviceChargeBps).
 * 4. totalDue = subtotal - discount + serviceFee + signed adjustment.
 * 5. netPaid = posted payments - payment reversals - refunds.
 * 6. balance = totalDue - netPaid.
 * 7. Yaxlitlash siyosati: Minor unit tiyinga round-half-up (base * bps + 5000) / 10000.
 * 8. Ortiqcha netPaid bo'lsa (balance < 0), isRefundDue = true. Math.max(0, balance) bilan yashirilmaydi.
 */
export function computeDetailedBill(
  items: BillItemCalcInput[],
  serviceChargeBps: number,
  adjustments: BillAdjustmentCalcInput[] = [],
  payments: BillPaymentCalcInput[] = []
): DetailedBillSummary {
  // 1. Subtotal: Barcha CANCELLED bo'lmagan taomlar va ularning addonlari
  let subtotalTiyin = 0n;
  for (const item of items) {
    if (item.status === OrderItemStatus.CANCELLED || item.status === 'CANCELLED') {
      continue;
    }
    const itemPrice = BigInt(item.snapshotPriceTiyin);
    const qty = BigInt(item.quantity || 1);
    let itemTotal = itemPrice * qty;

    if (item.addonSnapshots && item.addonSnapshots.length > 0) {
      for (const addon of item.addonSnapshots) {
        itemTotal += BigInt(addon.priceTiyin) * qty;
      }
    }
    subtotalTiyin += itemTotal;
  }

  // 2. Chegirmalar (Discounts): Flat yoki percent, faqat food subtotaldan olinadi
  let rawDiscountTiyin = 0n;
  let signedAdjustmentsTiyin = 0n;

  for (const adj of adjustments) {
    const amt = BigInt(adj.amountTiyin);
    if (adj.type === 'DISCOUNT') {
      if (adj.percentageBps && adj.percentageBps > 0) {
        rawDiscountTiyin += calculatePercentTiyin(subtotalTiyin, adj.percentageBps);
      } else {
        rawDiscountTiyin += amt > 0n ? amt : -amt;
      }
    } else {
      signedAdjustmentsTiyin += amt;
    }
  }

  const discountTiyin = rawDiscountTiyin > subtotalTiyin ? subtotalTiyin : rawDiscountTiyin;
  const discountedSubtotalTiyin = subtotalTiyin - discountTiyin;

  // 3. Xizmat haqi chegirmadan keyingi food subtotaldan hisoblanadi!
  const serviceChargeTiyin = calculatePercentTiyin(discountedSubtotalTiyin, serviceChargeBps);

  // 4. totalDue = subtotal - discount + serviceFee + signed adjustment
  const totalDueTiyin = discountedSubtotalTiyin + serviceChargeTiyin + signedAdjustmentsTiyin;

  // 5. To'lovlar, Reversallar va Refundlar
  let grossPaidTiyin = 0n;
  let reversedPaidTiyin = 0n;
  let refundedTiyin = 0n;

  for (const pay of payments) {
    const payAmt = BigInt(pay.amountTiyin);
    if (pay.status === 'COMPLETED') {
      grossPaidTiyin += payAmt;
      if (pay.refunds && pay.refunds.length > 0) {
        for (const ref of pay.refunds) {
          refundedTiyin += BigInt(ref.amountTiyin);
        }
      }
    } else if (pay.status === 'REVERSED') {
      reversedPaidTiyin += payAmt;
    }
  }

  const netPaidTiyin = grossPaidTiyin - refundedTiyin;
  const balanceTiyin = totalDueTiyin - netPaidTiyin;
  const isRefundDue = balanceTiyin < 0n;
  const isFullyPaid = balanceTiyin === 0n && (totalDueTiyin > 0n || netPaidTiyin > 0n);

  return {
    subtotalTiyin,
    discountTiyin,
    discountedSubtotalTiyin,
    serviceChargeBps,
    serviceChargeTiyin,
    adjustmentsTiyin: signedAdjustmentsTiyin,
    totalDueTiyin,
    grossPaidTiyin,
    reversedPaidTiyin,
    refundedTiyin,
    netPaidTiyin,
    balanceTiyin,
    isRefundDue,
    isFullyPaid,
  };
}

