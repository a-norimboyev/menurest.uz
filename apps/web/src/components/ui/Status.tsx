import React from 'react';
import { Badge } from './Badge.tsx';

export interface StatusProps {
  type: 'table' | 'item' | 'order' | 'visit' | 'shift';
  value: string;
}

export const Status: React.FC<StatusProps> = ({ type, value }) => {
  let label = value;
  let variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' = 'neutral';
  let dotColor = 'bg-slate-400';

  if (type === 'table') {
    switch (value) {
      case 'OCCUPIED':
        label = 'Faol (Band)';
        variant = 'success';
        dotColor = 'bg-emerald-500 animate-pulse';
        break;
      case 'FREE':
      case 'DIRTY':
      default:
        label = "Bo'sh (Buyurtma yo'q)";
        variant = 'neutral';
        dotColor = 'bg-slate-400';
        break;
    }
  } else if (type === 'item') {
    switch (value) {
      case 'PENDING':
        label = 'Kutilmoqda';
        variant = 'warning';
        dotColor = 'bg-amber-500';
        break;
      case 'ACCEPTED':
        label = 'Qabul qilindi';
        variant = 'info';
        dotColor = 'bg-blue-500';
        break;
      case 'PREPARING':
        label = 'Pishirilmoqda';
        variant = 'info';
        dotColor = 'bg-blue-500 animate-pulse';
        break;
      case 'READY':
        label = 'Tayyor';
        variant = 'success';
        dotColor = 'bg-emerald-500';
        break;
      case 'SERVED':
        label = 'Yetkazildi';
        variant = 'neutral';
        dotColor = 'bg-slate-500';
        break;
      case 'CANCELLED':
        label = 'Bekor qilindi';
        variant = 'danger';
        dotColor = 'bg-red-500';
        break;
    }
  } else if (type === 'order') {
    switch (value) {
      case 'NEW':
        label = 'Yangi buyurtma';
        variant = 'warning';
        dotColor = 'bg-amber-500';
        break;
      case 'CONFIRMED':
        label = 'Tasdiqlandi';
        variant = 'info';
        dotColor = 'bg-blue-500';
        break;
      case 'PREPARING':
        label = 'Tayyorlanmoqda';
        variant = 'info';
        dotColor = 'bg-blue-500 animate-pulse';
        break;
      case 'PARTIALLY_READY':
        label = 'Qisman tayyor';
        variant = 'warning';
        dotColor = 'bg-amber-500';
        break;
      case 'READY':
        label = 'Tayyor';
        variant = 'success';
        dotColor = 'bg-emerald-500';
        break;
      case 'PARTIALLY_SERVED':
        label = 'Qisman berildi';
        variant = 'info';
        dotColor = 'bg-blue-500';
        break;
      case 'SERVED':
        label = 'Yetkazib bo\'lindi';
        variant = 'neutral';
        dotColor = 'bg-slate-500';
        break;
      case 'CANCELLED':
        label = 'Bekor qilingan';
        variant = 'danger';
        dotColor = 'bg-red-500';
        break;
    }
  } else if (type === 'visit') {
    switch (value) {
      case 'ACTIVE':
        label = 'Faol tashrif';
        variant = 'success';
        dotColor = 'bg-emerald-500';
        break;
      case 'CLOSED':
        label = 'Yopilgan';
        variant = 'neutral';
        dotColor = 'bg-slate-400';
        break;
    }
  } else if (type === 'shift') {
    switch (value) {
      case 'OPEN':
        label = 'Ochiq smena';
        variant = 'success';
        dotColor = 'bg-emerald-500';
        break;
      case 'CLOSED':
        label = 'Yopilgan';
        variant = 'neutral';
        dotColor = 'bg-slate-400';
        break;
    }
  }

  return (
    <Badge variant={variant}>
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </Badge>
  );
};
