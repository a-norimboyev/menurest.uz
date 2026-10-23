import React, { useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { Dialog } from '../ui/Dialog.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Select } from '../ui/Select.tsx';

export interface MenuItemFormData {
  id?: string;
  nameUz: string;
  nameRu: string;
  descUz: string;
  descRu: string;
  categoryId: string;
  stationId: string;
  basePriceUzs: number;
  imageUrl?: string;
  allergens: string[];
  variants: { name: string; priceDiffUzs: number; isDefault: boolean }[];
  addonGroups: {
    name: string;
    minSelect: number;
    maxSelect: number;
    options: { name: string; priceUzs: number }[];
  }[];
}

interface MenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MenuItemFormData) => void;
  initialData?: MenuItemFormData | null;
  categories: { id: string; name: string }[];
  stations: { id: string; name: string }[];
}

const COMMON_ALLERGENS = ['Gluten', 'Tuxum', 'Sut', 'Yong\'oq', 'Kunjut', 'Baliq', 'Xantal'];

export const MenuItemModal: React.FC<MenuItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  categories,
  stations,
}) => {
  const [formData, setFormData] = useState<MenuItemFormData>(
    initialData || {
      nameUz: '',
      nameRu: '',
      descUz: '',
      descRu: '',
      categoryId: categories[0]?.id || '',
      stationId: stations[0]?.id || '',
      basePriceUzs: 35000,
      imageUrl: '',
      allergens: [],
      variants: [
        { name: 'Standart porsiya', priceDiffUzs: 0, isDefault: true },
      ],
      addonGroups: [],
    }
  );

  const [activeTab, setActiveTab] = useState<'general' | 'variants' | 'addons'>('general');
  const [imagePreview, setImagePreview] = useState<string>(initialData?.imageUrl || '');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setFormData((prev) => ({ ...prev, imageUrl: url }));
    }
  };

  const toggleAllergen = (item: string) => {
    setFormData((prev) => {
      const exists = prev.allergens.includes(item);
      return {
        ...prev,
        allergens: exists ? prev.allergens.filter((a) => a !== item) : [...prev.allergens, item],
      };
    });
  };

  const addVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, { name: 'Kichik porsiya', priceDiffUzs: -10000, isDefault: false }],
    }));
  };

  const removeVariant = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const addAddonGroup = () => {
    setFormData((prev) => ({
      ...prev,
      addonGroups: [
        ...prev.addonGroups,
        {
          name: "Qo'shimchalar",
          minSelect: 0,
          maxSelect: 2,
          options: [{ name: 'Qazi', priceUzs: 8000 }],
        },
      ],
    }));
  };

  const removeAddonGroup = (groupIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      addonGroups: prev.addonGroups.filter((_, i) => i !== groupIndex),
    }));
  };

  const addOptionToGroup = (groupIndex: number) => {
    setFormData((prev) => {
      const nextGroups = [...prev.addonGroups];
      nextGroups[groupIndex].options.push({ name: 'Bedana tuxum', priceUzs: 3000 });
      return { ...prev, addonGroups: nextGroups };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Taomni Tahrirlash" : "Yangi Taom Qo'shish"}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step Tabs */}
        <div className="flex border-b border-line gap-2 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'general' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg'
            }`}
          >
            1. Asosiy & Tarjimalar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('variants')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'variants' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg'
            }`}
          >
            2. Porsiya & Variantlar ({formData.variants.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('addons')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'addons' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg'
            }`}
          >
            3. Qo'shimchalar ({formData.addonGroups.length})
          </button>
        </div>

        {/* TAB 1: General Info */}
        {activeTab === 'general' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Taom nomi (O'zbekcha)"
                value={formData.nameUz}
                onChange={(e) => setFormData({ ...formData, nameUz: e.target.value })}
                required
                placeholder="Masalan: To'y Oshi"
              />
              <Input
                label="Taom nomi (Ruscha)"
                value={formData.nameRu}
                onChange={(e) => setFormData({ ...formData, nameRu: e.target.value })}
                placeholder="Masalan: Свадебный плов"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-ink-main block">Tavsif (O'zbekcha)</label>
                <textarea
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink-main focus:outline-none focus:ring-2 focus:ring-brand"
                  rows={2}
                  value={formData.descUz}
                  onChange={(e) => setFormData({ ...formData, descUz: e.target.value })}
                  placeholder="Masalliqlar, tayyorlanish usuli..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-ink-main block">Tavsif (Ruscha)</label>
                <textarea
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink-main focus:outline-none focus:ring-2 focus:ring-brand"
                  rows={2}
                  value={formData.descRu}
                  onChange={(e) => setFormData({ ...formData, descRu: e.target.value })}
                  placeholder="Описание на русском..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Kategoriya"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                required
              />
              <Select
                label="Tayyorlash stansiyasi"
                value={formData.stationId}
                onChange={(e) => setFormData({ ...formData, stationId: e.target.value })}
                options={stations.map((s) => ({ value: s.id, label: s.name }))}
                required
              />
              <Input
                label="Asosiy narx (UZS)"
                type="number"
                value={formData.basePriceUzs}
                onChange={(e) => setFormData({ ...formData, basePriceUzs: Number(e.target.value) })}
                required
                min={0}
                step={500}
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-main block">Taom Rasmi (JPEG/PNG/WEBP)</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-line bg-bg overflow-hidden flex items-center justify-center shrink-0">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-6 h-6 text-ink-secondary" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="text-xs text-ink-secondary file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand hover:file:bg-brand-100"
                  />
                  <p className="text-[11px] text-ink-secondary mt-1">
                    Maksimal 5 MB. Tasodifiy xavfsiz kalit bilan saqlanadi.
                  </p>
                </div>
              </div>
            </div>

            {/* Allergens tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-main block">Allergen Ma'lumotlari</label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_ALLERGENS.map((allergen) => {
                  const selected = formData.allergens.includes(allergen);
                  return (
                    <button
                      type="button"
                      key={allergen}
                      onClick={() => toggleAllergen(allergen)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        selected
                          ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                          : 'bg-surface border-line text-ink-secondary hover:bg-bg'
                      }`}
                    >
                      {allergen}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Variants */}
        {activeTab === 'variants' && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-secondary">Porsiyalar (masalan: 0.7 kichik, 1.0 to'liq porsiya)</p>
              <Button type="button" size="sm" variant="outline" onClick={addVariant} className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" /> Variant Qo'shish
              </Button>
            </div>

            <div className="space-y-2">
              {formData.variants.map((v, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2.5 bg-bg rounded-xl border border-line">
                  <Input
                    placeholder="Variant nomi"
                    value={v.name}
                    onChange={(e) => {
                      const next = [...formData.variants];
                      next[idx].name = e.target.value;
                      setFormData({ ...formData, variants: next });
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Narx farqi (UZS)"
                    type="number"
                    value={v.priceDiffUzs}
                    onChange={(e) => {
                      const next = [...formData.variants];
                      next[idx].priceDiffUzs = Number(e.target.value);
                      setFormData({ ...formData, variants: next });
                    }}
                    className="w-32"
                  />
                  <label className="flex items-center gap-1 text-xs text-ink-secondary cursor-pointer whitespace-nowrap">
                    <input
                      type="radio"
                      name="defaultVariant"
                      checked={v.isDefault}
                      onChange={() => {
                        const next = formData.variants.map((item, i) => ({
                          ...item,
                          isDefault: i === idx,
                        }));
                        setFormData({ ...formData, variants: next });
                      }}
                    />
                    <span>Asosiy</span>
                  </label>
                  {formData.variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(idx)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Addons */}
        {activeTab === 'addons' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-secondary">Majburiy yoki ixtiyoriy qo'shimchalar (Qazi, Tuxum, Sous va h.k.)</p>
              <Button type="button" size="sm" variant="outline" onClick={addAddonGroup} className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" /> Guruh Qo'shish
              </Button>
            </div>

            {formData.addonGroups.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink-secondary border border-line rounded-xl">
                Qo'shimcha guruhlari mavjud emas
              </div>
            ) : (
              formData.addonGroups.map((group, gIdx) => (
                <div key={gIdx} className="p-3 bg-bg rounded-xl border border-line space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      placeholder="Guruh nomi (Masalan: Qo'shimchalar)"
                      value={group.name}
                      onChange={(e) => {
                        const next = [...formData.addonGroups];
                        next[gIdx].name = e.target.value;
                        setFormData({ ...formData, addonGroups: next });
                      }}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
                      <span>Min:</span>
                      <input
                        type="number"
                        min={0}
                        value={group.minSelect}
                        onChange={(e) => {
                          const next = [...formData.addonGroups];
                          next[gIdx].minSelect = Number(e.target.value);
                          setFormData({ ...formData, addonGroups: next });
                        }}
                        className="w-14 p-1 rounded-lg border border-line text-center text-xs font-bold"
                      />
                      <span>Max:</span>
                      <input
                        type="number"
                        min={1}
                        value={group.maxSelect}
                        onChange={(e) => {
                          const next = [...formData.addonGroups];
                          next[gIdx].maxSelect = Number(e.target.value);
                          setFormData({ ...formData, addonGroups: next });
                        }}
                        className="w-14 p-1 rounded-lg border border-line text-center text-xs font-bold"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAddonGroup(gIdx)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Options inside group */}
                  <div className="pl-3 border-l-2 border-line space-y-2">
                    {group.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <Input
                          placeholder="Variant nomi (Masalan: Qazi)"
                          value={opt.name}
                          onChange={(e) => {
                            const next = [...formData.addonGroups];
                            next[gIdx].options[oIdx].name = e.target.value;
                            setFormData({ ...formData, addonGroups: next });
                          }}
                          className="flex-1"
                        />
                        <Input
                          placeholder="Narxi (UZS)"
                          type="number"
                          value={opt.priceUzs}
                          onChange={(e) => {
                            const next = [...formData.addonGroups];
                            next[gIdx].options[oIdx].priceUzs = Number(e.target.value);
                            setFormData({ ...formData, addonGroups: next });
                          }}
                          className="w-28"
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOptionToGroup(gIdx)}
                      className="text-xs font-bold text-brand hover:underline flex items-center gap-1 pt-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Variant qo'shish
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-line">
          <Button type="button" variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="primary">
            Saqlash
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
