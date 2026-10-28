import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, Plus, Layers } from 'lucide-react';
import { Dialog } from '../ui/Dialog.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';

interface CategoryItem {
  id: string;
  name: string;
  sortOrder?: number;
  isVisible?: boolean;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { id?: string; name: string; sortOrder: number; isVisible: boolean }) => Promise<void> | void;
  onDelete?: (categoryId: string, categoryName: string) => Promise<void> | void;
  initialData?: { id?: string; name: string; sortOrder: number; isVisible: boolean } | null;
  categories?: CategoryItem[];
  dishes?: { id: string; categoryId: string }[];
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  categories = [],
  dishes = [],
}) => {
  const [editingId, setEditingId] = useState<string | undefined>(initialData?.id);
  const [name, setName] = useState(initialData?.name || '');
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEditingId(initialData?.id);
      setName(initialData?.name || '');
      setSortOrder(initialData?.sortOrder ?? 0);
      setSaving(false);
    }
  }, [isOpen, initialData]);

  const handleSelectForEdit = (cat: CategoryItem) => {
    setEditingId(cat.id);
    setName(cat.name);
    setSortOrder(cat.sortOrder ?? 0);
  };

  const handleSwitchToCreate = () => {
    setEditingId(undefined);
    setName('');
    setSortOrder((categories.length || 0) * 10);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      await onSave({
        id: editingId,
        name: name.trim(),
        sortOrder,
        isVisible: true,
      });
      // Reset form if modal stays open or wait for close
      setEditingId(undefined);
      setName('');
      setSortOrder(0);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (catId: string, catName: string) => {
    if (!onDelete) return;
    if (editingId === catId) {
      handleSwitchToCreate();
    }
    await onDelete(catId, catName);
  };

  // Filter out any virtual categories like 'all'
  const realCategories = categories.filter((c) => c.id !== 'all');

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={editingId ? 'Kategoriyani Tahrirlash' : "Yangi Kategoriya Qo'shish"}
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Form qismi */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
              {editingId ? "Tahrirlash rejimi" : "Yangi toifa ma'lumotlari"}
            </span>
            {editingId && (
              <button
                type="button"
                onClick={handleSwitchToCreate}
                className="text-xs text-brand hover:underline font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Yangi kategoriya qo'shishga o'tish
              </button>
            )}
          </div>

          <Input
            label="Kategoriya nomi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Masalan: Milliy Taomlar, Kaboblar, Ichimliklar..."
            autoFocus
          />

          <Input
            label="Tartib raqami"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            min={0}
            placeholder="0"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saqlanmoqda...' : editingId ? "O'zgarishni Saqlash" : 'Saqlash'}
            </Button>
          </div>
        </form>

        {/* Pastki qism: Mavjud kategoriyalar ro'yxati */}
        <div className="pt-4 border-t border-line space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand" />
              <h4 className="text-xs font-bold text-ink-main uppercase tracking-wider">
                Mavjud Kategoriyalar ({realCategories.length})
              </h4>
            </div>
          </div>

          {realCategories.length === 0 ? (
            <p className="text-xs text-ink-secondary italic py-2">
              Hozircha kategoriyalar mavjud emas. Yuqoridagi formadan yangi toifa qo'shishingiz mumkin.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1 bg-bg/50 rounded-xl border border-line/60">
              {realCategories.map((cat) => {
                const dishCount = dishes.filter((d) => d.categoryId === cat.id).length;
                const isCurrent = editingId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                      isCurrent
                        ? 'bg-brand text-white border-brand ring-2 ring-brand/30'
                        : 'bg-surface border-line text-ink-main hover:border-brand/40 hover:bg-surface'
                    }`}
                  >
                    <span className="truncate max-w-[130px] sm:max-w-[170px]" title={cat.name}>
                      {cat.name}
                    </span>

                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono shrink-0 ${
                        isCurrent
                          ? 'bg-white/20 text-white'
                          : 'bg-bg text-ink-secondary border border-line/60'
                      }`}
                      title={`${dishCount} ta taom biriktirilgan`}
                    >
                      {dishCount}
                    </span>

                    <div
                      className={`flex items-center gap-0.5 ml-1 pl-1 border-l ${
                        isCurrent ? 'border-white/30' : 'border-line'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectForEdit(cat)}
                        className={`p-1 rounded-lg transition-colors ${
                          isCurrent
                            ? 'text-white hover:bg-white/20'
                            : 'text-ink-secondary hover:text-brand hover:bg-brand-50'
                        }`}
                        title={`"${cat.name}" nomini tahrirlash`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(cat.id, cat.name)}
                          className={`p-1 rounded-lg transition-colors ${
                            isCurrent
                              ? 'text-white hover:bg-red-500/80'
                              : 'text-ink-secondary hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={`"${cat.name}" kategoriyasini o'chirish`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};
