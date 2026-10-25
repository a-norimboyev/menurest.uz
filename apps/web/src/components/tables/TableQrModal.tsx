import React, { useState } from 'react';
import { Printer, RefreshCw, AlertCircle, CheckCircle2, Download, Copy, Check, ExternalLink } from 'lucide-react';
import { Dialog } from '../ui/Dialog.tsx';
import { Button } from '../ui/Button.tsx';

interface TableQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: {
    id: string;
    number: number;
    hallName?: string;
    capacity: number;
    qrToken: string;
  } | null;
  restaurantId: string;
  restaurantName: string;
  onQrRegenerated?: (tableId: string, newQrToken: string) => void;
}

export const TableQrModal: React.FC<TableQrModalProps> = ({
  isOpen,
  onClose,
  table,
  restaurantId,
  restaurantName,
  onQrRegenerated,
}) => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratedMsg, setRegeneratedMsg] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!table) return null;

  const qrImageUrl = `/api/v1/restaurants/${restaurantId}/tables/${table.id}/qr?format=png`;
  const guestMenuUrl = typeof window !== 'undefined' ? `${window.location.origin}/table/${table.qrToken}` : '';

  async function handleRegenerate() {
    if (
      !window.confirm(
        'Haqiqatan ham ushbu stolning QR kodini yangilamoqchimisiz? Stol ustiga avval chop etilgan eski QR kod bekor qilinadi va yangisini chop etish kerak bo\'ladi!'
      )
    ) {
      return;
    }

    try {
      setIsRegenerating(true);
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/tables/${table!.id}/regenerate-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (json.success && json.data?.qrToken) {
        onQrRegenerated?.(table!.id, json.data.qrToken);
        setRegeneratedMsg(true);
        setTimeout(() => setRegeneratedMsg(false), 3000);
      }
    } catch (err) {
      console.error('QR yangilashda xatolik:', err);
    } finally {
      setIsRegenerating(false);
    }
  }

  function handlePrint() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    const fullQrUrl = window.location.origin + qrImageUrl;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${restaurantName || 'MenuRest'} - Stol #${table?.number} QR</title>
          <style>
            @page { size: auto; margin: 10mm; }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 90vh;
              margin: 0;
              background: #fff;
              color: #111827;
            }
            .card {
              border: 3px solid #0F5C3C;
              border-radius: 24px;
              padding: 32px 24px;
              text-align: center;
              max-width: 320px;
              width: 100%;
              box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            }
            .brand {
              color: #0F5C3C;
              font-size: 13px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 2.5px;
              margin-bottom: 4px;
            }
            .table-num {
              font-size: 34px;
              font-weight: 900;
              margin: 4px 0 8px 0;
              color: #0F5C3C;
            }
            .hall {
              font-size: 13px;
              font-weight: 600;
              color: #6b7280;
              margin-bottom: 16px;
            }
            .qr-wrapper {
              background: #fff;
              border: 1.5px solid #e5e7eb;
              border-radius: 20px;
              padding: 12px;
              display: inline-block;
              margin-bottom: 16px;
            }
            .qr-img {
              width: 200px;
              height: 200px;
              display: block;
            }
            .instructions {
              font-size: 15px;
              font-weight: 700;
              color: #111827;
              margin-bottom: 4px;
            }
            .sub-instructions {
              font-size: 11px;
              color: #6b7280;
              line-height: 1.4;
            }
            .powered-by {
              margin-top: 16px;
              font-size: 10px;
              color: #9ca3af;
              font-weight: 600;
              letter-spacing: 1px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="brand">${restaurantName || 'MENUREST.UZ'}</div>
            <div class="table-num">STOL #${table?.number}</div>
            ${table?.hallName ? `<div class="hall">${table.hallName}</div>` : ''}
            <div class="qr-wrapper">
              <img class="qr-img" src="${fullQrUrl}" alt="QR" />
            </div>
            <div class="instructions">Kamerangiz bilan skanerlang</div>
            <div class="sub-instructions">Taomlar menyusini ko'rish va ofitsiantni chaqirish uchun</div>
            <div class="powered-by">menurest.uz • aqlli restoran</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 1000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(guestMenuUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`Stol #${table.number} — QR Kod`} maxWidth="sm">
      <div className="space-y-5">
        {/* Chop etishga mo'ljallangan karta */}
        <div
          id="printable-qr-card"
          className="bg-white border-2 border-brand/20 p-6 rounded-2xl text-center space-y-3 shadow-sm"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-brand uppercase tracking-widest">
              {restaurantName || 'MENUREST.UZ'}
            </span>
            <h2 className="text-3xl font-black text-ink-main tracking-tight">
              Stol #{table.number}
            </h2>
            {table.hallName && (
              <p className="text-xs text-ink-muted font-medium">{table.hallName}</p>
            )}
          </div>

          <div className="flex justify-center p-3 bg-white rounded-2xl border border-line shadow-inner inline-block mx-auto">
            <img
              src={qrImageUrl}
              alt={`QR Kod Stol #${table.number}`}
              className="w-48 h-48 object-contain"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-ink-main">
              Kamerangiz bilan skanerlang
            </p>
            <p className="text-[11px] text-ink-muted">
              Menyuni ko'rish va ofitsiantni chaqirish uchun
            </p>
          </div>
        </div>

        {/* Tezkor Havola va Nusxa olish */}
        <div className="p-3 rounded-xl bg-bg border border-line space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink-secondary">Mehmon menyusi havolasi:</span>
            <a
              href={guestMenuUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline flex items-center gap-1 font-bold"
            >
              Ochish <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={guestMenuUrl}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-line bg-surface text-xs font-mono text-ink-secondary truncate select-all"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
              className="shrink-0 text-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? "Nusxalandi" : "Nusxalash"}
            </Button>
          </div>
        </div>

        {regeneratedMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>QR kod muvaffaqiyatli yangilandi. Yangi kodni chop eting!</span>
          </div>
        )}

        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <span>
            QR havola ommaviy xavfsiz identifikatorga ega. Ushbu QR kodni stol ustiga stiker qilib yopishtirish mumkin.
          </span>
        </div>

        {/* Tugmalar */}
        <div className="space-y-2 pt-1">
          <Button variant="primary" onClick={handlePrint} className="w-full justify-center">
            <Printer className="w-4 h-4 mr-2" />
            Chop etish (Print)
          </Button>

          <a
            href={qrImageUrl}
            download={`stol-${table.number}-qr.png`}
            className="w-full py-2 px-3 rounded-xl border border-line bg-surface hover:bg-bg text-xs font-semibold text-ink-main flex items-center justify-center gap-1.5 transition-colors min-h-[38px]"
          >
            <Download className="w-4 h-4 text-brand" />
            <span>PNG formatida yuklab olish</span>
          </a>

          <Button
            variant="ghost"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="w-full justify-center text-xs text-ink-secondary hover:text-amber-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            Yangi QR kod generatsiya qilish
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
