import React, { useState } from 'react';
import { Store, Check, ArrowRight, X } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.ts';

interface RestaurantItem {
  id: string;
  name: string;
  slug: string;
  roles: string[];
}

interface RestaurantSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurants: RestaurantItem[];
  activeRestaurantId?: string;
  onSelect: (restaurantId: string) => void;
}

export const RestaurantSelectorModal: React.FC<RestaurantSelectorModalProps> = ({
  isOpen,
  onClose,
  restaurants,
  activeRestaurantId,
  onSelect,
}) => {
  useBodyScrollLock(isOpen);

  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSwitch(id: string) {
    setLoadingId(id);
    try {
      await onSelect(id);
      onClose();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-in fade-in overscroll-contain">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="bg-brand-900 text-white p-6 relative">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center">
              <Store className="w-5 h-5 text-brand-100" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Restoranni Tanlang</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-brand-300 hover:text-white transition-colors"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {restaurants.map((r) => {
            const isActive = r.id === activeRestaurantId;
            return (
              <button
                key={r.id}
                disabled={loadingId === r.id}
                onClick={() => handleSwitch(r.id)}
                className={`w-full p-4 text-left rounded-xl border transition-all flex items-center justify-between ${
                  isActive
                    ? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-500'
                    : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{r.name}</span>
                    {isActive && (
                      <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 text-[10px] font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Faol
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    Rollar: <span className="font-semibold text-slate-700">{r.roles.join(', ')}</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
