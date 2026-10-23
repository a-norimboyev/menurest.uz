import React, { useState } from 'react';
import { Dialog } from '../ui/Dialog.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { id?: string; name: string; sortOrder: number; isVisible: boolean }) => void;
  initialData?: { id?: string; name: string; sortOrder: number; isVisible: boolean } | null;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0);
  const [isVisible, setIsVisible] = useState(initialData?.isVisible ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: initialData?.id,
      name: name.trim(),
      sortOrder,
      isVisible,
    });
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Kategoriyani Tahrirlash' : 'Yangi Kategoriya Qo\'shish'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Kategoriya nomi"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Masalan: Milliy Taomlar"
        />

        <Input
          label="Tartib raqami (Sort order)"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          min={0}
        />

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="catIsVisible"
            checked={isVisible}
            onChange={(e) => setIsVisible(e.target.checked)}
            className="rounded border-line text-brand focus:ring-brand h-4 w-4"
          />
          <label htmlFor="catIsVisible" className="text-xs font-semibold text-ink-main cursor-pointer">
            Menyuda ko'rinadi (Faol)
          </label>
        </div>

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
