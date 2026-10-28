import React, { useState, useEffect } from 'react';
import { Upload } from 'lucide-react';
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

export const MenuItemModal: React.FC<MenuItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  categories,
  stations,
}) => {
  const [formData, setFormData] = useState<MenuItemFormData>({
    nameUz: '',
    nameRu: '',
    descUz: '',
    descRu: '',
    categoryId: categories[0]?.id || '',
    stationId: stations[0]?.id || '',
    basePriceUzs: 35000,
    imageUrl: '',
    allergens: [],
    variants: [{ name: 'Standart', priceDiffUzs: 0, isDefault: true }],
    addonGroups: [],
  });

  const [imagePreview, setImagePreview] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData);
        setImagePreview(initialData.imageUrl || '');
      } else {
        setFormData({
          nameUz: '',
          nameRu: '',
          descUz: '',
          descRu: '',
          categoryId: categories[0]?.id || '',
          stationId: stations[0]?.id || '',
          basePriceUzs: 35000,
          imageUrl: '',
          allergens: [],
          variants: [{ name: 'Standart', priceDiffUzs: 0, isDefault: true }],
          addonGroups: [],
        });
        setImagePreview('');
      }
    }
  }, [isOpen, initialData, categories, stations]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setFormData((prev) => ({ ...prev, imageUrl: url }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameUz.trim()) return;

    onSave({
      ...formData,
      nameUz: formData.nameUz.trim(),
      nameRu: formData.nameRu.trim() || formData.nameUz.trim(),
      descUz: formData.descUz.trim(),
      descRu: formData.descRu.trim() || formData.descUz.trim(),
      stationId: formData.stationId || stations[0]?.id || '',
    });
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Taomni Tahrirlash' : "Yangi Taom Qo'shish"}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Taom nomi */}
        <Input
          label="Taom nomi"
          value={formData.nameUz}
          onChange={(e) => setFormData({ ...formData, nameUz: e.target.value })}
          required
          placeholder="Masalan: To'y Oshi, Somsa, Choy..."
          autoFocus
        />

        {/* 2. Kategoriya va Narx */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Kategoriya"
            value={formData.categoryId}
            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            required
          />
          <Input
            label="Narxi"
            type="number"
            value={formData.basePriceUzs}
            onChange={(e) => setFormData({ ...formData, basePriceUzs: Number(e.target.value) })}
            required
            min={0}
            step={500}
            placeholder="Masalan: 35000"
          />
        </div>

        {/* 3. Tavsif */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-main block">Tavsif</label>
          <textarea
            className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink-main focus:outline-none focus:ring-2 focus:ring-brand min-h-[72px]"
            rows={2}
            value={formData.descUz}
            onChange={(e) => setFormData({ ...formData, descUz: e.target.value })}
            placeholder="Masalliqlar yoki qisqacha ma'lumot..."
          />
        </div>

        {/* 4. Taom Rasmi */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink-main block">Taom rasmi</label>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl border border-line bg-bg overflow-hidden flex items-center justify-center shrink-0">
              {imagePreview ? (
                <img src={imagePreview} alt="Rasm" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-5 h-5 text-ink-secondary" />
              )}
            </div>
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="text-xs text-ink-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand hover:file:bg-brand-100 cursor-pointer"
              />
            </div>
          </div>
        </div>

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
