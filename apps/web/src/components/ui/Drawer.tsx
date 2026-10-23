import React, { useEffect } from 'react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  position?: 'bottom' | 'right';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  position = 'bottom',
}) => {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isBottom = position === 'bottom';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full bg-surface shadow-2xl border-line flex flex-col ${
          isBottom
            ? 'mt-auto max-h-[85vh] rounded-t-card-lg border-t animate-in slide-in-from-bottom duration-200'
            : 'ml-auto max-w-md h-full rounded-l-card-lg border-l animate-in slide-in-from-right duration-200'
        }`}
      >
        {isBottom && (
          <div className="w-12 h-1.5 bg-line-dark rounded-full mx-auto my-3 shrink-0" />
        )}
        {title && (
          <div className="px-6 py-4 border-b border-line flex items-center justify-between shrink-0">
            <h3 className="font-bold text-base text-ink-main">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Yopish"
              className="text-ink-muted hover:text-ink-main w-8 h-8 rounded-lg flex items-center justify-center hover:bg-bg transition-colors"
            >
              ✕
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};
