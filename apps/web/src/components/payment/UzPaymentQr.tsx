import React, { useState } from 'react';
import { Copy, Check, Smartphone, ShieldCheck } from 'lucide-react';
import { Money } from '../ui/Money.tsx';

interface UzPaymentQrProps {
  amountTiyin: bigint | string;
  tableNumber?: number;
  visitId?: string;
  onPaymentConfirmed?: () => void;
  className?: string;
}

export const UzPaymentQr: React.FC<UzPaymentQrProps> = ({
  amountTiyin,
  tableNumber,
  visitId,
  onPaymentConfirmed,
  className = '',
}) => {
  const [provider, setProvider] = useState<'click' | 'payme'>('click');
  const [copied, setCopied] = useState(false);

  const amountBigInt = typeof amountTiyin === 'string' ? BigInt(amountTiyin) : amountTiyin;
  const amountUzs = Number(amountBigInt / 100n);

  const clickLink = `https://my.click.uz/services/pay?service_id=menurest&amount=${amountUzs}&table=${tableNumber || ''}${visitId ? `&visit=${visitId}` : ''}`;
  const paymeLink = `https://checkout.paycom.uz/menurest/${amountUzs}?table=${tableNumber || ''}${visitId ? `&visit=${visitId}` : ''}`;

  const currentLink = provider === 'click' ? clickLink : paymeLink;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`bg-surface rounded-2xl border border-line p-4 space-y-4 shadow-sm ${className}`}>
      {/* Provider Selector Tabs */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-bg rounded-xl border border-line">
        <button
          type="button"
          onClick={() => setProvider('click')}
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            provider === 'click'
              ? 'bg-[#00aaff] text-white shadow-sm'
              : 'text-ink-secondary hover:text-ink-main'
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white/90" />
          <span>CLICK</span>
        </button>
        <button
          type="button"
          onClick={() => setProvider('payme')}
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            provider === 'payme'
              ? 'bg-[#00cccc] text-white shadow-sm'
              : 'text-ink-secondary hover:text-ink-main'
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white/90" />
          <span>PAYME</span>
        </button>
      </div>

      {/* QR Code Presentation Box */}
      <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border-2 border-dashed border-gray-200 relative overflow-hidden">
        {/* Top Provider Badge */}
        <div className="mb-2 flex items-center gap-1.5 text-xs font-black">
          {provider === 'click' ? (
            <span className="text-[#0088cc] uppercase tracking-wider font-extrabold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#00aaff] animate-ping" />
              Click Pass / QR
            </span>
          ) : (
            <span className="text-[#00a896] uppercase tracking-wider font-extrabold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#00cccc] animate-ping" />
              Payme Go / QR
            </span>
          )}
        </div>

        {/* Dynamic Stylized QR Code SVG */}
        <div className="p-3 bg-white rounded-xl shadow-md border border-gray-100 relative group">
          <svg
            className="w-44 h-44 sm:w-48 sm:h-48"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background */}
            <rect width="200" height="200" fill="white" rx="8" />

            {/* Corner Finder 1: Top-Left */}
            <rect x="15" y="15" width="45" height="45" rx="6" stroke="#111827" strokeWidth="6" />
            <rect x="25" y="25" width="25" height="25" rx="3" fill="#111827" />

            {/* Corner Finder 2: Top-Right */}
            <rect x="140" y="15" width="45" height="45" rx="6" stroke="#111827" strokeWidth="6" />
            <rect x="150" y="25" width="25" height="25" rx="3" fill="#111827" />

            {/* Corner Finder 3: Bottom-Left */}
            <rect x="15" y="140" width="45" height="45" rx="6" stroke="#111827" strokeWidth="6" />
            <rect x="25" y="150" width="25" height="25" rx="3" fill="#111827" />

            {/* Stylized QR Matrix Dots */}
            {/* Top row elements */}
            <rect x="70" y="18" width="8" height="8" rx="2" fill="#111827" />
            <rect x="85" y="18" width="8" height="8" rx="2" fill="#111827" />
            <rect x="100" y="18" width="8" height="8" rx="2" fill="#111827" />
            <rect x="115" y="18" width="8" height="8" rx="2" fill="#111827" />
            <rect x="70" y="32" width="8" height="8" rx="2" fill="#111827" />
            <rect x="100" y="32" width="8" height="8" rx="2" fill="#111827" />
            <rect x="120" y="45" width="8" height="8" rx="2" fill="#111827" />
            <rect x="80" y="45" width="8" height="8" rx="2" fill="#111827" />

            {/* Middle columns */}
            <rect x="18" y="70" width="8" height="8" rx="2" fill="#111827" />
            <rect x="35" y="70" width="8" height="8" rx="2" fill="#111827" />
            <rect x="48" y="85" width="8" height="8" rx="2" fill="#111827" />
            <rect x="18" y="100" width="8" height="8" rx="2" fill="#111827" />
            <rect x="35" y="115" width="8" height="8" rx="2" fill="#111827" />
            <rect x="48" y="115" width="8" height="8" rx="2" fill="#111827" />

            {/* Right side dots */}
            <rect x="140" y="70" width="8" height="8" rx="2" fill="#111827" />
            <rect x="155" y="85" width="8" height="8" rx="2" fill="#111827" />
            <rect x="172" y="70" width="8" height="8" rx="2" fill="#111827" />
            <rect x="140" y="100" width="8" height="8" rx="2" fill="#111827" />
            <rect x="172" y="100" width="8" height="8" rx="2" fill="#111827" />
            <rect x="155" y="115" width="8" height="8" rx="2" fill="#111827" />
            <rect x="172" y="130" width="8" height="8" rx="2" fill="#111827" />
            <rect x="140" y="145" width="8" height="8" rx="2" fill="#111827" />
            <rect x="155" y="160" width="8" height="8" rx="2" fill="#111827" />
            <rect x="172" y="172" width="8" height="8" rx="2" fill="#111827" />

            {/* Bottom dots */}
            <rect x="70" y="140" width="8" height="8" rx="2" fill="#111827" />
            <rect x="85" y="155" width="8" height="8" rx="2" fill="#111827" />
            <rect x="100" y="140" width="8" height="8" rx="2" fill="#111827" />
            <rect x="115" y="160" width="8" height="8" rx="2" fill="#111827" />
            <rect x="70" y="172" width="8" height="8" rx="2" fill="#111827" />
            <rect x="100" y="172" width="8" height="8" rx="2" fill="#111827" />

            {/* Center Logo Cutout & Badge */}
            <rect
              x="68"
              y="68"
              width="64"
              height="64"
              rx="12"
              fill={provider === 'click' ? '#00aaff' : '#00cccc'}
              stroke="white"
              strokeWidth="4"
            />
            {provider === 'click' ? (
              <text
                x="100"
                y="106"
                textAnchor="middle"
                fill="white"
                fontFamily="sans-serif"
                fontWeight="900"
                fontSize="16"
                letterSpacing="1"
              >
                CLICK
              </text>
            ) : (
              <text
                x="100"
                y="106"
                textAnchor="middle"
                fill="white"
                fontFamily="sans-serif"
                fontWeight="900"
                fontSize="15"
                letterSpacing="1"
              >
                PAYME
              </text>
            )}
          </svg>
        </div>

        {/* Amount Pill */}
        <div className="mt-3 text-center space-y-0.5">
          <div className="text-[11px] text-gray-500 font-medium">To'lanadigan summa:</div>
          <Money
            amountTiyin={amountBigInt}
            className="text-base font-extrabold text-gray-900 tracking-tight"
          />
          {tableNumber && (
            <div className="text-[10px] text-gray-400">Stol #{tableNumber}</div>
          )}
        </div>
      </div>

      {/* Helper & Copy Link */}
      <div className="flex items-center justify-between text-xs text-ink-secondary bg-bg p-2.5 rounded-xl border border-line">
        <div className="flex items-center gap-1.5 truncate">
          <Smartphone className="w-4 h-4 text-brand shrink-0" />
          <span className="truncate">
            {provider === 'click' ? 'Click Up yoki kamera bilan oling' : 'Payme Go orqali to\'lang'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          className="p-1 text-ink-muted hover:text-brand transition-colors shrink-0 flex items-center gap-1 font-semibold text-[11px]"
          title="Havolani nusxalash"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700">Nusxalandi</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Nusxa</span>
            </>
          )}
        </button>
      </div>

      {/* Confirmation Action Button */}
      {onPaymentConfirmed && (
        <button
          type="button"
          onClick={onPaymentConfirmed}
          className={`w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98] ${
            provider === 'click'
              ? 'bg-[#0099e6] hover:bg-[#0088cc]'
              : 'bg-[#00b39b] hover:bg-[#009e89]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Mijoz QR orqali to'ladi (Tasdiqlash)</span>
        </button>
      )}
    </div>
  );
};
