import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Crown,
  Briefcase,
  ChefHat,
  Users,
  Sparkles,
  Lightbulb,
} from 'lucide-react';
import { Dialog } from '../ui/Dialog.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Role, type Permission } from '@menurest/shared';

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

export const StaffModal: React.FC<StaffModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  availableStations = [],
  availableTables = [],
  actorRoles = [Role.BOSS],
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
        password: '',
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

  const handleRoleToggle = (role: Role) => {
    setFormData((prev) => {
      const exists = prev.roles.includes(role);
      let updated: Role[];
      if (exists) {
        if (prev.roles.length === 1) return prev; // kamida 1 ta rol qolishi kerak
        updated = prev.roles.filter((r) => r !== role);
      } else {
        updated = [...prev.roles, role];
      }
      return { ...prev, roles: updated };
    });
  };

  const handleStationToggle = (stationId: string) => {
    setFormData((prev) => {
      const exists = prev.stationIds.includes(stationId);
      const stationIds = exists
        ? prev.stationIds.filter((id) => id !== stationId)
        : [...prev.stationIds, stationId];
      return { ...prev, stationIds };
    });
  };

  const handleTableToggle = (tableId: string) => {
    setFormData((prev) => {
      const exists = prev.tableIds.includes(tableId);
      const tableIds = exists
        ? prev.tableIds.filter((id) => id !== tableId)
        : [...prev.tableIds, tableId];
      return { ...prev, tableIds };
    });
  };

  const handlePermissionToggle = (perm: Permission) => {
    setFormData((prev) => {
      const exists = prev.customPermissions.includes(perm);
      const customPermissions = exists
        ? prev.customPermissions.filter((p) => p !== perm)
        : [...prev.customPermissions, perm];
      return { ...prev, customPermissions };
    });
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

  const canAssignBoss = actorRoles.includes(Role.SUPER_ADMIN);
  const baseRoles: Role[] = [Role.MANAGER, Role.CASHIER, Role.WAITER, Role.KITCHEN];
  const selectableRoles: Role[] = allowedRoles && allowedRoles.length > 0
    ? baseRoles.filter((r) => allowedRoles.includes(r))
    : baseRoles;
  if (canAssignBoss && (!allowedRoles || allowedRoles.includes('BOSS'))) {
    selectableRoles.unshift(Role.BOSS);
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Xodimni Tahrirlash' : 'Yangi Xodim Qo\'shish'}
      maxWidth="xl"
    >
      <div className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-main mb-1">To'liq ismi</label>
              <Input
                placeholder="Azizbek Rahimov"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-main mb-1">Telefon raqami</label>
              <Input
                placeholder="+998901234567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-main mb-1">
              Parol {isEditing && <span className="text-ink-secondary font-normal">(O'zgartirmaslik uchun bo'sh qoldiring)</span>}
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={isEditing ? '••••••••' : 'Kamida 6 belgi'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!isEditing}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-ink-muted hover:text-ink-main focus:outline-none p-0.5 rounded transition-colors"
                title={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Rollar */}
          <div>
            <label className="block text-xs font-semibold text-ink-main mb-1.5">
              Biriktirilgan Rollar (Bir nechta tanlash mumkin)
            </label>

            {/* Tezkor Shablonlar */}
            <div className="mb-3 space-y-2 p-3 bg-bg rounded-xl border border-line">
              <span className="text-[11px] text-ink-secondary flex items-center gap-1 font-bold">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                O'zbekiston kafelari uchun jamoa kombinatsiyalari (1, 2, 3, 4, 5+ xodim):
              </span>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider">1-2 xodim:</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, roles: [Role.WAITER, Role.CASHIER, Role.MANAGER] })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-100 text-purple-950 border border-purple-300 hover:bg-purple-200 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                    Universal Operator (3 in 1: Kassa+Zal+Menejer)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, roles: [Role.WAITER, Role.CASHIER] })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-amber-700" />
                    Ofitsiant-Kassir (2 in 1)
                  </button>
                  {canAssignBoss && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, roles: [Role.BOSS, Role.MANAGER, Role.CASHIER, Role.WAITER] })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-100 text-indigo-950 border border-indigo-300 hover:bg-indigo-200 transition-colors"
                    >
                      <Crown className="w-3.5 h-3.5 text-indigo-700" />
                      Solo Egasi (4 in 1)
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider">2-3 xodim:</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, roles: [Role.MANAGER, Role.CASHIER] })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-surface text-ink-main border border-line hover:border-brand transition-colors"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                    Menejer-Kassir
                  </button>
                  {selectableRoles.includes(Role.KITCHEN) && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, roles: [Role.KITCHEN] })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-surface text-ink-main border border-line hover:border-brand transition-colors"
                    >
                      <ChefHat className="w-3.5 h-3.5 text-rose-600" />
                      Oshpaz / Barman
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider">Alohida rollar:</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, roles: [Role.WAITER] })}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-surface text-ink-secondary border border-line hover:border-brand/40 transition-colors"
                  >
                    Faqat Ofitsiant
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, roles: [Role.CASHIER] })}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-surface text-ink-secondary border border-line hover:border-brand/40 transition-colors"
                  >
                    Faqat Kassa
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, roles: [Role.MANAGER] })}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-surface text-ink-secondary border border-line hover:border-brand/40 transition-colors"
                  >
                    Faqat Menejer
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectableRoles.map((role) => {
                const isSelected = formData.roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleRoleToggle(role)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors min-h-[38px] ${
                      isSelected
                        ? 'bg-brand text-white border-brand'
                        : 'bg-bg text-ink-secondary border-line hover:border-brand/40'
                    }`}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stansiyalar (Oshxona / Bar) */}
          {availableStations.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-ink-main mb-2">
                Oshxona Stansiyalari (Oshpaz / Barman uchun)
              </label>
              <div className="flex flex-wrap gap-2">
                {availableStations.map((st) => {
                  const isSelected = formData.stationIds.includes(st.id);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleStationToggle(st.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors min-h-[38px] ${
                        isSelected
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                          : 'bg-bg text-ink-secondary border-line'
                      }`}
                    >
                      {st.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stollar (Ofitsiant biriktiruvi) */}
          {availableTables.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-ink-main mb-2">
                Biriktirilgan Stollar (Ofitsiant uchun)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-bg rounded-xl border border-line">
                {availableTables.map((t) => {
                  const isSelected = formData.tableIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTableToggle(t.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors min-h-[32px] ${
                        isSelected
                          ? 'bg-brand text-white border-brand'
                          : 'bg-surface text-ink-secondary border-line'
                      }`}
                    >
                      Stol {t.number}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Maxsus Ruxsatlar (Moliyaviy va ma'muriy huquqlar) */}
          <div>
            <label className="block text-xs font-semibold text-ink-main mb-1">
              Maxsus Ruxsatlar (Boss sozlamasi bo'yicha)
            </label>
            <p className="text-[11px] text-ink-secondary mb-2">
              Masalan: Menejerga chegirma tasdiqlash yoki refund huquqini berish/cheklash
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {['discounts.approve', 'refunds.approve', 'settings.manage', 'reports.view', 'audit.view', 'menu.manage'].map((perm) => {
                const isChecked = formData.customPermissions.includes(perm);
                return (
                  <label
                    key={perm}
                    className="flex items-center space-x-2 text-xs p-2 rounded-xl bg-bg border border-line cursor-pointer hover:bg-surface"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handlePermissionToggle(perm as Permission)}
                      className="rounded text-brand focus:ring-brand"
                    />
                    <span className="font-mono text-[11px] text-ink-main">{perm}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-line flex justify-end gap-2">
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
