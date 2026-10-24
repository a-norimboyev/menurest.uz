import React, { useState } from 'react';
import { Printer, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
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
    window.print();
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`Stol #${table.number} — QR Kod`} maxWidth="sm">
      <div className="space-y-6">
        {/* Chop etishga mo'ljallangan karta */}
        <div
          id="printable-qr-card"
          className="bg-white border-2 border-brand/20 p-6 rounded-2xl text-center space-y-4 shadow-sm"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-brand uppercase tracking-widest">
              {restaurantName || 'MENUREST.UZ'}
            </span>
            <h2 className="text-2xl font-black text-ink-main tracking-tight">
              Stol #{table.number}
            </h2>
            {table.hallName && (
              <p className="text-xs text-ink-muted font-medium">{table.hallName}</p>
            )}
          </div>

          <div className="flex justify-center p-2 bg-white rounded-xl border border-line">
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
              Menyuni ko'rish va ofitsiantni chaqirish uchun QR kodni skanerlang
            </p>
          </div>
        </div>

        {regeneratedMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>QR kod muvaffaqiyatli yangilandi. Yangi kodni chop eting!</span>
          </div>
        )}

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <span>
            QR havola ommaviy xavfsiz identifikatorga ega. Faol tashrif siri yoki kodi QR kodga kiritilmaydi.
          </span>
        </div>

        {/* Tugmalar */}
        <div className="flex flex-col gap-2 pt-2">
          <Button variant="primary" onClick={handlePrint} className="w-full justify-center">
            <Printer className="w-4 h-4 mr-2" />
            Chop etish (Print)
          </Button>

          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="w-full justify-center text-xs text-amber-800 border-amber-300 hover:bg-amber-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
            Yangi QR kod generatsiya qilish
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
