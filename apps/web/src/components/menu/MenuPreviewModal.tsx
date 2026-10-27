import React from 'react';
import { X } from 'lucide-react';
import { Dialog } from '../ui/Dialog.tsx';

interface MenuPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
  tables: any[];
  dishesCount?: number;
  categoriesCount?: number;
}

export const MenuPreviewModal: React.FC<MenuPreviewModalProps> = ({
  isOpen,
  onClose,
  restaurantId,
  tables = [],
}) => {
  if (!isOpen) return null;

  const currentTable = tables[0];
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  
  // Preview URL for guest view
  const previewUrl = currentTable?.qrToken
    ? `${origin}/table/${currentTable.qrToken}?preview=true`
    : `${origin}/guest?restaurant=${restaurantId}&preview=true`;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="md"
      className="p-0 overflow-hidden rounded-2xl border-0 shadow-2xl"
    >
      <div className="relative w-full h-[680px] bg-bg overflow-hidden">
        {/* Sleek Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 p-2 rounded-full bg-slate-900/70 hover:bg-slate-950 text-white shadow-lg backdrop-blur-md transition-all active:scale-95"
          title="Yopish"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Clean 100% Direct Menu Display */}
        <iframe
          src={previewUrl}
          title="Mijozlar menyusi"
          className="w-full h-full border-0 select-none bg-bg"
        />
      </div>
    </Dialog>
  );
};
