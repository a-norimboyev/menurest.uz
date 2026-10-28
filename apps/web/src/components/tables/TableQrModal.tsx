import React, { useState } from 'react';
import { Printer, RefreshCw, CheckCircle2, Download, Edit2 } from 'lucide-react';
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

  // So'zlarni tahrirlash holati
  const [isEditingText, setIsEditingText] = useState(false);
  const [instructions, setInstructions] = useState('Kamerangiz bilan skanerlang');
  const [subInstructions, setSubInstructions] = useState("Menyuni ko'rish va ofitsiantni chaqirish uchun");
  const [customNote, setCustomNote] = useState('');

  if (!table) return null;

  const qrImageUrl = `/api/v1/restaurants/${restaurantId}/tables/${table.id}/qr?format=png`;

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
            .custom-note {
              margin-top: 10px;
              font-size: 13px;
              font-weight: 700;
              color: #0F5C3C;
              background: #F0FDF4;
              border: 1.5px solid #BBF7D0;
              border-radius: 12px;
              padding: 8px 12px;
              display: inline-block;
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
            <div class="qr-wrapper">
              <img class="qr-img" src="${fullQrUrl}" alt="QR" />
            </div>
            ${instructions ? `<div class="instructions">${instructions}</div>` : ''}
            ${subInstructions ? `<div class="sub-instructions">${subInstructions}</div>` : ''}
            ${customNote ? `<div class="custom-note">${customNote}</div>` : ''}
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
          </div>

          <div className="flex justify-center p-3 bg-white rounded-2xl border border-line shadow-inner inline-block mx-auto">
            <img
              src={qrImageUrl}
              alt={`QR Kod Stol #${table.number}`}
              className="w-48 h-48 object-contain"
            />
          </div>

          <div className="space-y-1">
            {instructions && (
              <p className="text-xs font-bold text-ink-main">
                {instructions}
              </p>
            )}
            {subInstructions && (
              <p className="text-[11px] text-ink-muted">
                {subInstructions}
              </p>
            )}
            {customNote && (
              <div className="pt-1.5">
                <span className="inline-block text-[11px] font-bold text-brand bg-brand-50 border border-brand/20 px-3 py-1 rounded-lg">
                  {customNote}
                </span>
              </div>
            )}
          </div>
        </div>

        {regeneratedMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>QR kod muvaffaqiyatli yangilandi. Yangi kodni chop eting!</span>
          </div>
        )}

        {/* So'zlarni tahrirlash paneli */}
        {isEditingText && (
          <div className="p-3.5 bg-bg rounded-2xl border border-line space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-1 border-b border-line">
              <span className="text-xs font-bold text-ink-main">Matnlarni tahrirlash</span>
              <button
                type="button"
                onClick={() => {
                  setInstructions('Kamerangiz bilan skanerlang');
                  setSubInstructions("Menyuni ko'rish va ofitsiantni chaqirish uchun");
                  setCustomNote('');
                }}
                className="text-[11px] text-brand hover:underline font-semibold"
              >
                Standartga qaytarish
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-ink-secondary block">Asosiy sarlavha</label>
              <input
                type="text"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Kamerangiz bilan skanerlang"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-line bg-surface text-ink-main focus:outline-none focus:ring-1 focus:ring-brand font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-ink-secondary block">Quyi izoh</label>
              <input
                type="text"
                value={subInstructions}
                onChange={(e) => setSubInstructions(e.target.value)}
                placeholder="Menyuni ko'rish va ofitsiantni chaqirish uchun"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-line bg-surface text-ink-main focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-ink-secondary block">
                Qo'shimcha matn (masalan: Wi-Fi paroli yoki tilak)
              </label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="Masalan: Wi-Fi: Qaldirg'och | Parol: 12345678"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-line bg-surface text-ink-main focus:outline-none focus:ring-1 focus:ring-brand font-medium"
              />
            </div>
          </div>
        )}

        {/* Tugmalar */}
        <div className="space-y-2 pt-1">
          <Button
            variant="outline"
            onClick={() => setIsEditingText(!isEditingText)}
            className="w-full justify-center text-xs font-semibold"
          >
            <Edit2 className="w-3.5 h-3.5 mr-2 text-brand" />
            {isEditingText ? "Tahrirlashni yopish" : "So'zlarni tahrirlash"}
          </Button>

          <Button variant="primary" onClick={handlePrint} className="w-full justify-center">
            <Printer className="w-4 h-4 mr-2" />
            Chop etish
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
