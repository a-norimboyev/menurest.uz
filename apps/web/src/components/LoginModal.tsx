import React, { useState, useEffect } from 'react';
import { Lock, Phone, LogIn, ShieldAlert, Eye, EyeOff, X } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.ts';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  useBodyScrollLock(isOpen);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPhone('');
      setPassword('');
      setShowPassword(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleLogin(e?: React.FormEvent, customPhone?: string, customPassword?: string) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const loginPhone = customPhone || phone;
    const loginPassword = customPassword !== undefined ? customPassword : password;

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: loginPhone, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Kirishda xatolik yuz berdi');
      }
      onSuccess(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Serverga ulanishda xatolik');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-in fade-in overscroll-contain overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-brand-900 text-white p-6 relative">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center">
              <Lock className="w-5 h-5 text-brand-100" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Tizimga Kirish</h2>
              <p className="text-xs text-brand-200">Restoran yoki platforma boshqaruv kabineti</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-brand-300 hover:text-white transition-colors"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Telefon raqam</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Parol</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Parolni kiriting"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none p-0.5 rounded transition-colors"
                  title={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-700 hover:bg-brand-800 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <span className="text-xs">Tekshirilmoqda...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Kirish</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo: Qaldirg'och milliy taomlari (4 Oylik Tarixga ega Restoran) */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <img src="/qaldirgoch-logo.png" alt="Qaldirg'och" className="w-4 h-4 rounded-full object-cover" />
                Qaldirg'och milliy taomlari
              </span>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                1-bosishda kirish
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setPhone('+998911000002');
                  setPassword('+998911000002');
                  handleLogin(undefined, '+998911000002', '+998911000002');
                }}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-left transition-all flex flex-col"
              >
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Menejer
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">+998 91 100 00 02</span>
                <span className="text-[9px] text-emerald-700 font-medium mt-0.5">Parol: bir xil</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPhone('+998911000003');
                  setPassword('+998911000003');
                  handleLogin(undefined, '+998911000003', '+998911000003');
                }}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 text-left transition-all flex flex-col"
              >
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Kassir
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">+998 91 100 00 03</span>
                <span className="text-[9px] text-amber-700 font-medium mt-0.5">Parol: bir xil</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPhone('+998911000004');
                  setPassword('+998911000004');
                  handleLogin(undefined, '+998911000004', '+998911000004');
                }}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 text-left transition-all flex flex-col"
              >
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  1-Ofitsiant (Sardor)
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">+998 91 100 00 04</span>
                <span className="text-[9px] text-blue-700 font-medium mt-0.5">Parol: bir xil</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPhone('+998911000005');
                  setPassword('+998911000005');
                  handleLogin(undefined, '+998911000005', '+998911000005');
                }}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 text-left transition-all flex flex-col"
              >
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  2-Ofitsiant (Malika)
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">+998 91 100 00 05</span>
                <span className="text-[9px] text-sky-700 font-medium mt-0.5">Parol: bir xil</span>
              </button>
            </div>

            {/* Platform Super Admin */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setPhone('+998901111111');
                  setPassword('+998901111111');
                  handleLogin(undefined, '+998901111111', '+998901111111');
                }}
                className="w-full p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 hover:border-purple-300 border border-purple-200 text-left transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  <span className="font-bold text-purple-950 text-xs">Platforma Super Admini</span>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-purple-700 font-mono">+998 90 111 11 11</div>
                  <div className="text-[9px] text-purple-600 font-medium">Parol: bir xil</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
