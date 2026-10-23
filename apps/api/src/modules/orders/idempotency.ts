import crypto from 'node:crypto';

export interface RawOrderItemInput {
  menuItemId: string;
  variantId?: string | null;
  addonOptionIds?: string[];
  quantity: number;
  notes?: string | null;
  expectedVersion?: number;
}

export interface RawOrderPayload {
  visitId: string;
  currency?: string;
  notes?: string | null;
  items: RawOrderItemInput[];
}

export interface CanonicalOrderItem {
  menuItemId: string;
  variantId: string;
  addonOptionIds: string[];
  quantity: number;
  notes: string;
  expectedVersion: number;
}

export interface CanonicalOrderPayload {
  visitId: string;
  currency: string;
  notes: string;
  items: CanonicalOrderItem[];
}

/**
 * Normalizatsiya Siyosati (Canonical Normalization Policy):
 * 1. visitId va currency toza string ko'rinishida standartlashtiriladi (default currency: 'UZS').
 * 2. notes maydonlari trim qilinadi (bo'sh bo'lsa '').
 * 3. Har bir item uchun:
 *    - menuItemId: string
 *    - variantId: variant mavjud bo'lsa id, aks holda ''
 *    - addonOptionIds: har doim alifbo tartibida tartiblangan (sorted) massiv
 *    - quantity: butun son
 *    - notes: trim qilingan satr
 *    - expectedVersion: son (berilmagan bo'lsa 0)
 * 4. Items massivi kanonik tartibda saralanadi:
 *    - menuItemId bo'yicha
 *    - variantId bo'yicha
 *    - addonOptionIds.join(',') bo'yicha
 *    - notes bo'yicha
 *    - quantity bo'yicha
 * 5. Barcha kalitlari saralangan JSON obyekti hosil qilinadi va SHA-256 bilan xeshlanadi.
 */
export function normalizeOrderPayload(payload: RawOrderPayload): {
  canonical: CanonicalOrderPayload;
  requestHash: string;
} {
  const currency = (payload.currency || 'UZS').toUpperCase().trim();
  const notes = (payload.notes || '').trim();

  const normalizedItems: CanonicalOrderItem[] = (payload.items || []).map((item) => {
    const addonOptionIds = (item.addonOptionIds || [])
      .map((id) => id.trim())
      .filter(Boolean)
      .sort();

    return {
      menuItemId: item.menuItemId.trim(),
      variantId: (item.variantId || '').trim(),
      addonOptionIds,
      quantity: Number(item.quantity) || 1,
      notes: (item.notes || '').trim(),
      expectedVersion: item.expectedVersion ? Number(item.expectedVersion) : 0,
    };
  });

  // Items kanonik tartiblash
  normalizedItems.sort((a, b) => {
    if (a.menuItemId !== b.menuItemId) return a.menuItemId.localeCompare(b.menuItemId);
    if (a.variantId !== b.variantId) return a.variantId.localeCompare(b.variantId);
    const addonsA = a.addonOptionIds.join(',');
    const addonsB = b.addonOptionIds.join(',');
    if (addonsA !== addonsB) return addonsA.localeCompare(addonsB);
    if (a.notes !== b.notes) return a.notes.localeCompare(b.notes);
    return a.quantity - b.quantity;
  });

  const canonical: CanonicalOrderPayload = {
    visitId: payload.visitId.trim(),
    currency,
    notes,
    items: normalizedItems,
  };

  const canonicalJson = JSON.stringify(canonical);
  const requestHash = crypto.createHash('sha256').update(canonicalJson).digest('hex');

  return { canonical, requestHash };
}

/**
 * Idempotency kalitining to'liq skopi (Tenant + Operation + Visit + Key)
 */
export function buildScopedIdempotencyKey(
  restaurantId: string,
  visitId: string,
  clientKey: string
): string {
  const cleanKey = clientKey.trim();
  return `${restaurantId}:guest_order:${visitId}:${cleanKey}`;
}
