import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button.tsx';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div className={`p-8 text-center flex flex-col items-center justify-center space-y-3 ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-bg border border-line flex items-center justify-center text-ink-muted">
        {icon || <Inbox className="w-7 h-7" />}
      </div>
      <div className="space-y-1 max-w-sm">
        <h4 className="font-bold text-base text-ink-main">{title}</h4>
        {description && <p className="text-xs text-ink-muted leading-relaxed">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
