import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  fullscreen?: boolean;
  allowFullscreenToggle?: boolean;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
  fullscreen: defaultFullscreen = false,
  allowFullscreenToggle = true,
  className = '',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen);

  useEffect(() => {
    setIsFullscreen(defaultFullscreen);
  }, [defaultFullscreen, isOpen]);

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

  const widthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    '2xl': 'max-w-3xl',
    '3xl': 'max-w-4xl',
    '4xl': 'max-w-5xl',
    full: 'max-w-full',
  }[maxWidth];

  if (isFullscreen) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        className="fixed inset-0 z-50 bg-bg flex flex-col overflow-y-auto animate-in fade-in duration-200"
      >
        <div ref={dialogRef} className={`w-full min-h-screen flex flex-col ${className}`}>
          {(title || description) && (
            <header className="sticky top-0 z-30 px-6 sm:px-10 py-4 bg-surface/90 backdrop-blur-md border-b border-line flex items-center justify-between shadow-subtle">
              <div className="space-y-0.5">
                {title && (
                  <h3 id="dialog-title" className="text-xl font-black text-ink-main tracking-tight">
                    {title}
                  </h3>
                )}
                {description && <p className="text-xs text-ink-muted">{description}</p>}
              </div>
              <div className="flex items-center gap-2">
                {allowFullscreenToggle && (
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(false)}
                    aria-label="Kichiklashtirish"
                    title="Kichik oynaga o'tish"
                    className="text-ink-muted hover:text-ink-main w-9 h-9 rounded-xl flex items-center justify-center hover:bg-bg border border-transparent hover:border-line transition-all"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Yopish"
                  title="Yopish (Esc)"
                  className="text-ink-muted hover:text-ink-main w-9 h-9 rounded-xl flex items-center justify-center hover:bg-bg border border-transparent hover:border-line transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </header>
          )}
          <main className="flex-1 p-6 sm:p-10 w-full max-w-5xl mx-auto flex flex-col">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'dialog-title' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`w-full ${widthClass} bg-surface rounded-card-lg shadow-2xl border border-line overflow-hidden animate-in zoom-in-95 ${className}`}
      >
        {(title || description) && (
          <div className="p-6 border-b border-line flex items-start justify-between">
            <div className="space-y-1">
              {title && (
                <h3 id="dialog-title" className="text-lg font-bold text-ink-main tracking-tight">
                  {title}
                </h3>
              )}
              {description && <p className="text-xs text-ink-muted">{description}</p>}
            </div>
            <div className="flex items-center gap-1">
              {allowFullscreenToggle && (
                <button
                  type="button"
                  onClick={() => setIsFullscreen(true)}
                  aria-label="Kattalashtirish"
                  title="To'liq ekranga o'tish"
                  className="text-ink-muted hover:text-ink-main w-8 h-8 rounded-lg flex items-center justify-center hover:bg-bg transition-colors"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Yopish"
                title="Yopish (Esc)"
                className="text-ink-muted hover:text-ink-main w-8 h-8 rounded-lg flex items-center justify-center hover:bg-bg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};
