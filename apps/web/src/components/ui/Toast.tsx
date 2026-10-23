import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  id?: string;
  type?: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  type = 'info',
  title,
  message,
  onClose,
}) => {
  const configs = {
    success: {
      bg: 'bg-surface border-brand',
      icon: <CheckCircle2 className="w-5 h-5 text-brand shrink-0" />,
      text: 'text-ink-main',
    },
    warning: {
      bg: 'bg-surface border-amber-500',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
      text: 'text-ink-main',
    },
    error: {
      bg: 'bg-surface border-red-500',
      icon: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />,
      text: 'text-ink-main',
    },
    info: {
      bg: 'bg-surface border-blue-500',
      icon: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
      text: 'text-ink-main',
    },
  }[type];

  return (
    <div
      role="status"
      className={`flex items-start gap-3 p-4 rounded-2xl border shadow-lg ${configs.bg} max-w-sm w-full transition-all`}
    >
      {configs.icon}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-ink-main">{title}</h4>
        {message && <p className="mt-1 text-xs text-ink-secondary leading-relaxed">{message}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-ink-secondary hover:text-ink-main hover:bg-bg transition-colors"
          aria-label="Yopish"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
