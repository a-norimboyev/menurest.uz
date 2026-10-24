import React, { useState } from 'react';
import { Lock, Phone, LogIn, ShieldAlert, Sparkles } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [phone, setPhone] = useState('+998903333333');
  const [password, setPassword] = useState('Demo12345!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleLogin(e?: React.FormEvent, customPhone?: string) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const loginPhone = customPhone || phone;
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: loginPhone, password }),
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

  const demoAccounts = [
    { role: 'Manager', phone: '+998903333333', name: 'Bobur Rahimov' },
    { role: 'Boss', phone: '+998902222222', name: 'Alisher Usmonov' },
    { role: 'Cashier', phone: '+998904444444', name: 'Madina Karimova' },
    { role: 'Waiter', phone: '+998905555555', name: 'Jahongir Rustamov' },
    { role: 'Kitchen', phone: '+998906666666', name: 'Usta Shuhrat' },
    { role: 'Super Admin', phone: '+998901111111', name: 'Platforma Admini' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-brand-900 text-white p-6 relative">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center">
              <Lock className="w-5 h-5 text-brand-100" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Xodim Tizimiga Kirish</h2>
              <p className="text-xs text-brand-200">HttpOnly sessiya va RBAC vakolatlari</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-brand-300 hover:text-white text-lg font-semibold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Telefon Raqam</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Parol</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  required
                />
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
                  <span>Tizimga Kirish</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Tezkor Demo Kirish (1 marta bosishda):</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.phone}
                  type="button"
                  onClick={() => {
                    setPhone(acc.phone);
                    handleLogin(undefined, acc.phone);
                  }}
                  className="p-2 text-left bg-slate-50 hover:bg-brand-50 hover:border-brand-300 border border-slate-200 rounded-xl text-xs transition-colors"
                >
                  <div className="font-bold text-slate-800">{acc.role}</div>
                  <div className="text-[10px] text-slate-500 truncate">{acc.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
