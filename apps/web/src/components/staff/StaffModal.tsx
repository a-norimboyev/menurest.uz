import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Briefcase,
  Users,
  CreditCard,
  Check,
} from 'lucide-react';
import { Dialog } from '../ui/Dialog.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Role } from '@menurest/shared';

export interface StaffFormData {
  id?: string;
  userId?: string;
  fullName: string;
  phone: string;
  password?: string;
  roles: Role[];
  customPermissions: string[];
  isActive: boolean;
  stationIds: string[];
  tableIds: string[];
}

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: StaffFormData) => Promise<void>;
  initialData?: StaffFormData | null;
  availableStations?: { id: string; name: string }[];
  availableTables?: { id: string; number: number }[];
  actorRoles?: Role[];
  allowedRoles?: string[];
}

const ROLE_CONFIG: Record<string, { label: string; icon: any; desc: string }> = {
  [Role.MANAGER]: { label: 'Menejer', icon: Briefcase, desc: 'Boshqaruv va nazorat' },
  [Role.CASHIER]: { label: 'Kassir', icon: CreditCard, desc: 'Hisob va to\'lovlar' },
  [Role.WAITER]: { label: 'Ofitsiant', icon: Users, desc: 'Stollar xizmati' },
};

export const StaffModal: React.FC<StaffModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  actorRoles: _actorRoles = [Role.MANAGER],
  allowedRoles,
}) => {
  const [formData, setFormData] = useState<StaffFormData>({
    fullName: '',
    phone: '',
    password: '',
    roles: [Role.WAITER],
    customPermissions: [],
    isActive: true,
    stationIds: [],
    tableIds: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const isEditing = Boolean(initialData?.id || initialData?.userId);

  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        userId: initialData.userId,
        fullName: initialData.fullName || '',
        phone: initialData.phone || '',
        password: initialData.password || '',
        roles: initialData.roles || [Role.WAITER],
        customPermissions: Array.isArray(initialData.customPermissions)
          ? initialData.customPermissions
          : [],
        isActive: initialData.isActive !== false,
        stationIds: initialData.stationIds || [],
        tableIds: initialData.tableIds || [],
      });
    } else {
      setFormData({
        fullName: '',
        phone: '',
        password: '',
        roles: [Role.WAITER],
        customPermissions: [],
        isActive: true,
        stationIds: [],
        tableIds: [],
      });
    }
    setError(null);
  }, [initialData, isOpen]);

  const handleRoleSelect = (role: Role) => {
    setFormData((prev) => ({
      ...prev,
      roles: [role],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.phone.trim()) {
      setError('Ism va telefon raqami to\'ldirilishi shart.');
      return;
    }
    if (!isEditing && !formData.password?.trim()) {
      setError('Yangi xodim uchun parol kiritilishi shart.');
      return;
    }
    if (formData.password?.trim() && formData.password.trim().length < 4) {
      setError('Parol kamida 4 ta belgidan iborat bo\'lishi kerak.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Xodimni saqlashda xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  const baseRoles: Role[] = [Role.MANAGER, Role.CASHIER, Role.WAITER];
  const selectableRoles: Role[] = allowedRoles && allowedRoles.length > 0
    ? baseRoles.filter((r) => allowedRoles.includes(r))
    : baseRoles;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Xodimni Tahrirlash' : 'Yangi Xodim Qo\'shish'}
      maxWidth="md"
    >
      <div className="space-y-4 pt-1">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-main mb-1">To'liq ismi *</label>
              <Input
                placeholder="Azizbek Rahimov"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-main mb-1">Telefon raqami *</label>
              <Input
                placeholder="+998901234567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-ink-main">
                Parol {isEditing ? "(ko'rish yoki o'zgartirish)" : '*'}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-brand hover:underline flex items-center gap-1 font-medium focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPassword ? "Parolni yashirish" : "Parolni ko'rish"}
              </button>
            </div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Kamida 4 ta belgi"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!isEditing}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-ink-muted hover:text-ink-main focus:outline-none p-1 rounded transition-colors"
                title={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4 text-brand" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-ink-secondary mt-1">
              {showPassword
                ? "Parol ochiq ko'rsatilmoqda. Yangi parol o'rnatish uchun bemalol o'zgartirishingiz mumkin."
                : "Ko'zcha belgisini bosib joriy parolni ko'rishingiz yoki yangi parol yozishingiz mumkin."}
            </p>
          </div>

          {/* Xodim Lavozimi */}
          <div className="space-y-2 pt-2 border-t border-line">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink-main">
                Lavozimi *
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {selectableRoles.map((role) => {
                const isSelected = formData.roles.includes(role);
                const conf = ROLE_CONFIG[role] || { label: role, icon: Users, desc: '' };
                const IconComponent = conf.icon;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleRoleSelect(role)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[56px] relative ${
                      isSelected
                        ? 'bg-brand/10 border-brand text-brand ring-1 ring-brand/30'
                        : 'bg-bg text-ink-secondary border-line hover:border-brand/40 hover:bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <IconComponent className={`w-4 h-4 ${isSelected ? 'text-brand' : 'text-ink-muted'}`} />
                      {isSelected && <Check className="w-3.5 h-3.5 text-brand" />}
                    </div>
                    <span className={`text-xs font-bold mt-1.5 block ${isSelected ? 'text-brand' : 'text-ink-main'}`}>
                      {conf.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-line flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saqlanmoqda...' : isEditing ? 'O\'zgarishlarni Saqlash' : 'Xodimni Yaratish'}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
};
