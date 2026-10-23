import React from 'react';

export interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', size = 'md', children, className = '' }) => {
  const styles = {
    // High contrast for WCAG AA/AAA
    success: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    warning: 'bg-amber-50 text-amber-900 border-amber-300',
    danger: 'bg-red-50 text-red-900 border-red-300',
    info: 'bg-blue-50 text-blue-900 border-blue-300',
    neutral: 'bg-slate-100 text-slate-800 border-slate-300',
  }[variant];

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${sizeStyles} ${styles} ${className}`}
    >
      {children}
    </span>
  );
};
