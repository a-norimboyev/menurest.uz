import { WifiOff, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import type { ConnectionStatus } from '../../hooks/useRealtime.ts';

interface ConnectionBannerProps {
  status: ConnectionStatus;
  onManualRefresh?: () => void;
}

export function ConnectionBanner({
  status,
  onManualRefresh,
}: ConnectionBannerProps) {
  if (status === 'CONNECTED') {
    return null;
  }

  return (
    <div className="w-full">
      {/* Offline Alert Bar */}
      {status === 'DISCONNECTED' && (
        <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm font-medium shadow-md transition-all animate-pulse">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Ulanish uzildi, holat yangilanmayapti. Qayta ulanish kutilmoqda...</span>
          </div>
          {onManualRefresh && (
            <button
              onClick={onManualRefresh}
              className="ml-3 px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Yangilash
            </button>
          )}
        </div>
      )}

      {/* Connecting status bar */}
      {status === 'CONNECTING' && (
        <div className="bg-amber-600 text-white px-4 py-1.5 flex items-center justify-between text-xs font-medium shadow-sm">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Serverga jonli ulanish o'rnatilmoqda...</span>
          </div>
        </div>
      )}
    </div>
  );
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
            ? 'Jonli ulanish faol (SSE)'
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
        title={soundEnabled ? 'Ovozli bildirishnomalar yoqilgan' : 'Ovozli bildirishnomalar o\'chirilgan (yoqish uchun bosing)'}
      >
        {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
