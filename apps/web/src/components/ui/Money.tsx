import React from 'react';
import { formatMoneyUzs } from '@menurest/shared';

export interface MoneyProps {
  amountTiyin: bigint | number | string;
  className?: string;
}

export const Money: React.FC<MoneyProps> = ({ amountTiyin, className = '' }) => {
  return <span className={`font-semibold tracking-tight font-mono ${className}`}>{formatMoneyUzs(amountTiyin)}</span>;
};
