import React, { useState, useEffect } from 'react';
import { Plus, Minus, Check, AlertCircle } from 'lucide-react';
import { Dialog } from '../ui/Dialog.tsx';
import { Button } from '../ui/Button.tsx';
import { Money } from '../ui/Money.tsx';
import { ImageFallback } from '../ui/ImageFallback.tsx';
import { stripParentheses } from '@menurest/shared';

export interface DishVariant {
  id: string;
  name: string;
  priceDiffTiyin?: bigint | string;
  isAvailable?: boolean;
}

export interface DishAddonOption {
  id: string;
  name: string;
  priceTiyin?: bigint | string;
  isAvailable?: boolean;
}

export interface DishAddonGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: DishAddonOption[];
}

export interface SelectedDishDetail {
  id: string;
  name: string;
  desc?: string;
  basePriceTiyin: bigint;
  imageUrl?: string;
  isAvailable: boolean;
  version: number;
  allergens?: string[];
  variants?: DishVariant[];
  addonGroups?: DishAddonGroup[];
}

export interface CartSubmitItem {
  id: string;
  menuItemId: string;
  name: string;
  basePriceTiyin: bigint;
  finalUnitPriceTiyin: bigint;
  quantity: number;
  variantId?: string;
  variantName?: string;
  selectedAddons: { id: string; name: string; priceTiyin: bigint }[];
  notes?: string;
  expectedVersion: number;
}

interface DishDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dish: SelectedDishDetail | null;
  lang: 'uz' | 'ru';
  onAddToCart: (item: CartSubmitItem) => void;
}

export const DishDetailModal: React.FC<DishDetailModalProps> = ({
  isOpen,
  onClose,
  dish,
  lang,
  onAddToCart,
}) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (dish) {
      setSelectedVariantId(dish.variants?.[0]?.id || '');
      setSelectedAddonIds([]);
      setQuantity(1);
      setErrorMsg(null);
    }
  }, [dish]);

  if (!dish) return null;

  // Variant narx farqi
  const activeVariant = dish.variants?.find((v) => v.id === selectedVariantId);
  const variantDiff = activeVariant?.priceDiffTiyin
    ? BigInt(activeVariant.priceDiffTiyin.toString())
    : 0n;

  // Tanlangan addonlar
  const allAddonOpts = (dish.addonGroups || []).flatMap((g) => g.options);
  const selectedAddonsList = allAddonOpts
    .filter((opt) => selectedAddonIds.includes(opt.id))
    .map((opt) => ({
      id: opt.id,
      name: opt.name,
      priceTiyin: opt.priceTiyin ? BigInt(opt.priceTiyin.toString()) : 0n,
    }));

  const addonsTotalTiyin = selectedAddonsList.reduce((sum, a) => sum + a.priceTiyin, 0n);
  const unitPriceTiyin = dish.basePriceTiyin + variantDiff + addonsTotalTiyin;
  const totalPriceTiyin = unitPriceTiyin * BigInt(quantity);

  function toggleAddon(groupId: string, optionId: string) {
    setErrorMsg(null);
    const group = dish?.addonGroups?.find((g) => g.id === groupId);
    if (!group) return;

    const currentInGroup = group.options
      .map((o) => o.id)
      .filter((id) => selectedAddonIds.includes(id));

    const isSelected = selectedAddonIds.includes(optionId);

    if (isSelected) {
      setSelectedAddonIds((prev) => prev.filter((id) => id !== optionId));
    } else {
      if (currentInGroup.length >= group.maxSelect) {
        setErrorMsg(
          lang === 'uz'
            ? `'${group.name}' guruhidan ko'pi bilan ${group.maxSelect} ta tanlash mumkin`
            : `В группе '${group.name}' максимум ${group.maxSelect} вариантов`
        );
        return;
      }
      setSelectedAddonIds((prev) => [...prev, optionId]);
    }
  }

  function handleAdd() {
    // Min select tekshiruvi
    for (const group of dish?.addonGroups || []) {
      const chosenInGroup = group.options
        .map((o) => o.id)
        .filter((id) => selectedAddonIds.includes(id));
      if (chosenInGroup.length < group.minSelect) {
        setErrorMsg(
          lang === 'uz'
            ? `'${group.name}' guruhidan kamida ${group.minSelect} ta tanlash majburiy`
            : `В группе '${group.name}' обязательно выбрать минимум ${group.minSelect}`
        );
        return;
      }
    }

    onAddToCart({
      id: `cart_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      menuItemId: dish!.id,
      name: dish!.name,
      basePriceTiyin: dish!.basePriceTiyin,
      finalUnitPriceTiyin: unitPriceTiyin,
      quantity,
      variantId: activeVariant?.id,
      variantName: activeVariant?.name,
      selectedAddons: selectedAddonsList,
      expectedVersion: dish!.version,
    });

    onClose();
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={stripParentheses(dish.name)} maxWidth="md">
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* Rasm */}
        {dish.imageUrl && (
          <div className="w-full h-48 rounded-2xl overflow-hidden bg-bg relative border border-line">
            <ImageFallback
              src={dish.imageUrl}
              alt={stripParentheses(dish.name)}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Tavsif & Allergenlar */}
        <div className="space-y-2">
          {dish.desc && <p className="text-xs text-ink-secondary leading-relaxed">{dish.desc}</p>}
          {dish.allergens && dish.allergens.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-ink-muted font-bold">Allergenlar:</span>
              {dish.allergens.map((a) => (
                <span
                  key={a}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                >
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Variantlar (Porsiya) */}
        {dish.variants && dish.variants.length > 0 && (
          <div className="space-y-2 border-t border-line pt-3">
            <h4 className="text-xs font-bold text-ink-main uppercase tracking-wider">
              {lang === 'uz' ? 'Porsiya / Variant' : 'Размер / Вариант'}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {dish.variants.map((v) => {
                const isSelected = selectedVariantId === v.id;
                const diff = v.priceDiffTiyin ? BigInt(v.priceDiffTiyin.toString()) : 0n;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all min-h-[44px] ${
                      isSelected
                        ? 'border-brand bg-brand-50/50 shadow-sm text-brand'
                        : 'border-line bg-surface hover:bg-bg text-ink-main'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold block">{v.name}</span>
                      {diff !== 0n && (
                        <span className="text-[10px] text-ink-muted">
                          {diff > 0n ? '+' : ''}
                          <Money amountTiyin={diff} />
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-brand shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Addon Guruhlari */}
        {dish.addonGroups &&
          dish.addonGroups.map((group) => (
            <div key={group.id} className="space-y-2 border-t border-line pt-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-ink-main uppercase tracking-wider">
                  {group.name}
                </h4>
                <span className="text-[10px] text-ink-muted">
                  {group.minSelect > 0
                    ? `Majburiy: ${group.minSelect} ta`
                    : `Ixtiyoriy, max ${group.maxSelect} ta`}
                </span>
              </div>
              <div className="space-y-1.5">
                {group.options.map((opt) => {
                  const isChecked = selectedAddonIds.includes(opt.id);
                  const optPrice = opt.priceTiyin ? BigInt(opt.priceTiyin.toString()) : 0n;
                  return (
                    <label
                      key={opt.id}
                      onClick={() => toggleAddon(group.id, opt.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all min-h-[44px] ${
                        isChecked
                          ? 'border-brand bg-brand-50/40 text-brand'
                          : 'border-line bg-surface hover:bg-bg text-ink-main'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          className="w-4 h-4 text-brand rounded border-line focus:ring-brand"
                        />
                        <span className="text-xs font-medium">{opt.name}</span>
                      </div>
                      {optPrice > 0n && (
                        <span className="text-xs font-bold">
                          +<Money amountTiyin={optPrice} />
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Miqdor va Yakuniy Narx */}
        <div className="border-t border-line pt-3 flex items-center justify-between">
          <div className="flex items-center space-x-2 bg-bg border border-line rounded-xl p-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg bg-surface border border-line text-ink-main flex items-center justify-center font-bold text-sm shadow-sm min-h-[32px]"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-sm font-bold text-ink-main">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(50, q + 1))}
              className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center font-bold text-sm shadow-sm min-h-[32px]"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-ink-muted block">
              {lang === 'uz' ? 'Jami summa:' : 'Итого:'}
            </span>
            <Money amountTiyin={totalPriceTiyin} className="text-base font-extrabold text-brand" />
          </div>
        </div>

        {/* Qo'shish tugmasi */}
        <Button
          size="lg"
          variant="primary"
          onClick={handleAdd}
          className="w-full justify-center font-bold text-sm min-h-[44px]"
        >
          {lang === 'uz' ? 'Savatchaga qo\'shish' : 'Добавить в корзину'}
        </Button>
      </div>
    </Dialog>
  );
};
