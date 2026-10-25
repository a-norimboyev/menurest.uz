import React, { useState } from 'react';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Dialog } from './ui/Dialog.tsx';
import { Button } from './ui/Button.tsx';
import { Input } from './ui/Input.tsx';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)menurest_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!oldPassword) {
      setError('Eski parolingizni kiriting.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Yangi parol va tasdiqlovchi parol bir-biriga mos kelmadi.');
      return;
    }

    if (oldPassword === newPassword) {
      setError('Yangi parol eski parol bilan bir xil bo\'lishi mumkin emas.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Parolni o\'zgartirishda xatolik yuz berdi');
      }

      setSuccess('Parolingiz muvaffaqiyatli yangilandi! Tizim yangi parolni eslab qoldi.');
      setTimeout(() => {
        handleClose();
        if (onSuccess) {
          onSuccess();
        } else {
          // Parol o'zgargach sessiya tozalanishi mumkin, sahifani yangilaymiz
          window.location.reload();
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Serverga ulanishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Parolni O'zgartirish"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div className="flex items-center gap-3 p-3 bg-brand/5 border border-brand/20 rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <p className="text-xs text-ink-secondary leading-relaxed">
            Hisobingiz xavfsizligi uchun kuchli parol tanlang. Parolingiz yangilangach, barcha faol qurilmalarda qayta kirish talab qilinishi mumkin.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Eski Parol */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-ink-main flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-ink-secondary" />
            Hozirgi (Eski) Parol *
          </label>
          <div className="relative">
            <Input
              type={showOld ? 'text' : 'password'}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Amaldagi parolingizni kiriting"
              className="pr-10 text-sm font-mono"
              required
            />
            <button
              type="button"
              onClick={() => setShowOld(!showOld)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary hover:text-ink-main p-1"
            >
              {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Yangi Parol */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-ink-main flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-brand" />
            Yangi Parol *
          </label>
          <div className="relative">
            <Input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Kamida 6 ta belgi"
              className="pr-10 text-sm font-mono"
              required
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary hover:text-ink-main p-1"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Yangi Parolni Takrorlash */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-ink-main flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-brand" />
            Yangi Parolni Tasdiqlang *
          </label>
          <div className="relative">
            <Input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Yangi parolni qayta kiriting"
              className="pr-10 text-sm font-mono"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary hover:text-ink-main p-1"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="primary" disabled={loading} className="gap-1.5">
            <KeyRound className="w-4 h-4" />
            <span>{loading ? 'Saqlanmoqda...' : 'Parolni Yangilash'}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
