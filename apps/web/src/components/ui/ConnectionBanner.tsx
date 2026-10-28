import { Volume2, VolumeX } from 'lucide-react';
import type { ConnectionStatus } from '../../hooks/useRealtime.ts';

interface ConnectionBannerProps {
  status: ConnectionStatus;
  onManualRefresh?: () => void;
}

export function ConnectionBanner({
  status: _status,
  onManualRefresh: _onManualRefresh,
}: ConnectionBannerProps) {
  return null;
}

export function RealtimeIndicatorPill({
  status,
  soundEnabled,
  onToggleSound,
}: {
  status: ConnectionStatus;
  soundEnabled: boolean;
  onToggleSound: () => void;
}) {
  return (
    <div className="flex items-center space-x-2">
      {/* Status dot */}
      <div
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
          status === 'CONNECTED'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : status === 'CONNECTING'
            ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
            : 'bg-red-50 text-red-800 border-red-200'
        }`}
        title={
          status === 'CONNECTED'
            ? 'Jonli ulanish faol'
            : status === 'CONNECTING'
            ? 'Ulanmoqda...'
            : 'Ulanish uzildi'
        }
      >
        <span
          className={`w-2 h-2 rounded-full ${
            status === 'CONNECTED'
              ? 'bg-emerald-500'
              : status === 'CONNECTING'
              ? 'bg-amber-500'
              : 'bg-red-500'
          }`}
        />
        <span className="hidden sm:inline">
          {status === 'CONNECTED' ? 'JONLI' : status === 'CONNECTING' ? 'ULANMOQDA' : 'UZILDI'}
        </span>
      </div>

      {/* Sound Toggle Button */}
      <button
        onClick={onToggleSound}
        className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center justify-center ${
          soundEnabled
            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
            : 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200'
        }`}
        title={soundEnabled ? 'Ovozli bildirishnomalar yoqilgan' : 'Ovozli bildirishnomalar o\'chirilgan, yoqish uchun bosing'}
      >
        {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
