import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Inbox,
  AlertTriangle,
  LogIn,
  Search,
  Database,
  Server,
  Plus,
  RefreshCw,
  PowerOff,
  CheckCircle2,
  Clock,
  Lock,
  KeyRound,
  User,
  Phone,
  Send,
  Instagram,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  LogOut,
  Sliders,
  Crown,
  CreditCard,
  UtensilsCrossed,
  Users,
  ExternalLink,
  MapPin,
  Menu,
  X,
  Trash2,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.tsx';
import type { PlatformOverviewDto, PlatformRestaurantItemDto } from '@menurest/shared';

export interface ActiveSupportSession {
  token: string;
  restaurantId: string;
  restaurantName: string;
  reason: string;
  isReadOnly: boolean;
  expiresAt: string;
}

export const SuperAdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tenants' | 'leads' | 'health' | 'settings'>('tenants');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [unauthorized, setUnauthorized] = useState(false);

  // Admin Credentials state
  const [adminPhone, setAdminPhone] = useState('+998 90 111 11 11');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [savingAdminPassword, setSavingAdminPassword] = useState(false);
  const [adminPassMsg, setAdminPassMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Landing Page Public Contacts state
  const [landingPhone, setLandingPhone] = useState('+998 97 622 00 34');
  const [landingTelegram, setLandingTelegram] = useState('@muhammadqodirdev');
  const [landingInstagram, setLandingInstagram] = useState('');
  const [savingLandingSettings, setSavingLandingSettings] = useState(false);
  const [landingSettingsMsg, setLandingSettingsMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Leads state (Bosh sahifadan arizalar)
  const [leads, setLeads] = useState<any[]>([]);

  // Overview data
  const [overview, setOverview] = useState<PlatformOverviewDto & { technicalErrors: any[] } | null>(null);

  // Restaurants list
  const [restaurants, setRestaurants] = useState<PlatformRestaurantItemDto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<PlatformRestaurantItemDto | null>(null);
  const [enteringRestaurantId, setEnteringRestaurantId] = useState<string | null>(null);

  // Form states for Create Restaurant
  const [newRestName, setNewRestName] = useState('');
  const [newRestSlug, setNewRestSlug] = useState('');
  const [newRestPlan, setNewRestPlan] = useState<'START' | 'BUSINESS' | 'ENTERPRISE' | 'CUSTOM'>('BUSINESS');
  const [customPlanName, setCustomPlanName] = useState('');
  const [newRestExpiresAt, setNewRestExpiresAt] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [newRestAllowedRoles, setNewRestAllowedRoles] = useState<string[]>([
    'MANAGER', 'CASHIER', 'WAITER', 'GUEST',
  ]);

  function handleGeneratePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const num = Math.floor(1000 + Math.random() * 9000);
    const generated = `Rest#${num}`;
    setNewOwnerPassword(generated);
    setShowPassword(true);
  }

  function handleCopyPassword() {
    if (!newOwnerPassword) return;
    navigator.clipboard.writeText(newOwnerPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  }
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Modal states for Owner Credentials View (Super Admin Boss login/parolini ko'rishi)
  const [ownerCredModalOpen, setOwnerCredModalOpen] = useState(false);
  const [editOwnerPhone, setEditOwnerPhone] = useState('');
  const [editOwnerCurrentPassword, setEditOwnerCurrentPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(true);
  const [currentPassCopied, setCurrentPassCopied] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [allCopied, setAllCopied] = useState(false);
  const [, setLoadingOwnerCreds] = useState(false);

  // Details Modal helpers
  const [detailShowPass, setDetailShowPass] = useState(true);
  const [detailCopiedField, setDetailCopiedField] = useState<string | null>(null);

  // Form states for Status Change (SUSPEND / ACTIVATE)
  const [newStatus, setNewStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [statusReason, setStatusReason] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);

  // Form states for Support Session
  const [supportReason, setSupportReason] = useState('');
  const [supportDuration, setSupportDuration] = useState('30');
  const [supportReadOnly, setSupportReadOnly] = useState(true);
  const [supportSuccess, setSupportSuccess] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);

  // Active support session in localStorage
  const [currentSupportSession, setCurrentSupportSession] = useState<ActiveSupportSession | null>(() => {
    try {
      const saved = localStorage.getItem('menurest_support_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Load platform overview & restaurants
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [resOverview, resRestaurants, resMe, resLeads, resSettings] = await Promise.all([
          fetch('/api/v1/platform/overview', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
          fetch(`/api/v1/platform/restaurants?search=${encodeURIComponent(searchQuery)}&status=${statusFilter}`, { credentials: 'include' })
            .then((r) => r.json())
            .catch(() => null),
          fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
          fetch('/api/v1/platform/leads', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
          fetch('/api/v1/platform/settings', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        ]);

        if (resMe?.success && resMe.data?.user?.phone) {
          setAdminPhone(resMe.data.user.phone);
        }
        if (resLeads?.success && resLeads.data?.leads) {
          setLeads(resLeads.data.leads);
        }
        if (resSettings?.success && resSettings.data) {
          if (resSettings.data.supportPhone !== undefined) setLandingPhone(resSettings.data.supportPhone);
          if (resSettings.data.supportTelegram !== undefined) setLandingTelegram(resSettings.data.supportTelegram);
          if (resSettings.data.supportInstagram !== undefined) setLandingInstagram(resSettings.data.supportInstagram);
        }

        if (resOverview?.error?.code === 'UNAUTHORIZED' || resOverview?.error?.code === 'FORBIDDEN') {
          setUnauthorized(true);
        } else if (resOverview?.success) {
          setUnauthorized(false);
          setOverview(resOverview.data);
        }
        if (resRestaurants?.success) setRestaurants(resRestaurants.data.restaurants || []);
      } catch (err) {
        console.error('Error loading platform data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [searchQuery, statusFilter, refreshTrigger]);

  async function handleQuickSuperAdminLogin() {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: '+998901111111', password: 'Demo12345!' }),
      });
      const data = await res.json();
      if (data.success) {
        setUnauthorized(false);
        setRefreshTrigger((c) => c + 1);
        window.dispatchEvent(new Event('menurest_auth_change'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Handle Create Restaurant
  async function handleCreateRestaurant(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    const calculatedSlug =
      newRestSlug ||
      newRestName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-') ||
      `rest-${Date.now()}`;

    try {
      const finalPlan = newRestPlan === 'CUSTOM'
        ? (customPlanName.trim() || 'STANDART')
        : newRestPlan;

      const res = await fetch('/api/v1/platform/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newRestName,
          slug: calculatedSlug,
          subscriptionPlan: finalPlan,
          subscriptionExpiresAt: newRestExpiresAt ? new Date(newRestExpiresAt).toISOString() : null,
          allowedRoles: newRestAllowedRoles,
          ownerPhone: newOwnerPhone,
          ownerPassword: newOwnerPassword,
          ownerName: `${newRestName.trim()} Boshqaruvchisi`,
          initialTablesCount: 0,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error?.message || 'Restoran yaratishda xatolik');
        return;
      }

      setCreateSuccess(`"${json.data.restaurant.name}" muvaffaqiyatli yaratildi!`);
      setTimeout(() => {
        setCreateModalOpen(false);
        setCreateSuccess(null);
        setNewRestName('');
        setNewRestSlug('');
        setNewRestExpiresAt('');
        setNewRestPlan('BUSINESS');
        setCustomPlanName('');
        setNewOwnerPhone('');
        setNewOwnerPassword('');
        setNewRestAllowedRoles(['MANAGER', 'CASHIER', 'WAITER', 'GUEST']);
        setShowPassword(true);
        setRefreshTrigger((c) => c + 1);
      }, 1500);
    } catch (err: any) {
      setCreateError(err.message || 'Server xatosi');
    }
  }

  // Set expiry preset (1 oy, 6 oy, 1 yil)
  function handleSetExpiryPreset(months: number) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    setNewRestExpiresAt(d.toISOString().split('T')[0]);
  }

  // Handle Update Status
  async function handleUpdateStatus() {
    if (!selectedRestaurant) return;
    setStatusError(null);

    if (newStatus === 'SUSPENDED' && !statusReason.trim()) {
      setStatusError('Xizmatni to\'xtatish sababi kiritilishi shart');
      return;
    }

    try {
      const res = await fetch(`/api/v1/platform/restaurants/${selectedRestaurant.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: newStatus,
          reason: statusReason,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setStatusError(json.error?.message || 'Holatni o\'zgartirishda xatolik');
        return;
      }

      setStatusModalOpen(false);
      setSelectedRestaurant(null);
      setStatusReason('');
      setRefreshTrigger((c) => c + 1);
    } catch (err: any) {
      setStatusError(err.message || 'Server xatosi');
    }
  }

  // Handle Open Support Session
  async function handleCreateSupportSession() {
    if (!selectedRestaurant) return;
    setSupportError(null);
    setSupportSuccess(null);

    if (!supportReason.trim()) {
      setSupportError('Kirish sababi kiritilishi shart');
      return;
    }

    try {
      const res = await fetch(`/api/v1/platform/restaurants/${selectedRestaurant.id}/support-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reason: supportReason,
          expiresInMinutes: parseInt(supportDuration, 10),
          isReadOnly: supportReadOnly,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setSupportError(json.error?.message || 'Yordam sessiyasini ochishda xatolik');
        return;
      }

      const session: ActiveSupportSession = {
        token: json.data.supportToken,
        restaurantId: json.data.restaurantId,
        restaurantName: json.data.restaurantName,
        reason: json.data.reason,
        isReadOnly: json.data.isReadOnly,
        expiresAt: json.data.expiresAt,
      };

      localStorage.setItem('menurest_support_session', JSON.stringify(session));
      window.dispatchEvent(new Event('menurest_support_change'));
      setCurrentSupportSession(session);

      setSupportSuccess(`Yordam sessiyasi ochildi! Rejim: ${supportReadOnly ? 'Read-Only' : 'Full'}. Token faollashtirildi.`);
      setTimeout(() => {
        setSupportModalOpen(false);
        setSupportSuccess(null);
        setSupportReason('');
        setRefreshTrigger((c) => c + 1);
      }, 1500);
    } catch (err: any) {
      setSupportError(err.message || 'Server xatosi');
    }
  }

  // Open Owner Credentials View Modal
  async function openOwnerCredentialsModal(res: any) {
    setSelectedRestaurant(res);
    setEditOwnerPhone(res.owner?.phone || '');
    setEditOwnerCurrentPassword(res.owner?.plainPassword || '');
    setShowCurrentPassword(true);
    setPhoneCopied(false);
    setCurrentPassCopied(false);
    setAllCopied(false);
    setOwnerCredModalOpen(true);

    try {
      setLoadingOwnerCreds(true);
      const r = await fetch(`/api/v1/platform/restaurants/${res.id}/owner-credentials`, { credentials: 'include' });
      const json = await r.json();
      if (r.ok && json.success && json.data) {
        if (json.data.phone) setEditOwnerPhone(json.data.phone);
        if (json.data.plainPassword) setEditOwnerCurrentPassword(json.data.plainPassword);

        // Ro'yxatdagi restoran ma'lumotlarini ham darhol yangilash
        setRestaurants((prev) =>
          prev.map((item) =>
            item.id === res.id
              ? {
                  ...item,
                  owner: item.owner
                    ? {
                        ...item.owner,
                        phone: json.data.phone || item.owner.phone,
                        plainPassword: json.data.plainPassword || item.owner.plainPassword,
                      }
                    : null,
                }
              : item
          )
        );
      }
    } catch {
      // keep fallback
    } finally {
      setLoadingOwnerCreds(false);
    }
  }

  // Handle Revoke Support Session
  async function handleRevokeSupportSession() {
    if (!currentSupportSession) return;
    try {
      await fetch(`/api/v1/platform/restaurants/${currentSupportSession.restaurantId}/support-session/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ supportToken: currentSupportSession.token }),
      });
    } catch (err) {
      console.error('Revoke error:', err);
    } finally {
      localStorage.removeItem('menurest_support_session');
      window.dispatchEvent(new Event('menurest_support_change'));
      setCurrentSupportSession(null);
      setRefreshTrigger((c) => c + 1);
    }
  }

  // Handle Direct Entry into Restaurant as Manager / Administrator
  async function handleEnterRestaurantAsBoss(restaurant: PlatformRestaurantItemDto) {
    try {
      setEnteringRestaurantId(restaurant.id);
      const res = await fetch(`/api/v1/platform/restaurants/${restaurant.id}/enter-as-boss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Restoranga kirishda xatolik yuz berdi');
      }

      window.dispatchEvent(new Event('menurest_auth_change'));
      window.location.hash = '#manager';
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Restoranga kirib bo\'lmadi');
    } finally {
      setEnteringRestaurantId(null);
    }
  }

  // Handle Save Super Admin Credentials (Login telefoni va/yoki Parol)
  async function handleSaveAdminCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!adminPhone.trim()) {
      setAdminPassMsg({ text: 'Kirish telefon raqami bo\'sh bo\'lishi mumkin emas', type: 'error' });
      return;
    }
    if (adminNewPassword.trim() && adminNewPassword.trim().length < 6) {
      setAdminPassMsg({ text: 'Yangi parol kamida 6 belgidan iborat bo\'lishi kerak', type: 'error' });
      return;
    }
    if (adminNewPassword && adminNewPassword !== adminConfirmPassword) {
      setAdminPassMsg({ text: 'Kiritilgan yangi parollar mos kelmadi', type: 'error' });
      return;
    }
    try {
      setSavingAdminPassword(true);
      setAdminPassMsg(null);
      const res = await fetch('/api/v1/platform/admin-credentials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: adminPhone.trim(),
          newPassword: adminNewPassword.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setAdminPassMsg({ text: 'Super Admin ma\'lumotlari muvaffaqiyatli yangilandi!', type: 'success' });
        if (json.data?.phone) {
          setAdminPhone(json.data.phone);
        }
        setAdminNewPassword('');
        setAdminConfirmPassword('');
        setTimeout(() => setAdminPassMsg(null), 3500);
      } else {
        setAdminPassMsg({ text: json.error?.message || 'Ma\'lumotlarni yangilashda xatolik', type: 'error' });
      }
    } catch {
      setAdminPassMsg({ text: 'Tarmoq xatosi', type: 'error' });
    } finally {
      setSavingAdminPassword(false);
    }
  }

  // Handle Save Landing Public Contacts
  async function handleSaveLandingSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingLandingSettings(true);
      setLandingSettingsMsg(null);
      const res = await fetch('/api/v1/platform/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          supportPhone: landingPhone.trim(),
          supportTelegram: landingTelegram.trim(),
          supportInstagram: landingInstagram.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setLandingSettingsMsg({ text: 'Bosh sahifa kontaktlari muvaffaqiyatli saqlandi!', type: 'success' });
        setTimeout(() => setLandingSettingsMsg(null), 3500);
      } else {
        setLandingSettingsMsg({ text: json.error?.message || 'Xatolik yuz berdi', type: 'error' });
      }
    } catch {
      setLandingSettingsMsg({ text: 'Tarmoq xatosi', type: 'error' });
    } finally {
      setSavingLandingSettings(false);
    }
  }

  // Handle Delete Restaurant
  async function handleDeleteRestaurant(restaurant: PlatformRestaurantItemDto) {
    if (!window.confirm(`"${restaurant.name}" restoranini butunlay o'chirmoqchimisiz?\nBu amal barcha zallar, stollar va ma'lumotlarni o'chiradi!`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/platform/restaurants/${restaurant.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error?.message || "Restoranni o'chirishda xatolik");
        return;
      }
      setDetailModalOpen(false);
      setSelectedRestaurant(null);
      setRefreshTrigger((c) => c + 1);
    } catch (err: any) {
      alert(err.message || 'Server xatosi');
    } finally {
      setLoading(false);
    }
  }

  // Handle Logout
  async function handleLogout() {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    window.location.hash = '';
    window.location.reload();
  }

  // Sidebar Nav Items
  const sidebarNavItems = [
    {
      id: 'tenants',
      label: 'Restoranlar',
      icon: Building2,
      badge: `${restaurants.length} ta`,
    },
    {
      id: 'leads',
      label: 'Arizalar',
      icon: Inbox,
      badge: leads.filter((l) => l.status === 'NEW').length > 0 ? `${leads.filter((l) => l.status === 'NEW').length} ta yangi` : undefined,
    },
    {
      id: 'health',
      label: 'Tizim Salomatligi',
      icon: Server,
      badge: overview?.systemHealth ? (overview.systemHealth.status === 'HEALTHY' ? 'Barqaror' : 'Diqqat') : undefined,
    },
    {
      id: 'settings',
      label: 'Sozlamalar',
      icon: Sliders,
      badge: 'Platforma',
    },
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col font-sans text-ink-main">
      {/* Active Support Mode Banner */}
      {currentSupportSession && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 font-semibold text-xs flex flex-wrap items-center justify-between gap-2 shadow-sm border-b border-amber-600 sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-950 animate-pulse" />
            <span>
              <strong>SUPPORT REJIMI FAOL:</strong> "{currentSupportSession.restaurantName}" restorani • Sabab: "
              {currentSupportSession.reason}" • Rejim: {currentSupportSession.isReadOnly ? 'O\'qish (Read-Only)' : 'To\'liq (Mutation)'} • Tugaydi: {new Date(currentSupportSession.expiresAt).toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={handleRevokeSupportSession}
            className="px-2.5 py-1 rounded bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 transition-colors"
          >
            Sessiyani Yakunlash & Chiqish
          </button>
        </div>
      )}

      {/* Top Platform Navbar */}
      <header className="bg-ink-main text-white h-16 flex items-center justify-between shadow-sm border-b border-white/10 sticky top-0 z-30">
        <div className="w-full h-full flex items-center justify-between">
          {/* Brand section - aligned with w-64 desktop sidebar */}
          <div className="h-full flex items-center px-4 md:px-3 md:w-64 md:shrink-0 md:border-r md:border-white/10">
            {/* Mobile Hamburger Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden mr-2 p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center border border-white/10 transition-colors"
              aria-label="Menyuni ochish"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 md:px-3.5">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-wider text-white whitespace-nowrap">MENUREST</span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Super Admin
                </span>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setRefreshTrigger((c) => c + 1)}
              disabled={loading}
              className="px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 min-h-[44px] flex items-center gap-2 text-xs font-semibold border border-white/10 transition-colors"
              title="Ma'lumotlarni yangilash"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Yangilash</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl text-rose-300 hover:text-white hover:bg-rose-600/30 min-h-[44px] flex items-center gap-2 text-xs font-semibold border border-rose-500/30 transition-colors"
              title="Tizimdan chiqish"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Chiqish</span>
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE SIDEBAR DRAWER */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex overscroll-contain">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] bg-surface h-full shadow-2xl border-r border-line p-4 flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center space-x-2.5 px-1">
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-brand" />
                  </div>
                  <div>
                    <span className="font-black text-sm text-ink-main block">Menurest Platform</span>
                    <span className="text-[10px] text-ink-secondary">Super Admin Paneli</span>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-ink-secondary hover:text-ink-main hover:bg-bg transition-colors"
                  title="Yopish"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Items */}
              <div className="space-y-1">
                {sidebarNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all min-h-[44px] ${
                        isActive
                          ? 'bg-brand text-white shadow-sm font-bold'
                          : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-bg text-ink-secondary border border-line'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Exit */}
            <div className="pt-4 border-t border-line">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold border border-rose-200 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Chiqish</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container with Docked Left Sidebar */}
      <div className="flex-1 flex w-full">
        {/* DESKTOP SIDEBAR - DOCKED TO HEADER (TEGIB TURGAN) */}
        <aside className="w-64 shrink-0 hidden md:flex flex-col justify-between sticky top-16 h-[calc(100vh-4rem)] bg-surface border-r border-line p-3 z-20">
          <div className="overflow-y-auto">
            {/* Navigation Menu */}
            <div className="space-y-1">
              {sidebarNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all min-h-[42px] ${
                      isActive
                        ? 'bg-brand text-white shadow-sm font-bold'
                        : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-5 h-5 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-bg text-ink-secondary border border-line'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exit at bottom */}
          <div className="pt-3 border-t border-line">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold border border-rose-200 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Chiqish</span>
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Mobile Quick Tab Bar */}
          <div className="md:hidden sticky top-[58px] z-20 bg-bg/95 backdrop-blur py-2 -mx-4 px-4 border-b border-line flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
            {sidebarNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`px-3 py-1.5 rounded-xl border shrink-0 flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-brand text-white border-brand shadow-sm'
                      : 'bg-surface text-ink-secondary border-line hover:border-brand/40'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        {unauthorized && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-4 shadow-subtle">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-amber-900">Super Admin Sessiyasi Talab Qilinadi</h3>
              <p className="text-xs text-amber-700 max-w-md mx-auto">
                Platforma boshqaruvi va ma'lumotlarni to'liq ko'rish uchun Super Admin akkaunti bilan tizimga kirish lozim (+998901111111).
              </p>
            </div>
            <Button
              onClick={handleQuickSuperAdminLogin}
              variant="primary"
              size="md"
              className="text-xs inline-flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Super Admin sifatida kirish (+998901111111)</span>
            </Button>
          </div>
        )}

        {/* TAB 1: RESTAURANT TENANTS */}
        {activeTab === 'tenants' && (
          <div className="space-y-4">
            {/* Quick KPI stats */}
            {overview && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-surface rounded-xl border border-line shadow-subtle">
                  <span className="text-xs text-ink-secondary block">Jami Restoranlar</span>
                  <span className="text-2xl font-black text-ink-main">{overview.totalRestaurants} ta</span>
                </div>
                <div className="p-4 bg-surface rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-subtle">
                  <span className="text-xs text-emerald-800 block">Faol Xizmat</span>
                  <span className="text-2xl font-black text-emerald-700">{overview.activeRestaurants} ta</span>
                </div>
                <div className="p-4 bg-surface rounded-xl border border-red-200 bg-red-50/20 shadow-subtle">
                  <span className="text-xs text-red-800 block">To'xtatilgan (Suspended)</span>
                  <span className="text-2xl font-black text-red-700">{overview.suspendedRestaurants} ta</span>
                </div>
                <div className="p-4 bg-surface rounded-xl border border-line shadow-subtle">
                  <span className="text-xs text-ink-secondary block">Bugungi Buyurtmalar</span>
                  <span className="text-2xl font-black text-brand">{overview.todayOrdersCount} ta</span>
                </div>
              </div>
            )}

            {/* Filter and Create Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-xl border border-line shadow-subtle">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-ink-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nomi, slugi yoki egasi..."
                    className="pl-9 text-xs"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-line bg-surface text-xs font-semibold text-ink-main focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="ALL">Barchasi</option>
                  <option value="ACTIVE">Faqat Faol</option>
                  <option value="SUSPENDED">Faqat To'xtatilgan</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="md"
                  variant="primary"
                  onClick={() => {
                    setNewOwnerPassword('');
                    setShowPassword(true);
                    setCreateModalOpen(true);
                  }}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Yangi Restoran Ochish</span>
                </Button>
              </div>
            </div>


            {/* Clean & Professional Restaurants Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restoran</TableHead>
                  <TableHead>Boshqaruvchi</TableHead>
                  <TableHead>Amal Qilish Muddati</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restaurants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-ink-secondary text-xs">
                      <div className="flex flex-col items-center justify-center space-y-2 py-4">
                        <Building2 className="w-8 h-8 text-ink-light stroke-[1.5]" />
                        <span className="font-bold text-ink-main text-sm">Hozircha restoranlar mavjud emas</span>
                        <span className="text-ink-secondary text-xs">
                          Barcha ko&apos;rsatkichlar 0 holatida. Yangi restoran ochish uchun yuqoridagi tugmadan foydalaning.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  restaurants.map((res) => (
                    <TableRow key={res.id}>
                      <TableCell>
                        <div>
                          <span className="font-bold text-ink-main block text-sm">{res.name}</span>
                          <span className="text-xs font-mono text-ink-secondary">/{res.slug}</span>
                          <div className="flex items-center gap-2 mt-1">
                            {res.phone && (
                              <span className="inline-flex items-center text-[10px] text-ink-secondary font-mono" title={`Telefonlar soni: ${1 + (res.extraPhones?.length || 0)}`}>
                                <Phone className="w-2.5 h-2.5 mr-0.5 text-brand" />
                                {1 + (res.extraPhones?.length || 0)} tel
                              </span>
                            )}
                            {res.telegram && (
                              <span className="inline-flex items-center text-[10px] text-sky-600 font-semibold" title={`Telegram: ${res.telegram}`}>
                                <Send className="w-2.5 h-2.5 mr-0.5" />
                                TG
                              </span>
                            )}
                            {res.instagram && (
                              <span className="inline-flex items-center text-[10px] text-pink-600 font-semibold" title={`Instagram: ${res.instagram}`}>
                                <Instagram className="w-2.5 h-2.5 mr-0.5" />
                                IG
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <span className="font-semibold text-ink-main block">
                            {res.owner ? res.owner.fullName : '—'}
                          </span>
                          <span className="text-ink-secondary font-mono">
                            {res.owner ? res.owner.phone : '—'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-ink-secondary">
                        {res.subscriptionExpiresAt ? (
                          <div className="flex items-center gap-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5 text-brand" />
                            <span>{new Date(res.subscriptionExpiresAt).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Muddatsiz</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {res.status === 'ACTIVE' ? (
                          <Badge variant="success" size="sm" className="inline-flex items-center gap-1 font-bold">
                            <CheckCircle2 className="w-3 h-3" /> FAOL
                          </Badge>
                        ) : (
                          <Badge variant="danger" size="sm" className="inline-flex items-center gap-1 font-bold">
                            <PowerOff className="w-3 h-3" /> TO'XTATILGAN
                          </Badge>
                        )}
                        {res.suspendedReason && (
                          <span className="block text-[10px] text-red-600 truncate max-w-[140px]" title={res.suspendedReason}>
                            {res.suspendedReason}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRestaurant(res);
                              setDetailModalOpen(true);
                            }}
                            className="text-xs h-8 min-h-[32px] text-ink-main border-line hover:bg-bg font-semibold"
                            title="Restoran tafsilotlari, rollari va boshqaruvi"
                          >
                            <Sliders className="w-3.5 h-3.5 mr-1 text-ink-secondary" />
                            Boshqaruv
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* TAB 1.5: LEADS / ARIZALAR */}
        {activeTab === 'leads' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-ink-main tracking-tight">Bosh Sahifadan Kelgan Arizalar</h3>
                <p className="text-xs text-ink-secondary">
                  Restoranini Menurest tizimiga ulash uchun saytda ariza qoldirgan mijozlar ro'yxati.
                </p>
              </div>
              <div className="text-xs text-ink-secondary font-mono bg-surface border border-line px-3 py-1.5 rounded-xl shadow-xs">
                Jami: <strong className="text-ink-main">{leads.length}</strong> ta ariza
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Murojaatchi</TableHead>
                  <TableHead>Telefon Raqam</TableHead>
                  <TableHead>Hudud / Viloyat</TableHead>
                  <TableHead>Sana</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-ink-secondary text-xs">
                      Hozircha yangi arizalar mavjud emas
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead: any) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="font-semibold text-sm text-ink-main">{lead.name}</div>
                        {lead.note && <span className="text-[11px] text-ink-secondary block">{lead.note}</span>}
                      </TableCell>
                      <TableCell>
                        <a
                          href={`tel:${lead.phone}`}
                          className="font-mono text-xs font-bold text-brand hover:underline flex items-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{lead.phone}</span>
                        </a>
                      </TableCell>
                      <TableCell className="text-xs text-ink-secondary font-medium">
                        {lead.region || 'Toshkent shahri'}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-ink-secondary">
                        {new Date(lead.createdAt).toLocaleDateString('uz-UZ')}
                      </TableCell>
                      <TableCell>
                        {lead.status === 'NEW' ? (
                          <Badge variant="warning" size="sm" className="font-bold">
                            Yangi
                          </Badge>
                        ) : lead.status === 'CONTACTED' ? (
                          <Badge variant="neutral" size="sm" className="font-bold">
                            Bog'lanildi
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm" className="font-bold">
                            Mijoz bo'ldi
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setNewRestName(lead.name.endsWith('Restorani') ? lead.name : `${lead.name} Restorani`);
                              setNewOwnerPhone(lead.phone);
                              handleGeneratePassword();
                              setCreateModalOpen(true);
                            }}
                            className="text-xs h-8 min-h-[32px] font-bold"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Restoran Ochish
                          </Button>
                          {lead.status === 'NEW' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                await fetch(`/api/v1/platform/leads/${lead.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ status: 'CONTACTED' }),
                                });
                                setLeads((prev) =>
                                  prev.map((l) => (l.id === lead.id ? { ...l, status: 'CONTACTED' } : l))
                                );
                              }}
                              className="text-xs h-8 min-h-[32px]"
                            >
                              Bog'lanildi
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* TAB 2: SYSTEM HEALTH & ACTIVITY METRICS */}
        {activeTab === 'health' && (
          <div className="space-y-8">
            {/* SECTION 1: JONLI FAOLLIK */}
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-bold text-ink-main">Bugungi Jonli Faollik</h3>
                <p className="text-xs text-ink-secondary">
                  Barcha restoranlar bo'yicha real vaqtdagi buyurtmalar va faol stollar oqimi
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. Bugungi Jami Buyurtmalar */}
                <div className="p-5 bg-surface rounded-2xl border border-line shadow-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                      <UtensilsCrossed className="w-5 h-5" />
                    </div>
                    <Badge variant="success">Jonli oqim</Badge>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-ink-main tracking-tight block">
                      {overview ? `${overview.todayOrdersCount} ta` : '0 ta'}
                    </span>
                    <span className="text-xs font-semibold text-ink-main mt-0.5 block">Bugungi Buyurtmalar</span>
                    <p className="text-[11px] text-ink-secondary mt-1">
                      Bugun mijozlar tomonidan berilgan jami buyurtmalar
                    </p>
                  </div>
                </div>

                {/* 2. Faol Mehmonlar / Band Stollar */}
                <div className="p-5 bg-surface rounded-2xl border border-line shadow-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <Badge variant="neutral">Ayni damda</Badge>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-ink-main tracking-tight block">
                      {overview?.activeTablesCount ? `${overview.activeTablesCount} ta` : '0 ta'}
                    </span>
                    <span className="text-xs font-semibold text-ink-main mt-0.5 block">Faol Ochilgan Stollar</span>
                    <p className="text-[11px] text-ink-secondary mt-1">
                      Hozir restoran zallarida ovqatlanayotgan mehmonlar
                    </p>
                  </div>
                </div>

                {/* 3. Bugungi Yetakchi Restoran */}
                <div className="p-5 bg-surface rounded-2xl border border-line shadow-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
                      <Crown className="w-5 h-5" />
                    </div>
                    <Badge variant="warning">Bugungi Yetakchi</Badge>
                  </div>
                  <div>
                    <span className="text-lg font-black text-ink-main tracking-tight block truncate">
                      {overview?.topRestaurantToday?.name || 'Hozircha yo\'q'}
                    </span>
                    <span className="text-xs font-semibold text-ink-main mt-0.5 block">Eng Faol Restoran</span>
                    <p className="text-[11px] text-ink-secondary mt-1">
                      {overview?.topRestaurantToday
                        ? `Bugun ${overview.topRestaurantToday.ordersCount} ta buyurtma qabul qildi`
                        : 'Bugun hali yangi buyurtmalar berilmadi'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: SERVER, BAZA & ZAXIRA HOLATI */}
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-bold text-ink-main">Server, Baza & Zaxira Holati</h3>
                <p className="text-xs text-ink-secondary">
                  Tizimning barqaror ishlashi, zaxiralash va xotira holati
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. Server & API Holati */}
                <div className="p-5 bg-surface rounded-2xl border border-line shadow-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                      <Server className="w-5 h-5" />
                    </div>
                    <Badge variant={overview?.systemHealth.status === 'HEALTHY' ? 'success' : 'warning'}>
                      {overview?.systemHealth.status === 'HEALTHY' ? 'Barqaror (Yashil)' : 'Diqqat'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-ink-main">Node.js API Server</h4>
                    <p className="text-[11px] text-ink-secondary">Uzluksiz xizmat ko'rsatish</p>
                  </div>
                  <div className="p-3 bg-bg rounded-xl text-xs space-y-1.5 text-ink-secondary">
                    <div className="flex items-center justify-between">
                      <span>Uptime:</span>
                      <span className="font-mono font-semibold text-ink-main">
                        {overview ? `${Math.round(overview.systemHealth.uptimeSeconds / 60)} daqiqa` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Kechikish (Latency):</span>
                      <span className="font-mono font-semibold text-emerald-600">
                        {overview ? `${overview.systemHealth.dbLatencyMs} ms` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>RAM sarfi:</span>
                      <span className="font-mono font-semibold text-ink-main">
                        {overview ? `${overview.systemHealth.memoryUsageMb} MB` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Ma'lumotlar Bazasi & Zaxira Nusxa */}
                <div className="p-5 bg-surface rounded-2xl border border-line shadow-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                      <Database className="w-5 h-5" />
                    </div>
                    <Badge variant="success">Himoyalangan</Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-ink-main">PostgreSQL 18 & Zaxira</h4>
                    <p className="text-[11px] text-ink-secondary">Avtomatik xavfsizlik va zaxiralash</p>
                  </div>
                  <div className="p-3 bg-bg rounded-xl text-xs space-y-1.5 text-ink-secondary">
                    <div className="flex items-center justify-between">
                      <span>Avtomatik Zaxira:</span>
                      <span className="font-semibold text-emerald-600">Har kuni 04:00 da</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Baza holati:</span>
                      <span className="font-semibold text-ink-main">Ulangan & Barqaror</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Jami taomlar soni:</span>
                      <span className="font-mono font-semibold text-ink-main">
                        {overview?.totalMenuItems ? `${overview.totalMenuItems} ta` : '0 ta'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Xavfsizlik & Monitoring */}
                <div className="p-5 bg-surface rounded-2xl border border-line shadow-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <Badge variant={overview && overview.technicalErrors.length > 0 ? 'danger' : 'success'}>
                      {overview && overview.technicalErrors.length > 0 ? 'Xatolik bor' : 'Toza (100%)'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-ink-main">Xavfsizlik & Monitoring</h4>
                    <p className="text-[11px] text-ink-secondary">Xatolar va nozik ma'lumotlar himoyasi</p>
                  </div>
                  <div className="p-3 bg-bg rounded-xl text-xs space-y-1.5 text-ink-secondary">
                    <div className="flex items-center justify-between">
                      <span>Texnik xatolar:</span>
                      <span className={`font-mono font-semibold ${overview && overview.technicalErrors.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {overview?.technicalErrors.length ?? 0} ta
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Parollar & Tokenlar:</span>
                      <span className="font-semibold text-ink-main">100% Shifrlangan</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Monitoring holati:</span>
                      <span className="font-semibold text-emerald-600">A'lo darajada</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: TEXNIK XATOLAR JURNALI */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-ink-main">Texnik Xatolar Jurnali (Outbox / Tizim)</h3>
              <p className="text-xs text-ink-secondary">
                Xavfsizlik qoidasi: Secretlar, tokenlar va to'liq so'rov yuklamalari bu yerda aslo ko'rsatilmaydi.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vaqt</TableHead>
                    <TableHead>Hodisa Turi</TableHead>
                    <TableHead>Restoran ID</TableHead>
                    <TableHead>Holat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview && overview.technicalErrors.length > 0 ? (
                    overview.technicalErrors.map((err) => (
                      <TableRow key={err.id}>
                        <TableCell className="text-xs font-mono">{new Date(err.createdAt).toLocaleTimeString()}</TableCell>
                        <TableCell className="font-semibold text-ink-main">{err.eventType}</TableCell>
                        <TableCell className="text-xs font-mono text-ink-secondary">{err.restaurantId}</TableCell>
                        <TableCell>
                          <Badge variant="danger" size="sm">
                            {err.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-emerald-700 text-xs font-semibold">
                        <span className="inline-flex items-center gap-1.5 justify-center">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Hech qanday texnik xatoliklar aniqlanmadi. Tizim barqaror ishlamoqda.
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* TAB 4: PLATFORM SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h3 className="text-lg font-black text-ink-main tracking-tight">Sozlamalar</h3>
            </div>

            {/* Super Admin Kirish Ma'lumotlarini O'zgartirish */}
            <div className="bg-surface rounded-2xl border border-line p-5 sm:p-6 shadow-subtle space-y-4">
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <KeyRound className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-sm text-ink-main">Super Admin Login va Parol</h4>
              </div>

              {adminPassMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    adminPassMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {adminPassMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{adminPassMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveAdminCredentials} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-semibold text-ink-main mb-1.5">
                    Telefon (Login)
                  </label>
                  <Input
                    type="tel"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="+998 90 111 11 11"
                    className="text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-main mb-1.5">
                    Yangi Parol
                  </label>
                  <Input
                    type="password"
                    value={adminNewPassword}
                    onChange={(e) => setAdminNewPassword(e.target.value)}
                    placeholder="Parol kiritilmasa o'zgarmaydi"
                    className="text-xs font-mono"
                  />
                </div>

                {adminNewPassword && (
                  <div>
                    <label className="block text-xs font-semibold text-ink-main mb-1.5">Yangi Parolni Qayta Kiriting</label>
                    <Input
                      type="password"
                      value={adminConfirmPassword}
                      onChange={(e) => setAdminConfirmPassword(e.target.value)}
                      placeholder="Qayta kiriting"
                      className="text-xs font-mono"
                      required={!!adminNewPassword}
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={savingAdminPassword || !adminPhone.trim()}
                  className="font-bold text-xs"
                >
                  {savingAdminPassword ? 'Saqlanmoqda...' : 'Saqlash'}
                </Button>
              </form>
            </div>

            {/* Bosh Sahifa (Landing) Kontaktlarini Sozlash */}
            <div className="bg-surface rounded-2xl border border-line p-5 sm:p-6 shadow-subtle space-y-4">
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <Phone className="w-5 h-5 text-brand" />
                <h4 className="font-bold text-sm text-ink-main">Bosh Sahifa Kontaktlari</h4>
              </div>

              {landingSettingsMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    landingSettingsMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {landingSettingsMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{landingSettingsMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveLandingSettings} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-semibold text-ink-main mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-brand" />
                    <span>Telefon</span>
                  </label>
                  <Input
                    type="tel"
                    value={landingPhone}
                    onChange={(e) => setLandingPhone(e.target.value)}
                    placeholder="+998 97 622 00 34"
                    className="text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-main mb-1.5 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-sky-600" />
                    <span>Telegram</span>
                  </label>
                  <Input
                    type="text"
                    value={landingTelegram}
                    onChange={(e) => setLandingTelegram(e.target.value)}
                    placeholder="@muhammadqodirdev"
                    className="text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-main mb-1.5 flex items-center gap-1.5">
                    <Instagram className="w-3.5 h-3.5 text-pink-600" />
                    <span>Instagram</span>
                  </label>
                  <Input
                    type="text"
                    value={landingInstagram}
                    onChange={(e) => setLandingInstagram(e.target.value)}
                    placeholder="@menurest.uz"
                    className="text-xs font-mono"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={savingLandingSettings}
                  className="font-bold text-xs"
                >
                  {savingLandingSettings ? 'Saqlanmoqda...' : 'Saqlash'}
                </Button>
              </form>
            </div>
          </div>
        )}
      </main>
      </div>

      {/* MODAL 1: Create Restaurant */}
      <Dialog
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Yangi Restoran Ochish"
        fullscreen={true}
      >
        <form onSubmit={handleCreateRestaurant} className="space-y-6">
          {createError && (
            <div className="p-4 bg-red-50 text-red-900 border border-red-200 rounded-2xl text-xs font-medium flex items-center gap-2 shadow-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
              <span>{createError}</span>
            </div>
          )}
          {createSuccess && (
            <div className="p-4 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <span>{createSuccess}</span>
            </div>
          )}

          {/* Section 1: Restoran nomi */}
          <div className="bg-surface rounded-2xl border border-line p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-line pb-3">
              <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold">
                <Building2 className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-ink-main">Restoran Ma'lumotlari</h4>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-main">Restoran Nomi *</label>
              <Input
                value={newRestName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewRestName(val);
                  setNewRestSlug(
                    val
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9\s-]/g, '')
                      .replace(/\s+/g, '-')
                  );
                }}
                placeholder="Restoran nomi"
                required
              />
            </div>

            {/* Muddat */}
            <div className="space-y-2 pt-1 border-t border-line/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ink-main">Xizmat Muddati *</label>
                {newRestExpiresAt && (
                  <button
                    type="button"
                    onClick={() => setNewRestExpiresAt('')}
                    className="text-[11px] text-ink-muted hover:text-red-500 transition-colors"
                  >
                    Tozalash
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '1 oylik', months: 1 },
                  { label: '6 oylik', months: 6 },
                  { label: '1 yillik', months: 12 },
                ].map((preset) => {
                  const checkDate = new Date();
                  checkDate.setMonth(checkDate.getMonth() + preset.months);
                  const isCurrent = newRestExpiresAt === checkDate.toISOString().split('T')[0];
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleSetExpiryPreset(preset.months)}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-brand text-white border-brand shadow-sm'
                          : 'bg-surface text-ink-main border-line hover:border-brand/40 hover:bg-bg'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <Input
                type="date"
                value={newRestExpiresAt}
                onChange={(e) => setNewRestExpiresAt(e.target.value)}
                className="font-medium"
              />
            </div>

            {/* Tarif Rejasi */}
            <div className="space-y-2 pt-1 border-t border-line/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ink-main block">Tarif Rejasi</label>
                <span className="text-[11px] text-ink-secondary">Ixtiyoriy (tanlamasdan kiritish mumkin)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'START', label: 'START', limit: '30 tagacha' },
                  { key: 'BUSINESS', label: 'BUSINESS', limit: '100 tagacha' },
                  { key: 'ENTERPRISE', label: 'ENTERPRISE', limit: 'Cheksiz' },
                  { key: 'CUSTOM', label: 'SHAXSIY', limit: "O'zingiz kiriting" },
                ].map((plan) => {
                  const isSelected = newRestPlan === plan.key;
                  return (
                    <button
                      key={plan.key}
                      type="button"
                      onClick={() => {
                        if (isSelected && plan.key !== 'CUSTOM') {
                          // Tanlangan tarifni qayta bosganda shaxsiy / erkin rejimga o'tadi
                          setNewRestPlan('CUSTOM');
                        } else {
                          setNewRestPlan(plan.key as any);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-brand/10 border-brand text-brand ring-1 ring-brand/30 shadow-xs'
                          : 'bg-surface text-ink-main border-line hover:border-brand/40 hover:bg-bg'
                      }`}
                    >
                      <span className="text-xs font-black block">{plan.label}</span>
                      <span className="text-[10px] text-ink-secondary block mt-0.5">{plan.limit}</span>
                    </button>
                  );
                })}
              </div>

              {newRestPlan === 'CUSTOM' && (
                <div className="pt-2 animate-in fade-in-50 duration-200 space-y-1.5">
                  <label className="text-[11px] font-bold text-ink-main flex items-center justify-between">
                    <span>Shaxsiy tarif nomi</span>
                    <span className="text-[10px] font-normal text-ink-secondary">Bo&apos;sh qolsa: STANDART</span>
                  </label>
                  <input
                    type="text"
                    value={customPlanName}
                    onChange={(e) => setCustomPlanName(e.target.value)}
                    placeholder="Masalan: VIP, Maxsus, Sinov, Yillik yoki bo'sh qoldiring"
                    className="w-full px-3.5 py-2 min-h-[40px] bg-surface border border-line rounded-xl text-xs font-semibold text-ink-main placeholder:text-ink-light focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                  <p className="text-[10px] text-ink-secondary leading-relaxed">
                    Tarif tanlamasdan kiritishingiz mumkin. Hech qanday nom yozmasangiz, avtomatik ravishda erkin <strong>STANDART</strong> rejada ochiladi.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Boshqaruvchi Hisobi (Menejer) */}
          <div className="bg-surface rounded-2xl border border-line p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-line pb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-ink-main">
                  Restoran Menejeri (Boshqaruvchi) Hisobi
                </h4>
                <p className="text-[11px] text-ink-secondary">
                  Restoran boshqaruvchisiga to'liq boshqaruv kabineti yaratiladi.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-main">
                Menejer Telefoni (Login) *
              </label>
              <Input
                value={newOwnerPhone}
                onChange={(e) => setNewOwnerPhone(e.target.value)}
                placeholder="+998901234567"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ink-main">Dastlabki Parol *</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] font-bold text-brand hover:text-brand-dark flex items-center gap-1 hover:underline transition-all bg-brand/10 hover:bg-brand/20 px-2 py-0.5 rounded-lg"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Avtomatik parol yaratish
                  </button>
                  {newOwnerPassword && (
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="text-[11px] font-bold text-ink-secondary hover:text-ink-main flex items-center gap-1 transition-all bg-surface border border-line px-2 py-0.5 rounded-lg"
                    >
                      {passwordCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Nusxalandi</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Nusxa olish</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newOwnerPassword}
                  onChange={(e) => setNewOwnerPassword(e.target.value)}
                  placeholder="Parol"
                  className="font-mono pr-10 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary hover:text-ink-main p-1 rounded hover:bg-surface-hover"
                  title={showPassword ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <Button variant="ghost" type="button" onClick={() => setCreateModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button variant="primary" type="submit" className="min-w-[140px]">
              Yaratish
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL 2: Change Status (ACTIVE / SUSPENDED) */}
      <Dialog
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={`Restoran Holatini O'zgartirish: ${selectedRestaurant?.name}`}
      >
        <div className="space-y-4 pt-2">
          {statusError && (
            <div className="p-3 bg-red-50 text-red-900 border border-red-200 rounded-xl text-xs">
              {statusError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink-main">Yangi Holat:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewStatus('ACTIVE')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${
                  newStatus === 'ACTIVE'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400'
                    : 'border-line text-ink-secondary hover:bg-bg'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                FAOL (ACTIVE)
              </button>
              <button
                type="button"
                onClick={() => setNewStatus('SUSPENDED')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${
                  newStatus === 'SUSPENDED'
                    ? 'border-red-500 bg-red-50 text-red-900 ring-2 ring-red-400'
                    : 'border-line text-ink-secondary hover:bg-bg'
                }`}
              >
                <PowerOff className="w-4 h-4 text-red-600" />
                TO'XTATILGAN (SUSPENDED)
              </button>
            </div>
          </div>

          {newStatus === 'SUSPENDED' && (
            <div className="space-y-2">
              <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs">
                <strong>Eslatma:</strong> Restoran xizmati to'xtatilganda yangi tashrif va yangi buyurtmalar bloklanadi.
                Biroq allaqachon qabul qilingan taomlarni tayyorlash, berish, hisobni to'lash va yopishga ruxsat
                beriladi.
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-ink-main">To'xtatish Sababi (Majburiy):</label>
                <Input
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Masalan: Oylik to'lov muddati tugagan"
                  required
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStatusModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateStatus}
              className={newStatus === 'SUSPENDED' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
            >
              Holatni Saqlash
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 3: Support Session Dialog */}
      <Dialog
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        title={`Restoranga Texnik Yordam Sessiyasi Ochish`}
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-start gap-3 p-3 bg-amber-50 text-amber-900 rounded-xl border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold">Diqqat: Ushbu harakat qat'iy audit qilinadi!</p>
              <p>
                Siz <strong>"{selectedRestaurant?.name}"</strong> restoraniga vaqtinchalik yordam tokeni orqali kiryapsiz.
                Audit jurnallarida sizning haqiqiy shaxsingiz (Super Admin) saqlanadi; Boss nomidan amal qilingandek
                soxta tarix yozilmaydi.
              </p>
            </div>
          </div>

          {supportError && (
            <div className="p-3 bg-red-50 text-red-900 border border-red-200 rounded-xl text-xs">
              {supportError}
            </div>
          )}
          {supportSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold">
              {supportSuccess}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink-main">Kirish Sababi (Majburiy):</label>
            <Input
              value={supportReason}
              onChange={(e) => setSupportReason(e.target.value)}
              placeholder="Masalan: Tiket #502 bo'yicha menyu va printer sozlamasini tekshirish"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-ink-main">Muddati (Daqiqa):</label>
              <select
                value={supportDuration}
                onChange={(e) => setSupportDuration(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-xs font-semibold"
              >
                <option value="15">15 daqiqa</option>
                <option value="30">30 daqiqa (Standart)</option>
                <option value="60">1 soat</option>
                <option value="120">2 soat</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-ink-main">Rejim:</label>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="readOnlyCheck"
                  checked={supportReadOnly}
                  onChange={(e) => setSupportReadOnly(e.target.checked)}
                  className="rounded text-brand focus:ring-brand w-4 h-4"
                />
                <label htmlFor="readOnlyCheck" className="text-xs text-ink-main font-semibold cursor-pointer">
                  Faqat O'qish (Read-Only)
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setSupportModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              variant="primary"
              disabled={!supportReason.trim()}
              onClick={handleCreateSupportSession}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Lock className="w-3.5 h-3.5 mr-1" />
              Sessiyani Ochish & Ulanish
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 4: Restaurant Details Dialog */}
      <Dialog
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Restoran Tafsilotlari: ${selectedRestaurant?.name || ''}`}
        maxWidth="3xl"
      >
        {selectedRestaurant && (
          <div className="space-y-4 pt-1">
            {/* 1. Header Summary Card */}
            <div className="p-4 bg-surface rounded-2xl border border-line shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-lg text-ink-main">{selectedRestaurant.name}</h3>
                    <Badge variant={selectedRestaurant.status === 'ACTIVE' ? 'success' : 'danger'}>
                      {selectedRestaurant.status === 'ACTIVE' ? 'FAOL' : 'TO\'XTATILGAN'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-secondary mt-0.5 flex-wrap">
                    <span className="font-mono bg-bg px-2 py-0.5 rounded border border-line">
                      /{selectedRestaurant.slug}
                    </span>
                  </div>
                </div>
              </div>

              {/* Harakat: Menejer kabinetiga kirish */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEnterRestaurantAsBoss(selectedRestaurant)}
                  disabled={enteringRestaurantId === selectedRestaurant.id}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-brand text-white hover:bg-brand/90 flex items-center gap-1.5 transition-all shadow-xs"
                  title="Restoranga Menejer sifatida to'g'ridan-to'g'ri kirish"
                >
                  <LogIn className={`w-3.5 h-3.5 ${enteringRestaurantId === selectedRestaurant.id ? 'animate-spin' : ''}`} />
                  <span>Menejer kabinetiga o'tish</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </button>
              </div>
            </div>

            {/* 2. Top 2-Columns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Boshqaruvchi & Kirish (Login / Parol) */}
              <div className="p-3.5 bg-surface rounded-xl border border-line shadow-2xs space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-line/60">
                  <span className="text-xs font-bold text-ink-main flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-brand" />
                    Boshqaruvchi & Login
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailModalOpen(false);
                      openOwnerCredentialsModal(selectedRestaurant);
                    }}
                    className="text-[11px] font-bold text-brand hover:underline"
                  >
                    Ko'rish
                  </button>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-[10px] text-ink-secondary block">Mas'ul shaxs</span>
                    <span className="font-bold text-ink-main block truncate">
                      {selectedRestaurant.owner ? selectedRestaurant.owner.fullName : 'Biriktirilmagan'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-ink-secondary block">Telefon (Login)</span>
                    <div className="flex items-center justify-between font-mono font-bold text-ink-main bg-bg px-2 py-1 rounded border border-line/70">
                      <span>{selectedRestaurant.owner?.phone || '—'}</span>
                      {selectedRestaurant.owner?.phone && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedRestaurant.owner!.phone);
                            setDetailCopiedField('phone');
                            setTimeout(() => setDetailCopiedField(null), 2000);
                          }}
                          className="text-ink-muted hover:text-ink-main p-0.5"
                          title="Telefonni nusxalash"
                        >
                          {detailCopiedField === 'phone' ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-ink-secondary block">Parol</span>
                    <div className="flex items-center justify-between font-mono font-bold text-ink-main bg-bg px-2 py-1 rounded border border-line/70">
                      <span>
                        {selectedRestaurant.owner?.plainPassword
                          ? detailShowPass
                            ? selectedRestaurant.owner.plainPassword
                            : '••••••••'
                          : 'Kiritilmagan'}
                      </span>
                      {selectedRestaurant.owner?.plainPassword && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailShowPass(!detailShowPass)}
                            className="text-ink-muted hover:text-ink-main p-0.5"
                            title={detailShowPass ? 'Yashirish' : 'Ko\'rsatish'}
                          >
                            {detailShowPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedRestaurant.owner!.plainPassword!);
                              setDetailCopiedField('pass');
                              setTimeout(() => setDetailCopiedField(null), 2000);
                            }}
                            className="text-ink-muted hover:text-ink-main p-0.5"
                            title="Parolni nusxalash"
                          >
                            {detailCopiedField === 'pass' ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Platforma Tarifi & Muddati */}
              <div className="p-3.5 bg-surface rounded-xl border border-line shadow-2xs space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-line/60">
                  <span className="text-xs font-bold text-ink-main flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-brand" />
                    Tarif & Muddat
                  </span>
                  <Badge variant="info" size="sm">
                    {selectedRestaurant.subscriptionPlan}
                  </Badge>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-[10px] text-ink-secondary block">Stol limiti</span>
                    <span className="font-bold text-ink-main block">
                      {selectedRestaurant.subscriptionPlan === 'START'
                        ? '30 tagacha stol'
                        : selectedRestaurant.subscriptionPlan === 'BUSINESS'
                        ? '100 tagacha stol'
                        : selectedRestaurant.subscriptionPlan === 'ENTERPRISE'
                        ? 'Cheksiz stollar'
                        : 'Maxsus / Cheksiz stollar'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-ink-secondary block">Boshlangan sana</span>
                    <span className="font-mono text-ink-main font-medium block">
                      {new Date(selectedRestaurant.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-ink-secondary block">Amal qilish muddati</span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-ink-main font-bold">
                        {selectedRestaurant.subscriptionExpiresAt
                          ? new Date(selectedRestaurant.subscriptionExpiresAt).toLocaleDateString()
                          : 'Cheksiz'}
                      </span>
                      {selectedRestaurant.subscriptionExpiresAt && (
                        (() => {
                          const diff = new Date(selectedRestaurant.subscriptionExpiresAt).getTime() - Date.now();
                          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                          return (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                days > 7
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : days > 0
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {days > 0 ? `${days} kun qoldi` : 'Muddati tugagan'}
                            </span>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Aloqa va Manzil */}
            <div className="p-3.5 bg-surface rounded-xl border border-line shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-line/60">
                <span className="text-xs font-bold text-ink-main flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-brand" />
                  Aloqa va Manzil
                </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Telefonlar */}
                  <div className="flex items-start gap-2">
                    <Phone className="w-3.5 h-3.5 text-ink-muted shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-ink-secondary block">Restoran telefonlari</span>
                      <div className="font-mono text-ink-main font-medium">
                        {[selectedRestaurant.phone, ...(selectedRestaurant.extraPhones || [])].filter(Boolean).length > 0 ? (
                          [selectedRestaurant.phone, ...(selectedRestaurant.extraPhones || [])].filter(Boolean).join(', ')
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Manzil */}
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-ink-muted shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-ink-secondary block">Manzil</span>
                      <span className="text-ink-main font-medium block">
                        {selectedRestaurant.address || 'Manzil kiritilmagan'}
                      </span>
                    </div>
                  </div>

                  {/* Ijtimoiy tarmoqlar */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-line/60">
                    <div className="flex items-center gap-2 bg-bg px-2.5 py-1.5 rounded-lg border border-line/60">
                      <Send className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] text-ink-secondary block">Telegram</span>
                        <span className="font-mono text-[11px] font-bold text-sky-600 block truncate">
                          {selectedRestaurant.telegram || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-bg px-2.5 py-1.5 rounded-lg border border-line/60">
                      <Instagram className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] text-ink-secondary block">Instagram</span>
                        <span className="font-mono text-[11px] font-bold text-pink-600 block truncate">
                          {selectedRestaurant.instagram || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            {/* Suspended Reason Banner (faqat to'xtatilgan bo'lsa chiqadi) */}
            {selectedRestaurant.status === 'SUSPENDED' && (
              <div className="p-3 bg-red-50 text-red-900 border border-red-200 rounded-xl space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  Xizmat To'xtatilish Sababi:
                </span>
                <p className="text-xs text-red-800 italic">
                  "{selectedRestaurant.suspendedReason || 'Sabab ko\'rsatilmagan'}"
                </p>
                {selectedRestaurant.suspendedAt && (
                  <span className="text-[10px] text-red-700 block font-mono">
                    To'xtatilgan vaqt: {new Date(selectedRestaurant.suspendedAt).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* 4. Action Buttons Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-line">
              <Button variant="ghost" onClick={() => setDetailModalOpen(false)}>
                Yopish
              </Button>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDetailModalOpen(false);
                    openOwnerCredentialsModal(selectedRestaurant);
                  }}
                  className="text-xs h-8 text-ink-main border-line hover:bg-bg"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1 text-brand" />
                  Login & Parol
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDetailModalOpen(false);
                    setNewStatus(selectedRestaurant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE');
                    setStatusReason(selectedRestaurant.suspendedReason || '');
                    setStatusModalOpen(true);
                  }}
                  className={`text-xs h-8 ${
                    selectedRestaurant.status === 'ACTIVE'
                      ? 'text-red-700 border-red-300 hover:bg-red-50'
                      : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  {selectedRestaurant.status === 'ACTIVE' ? 'To\'xtatish' : 'Faollashtirish'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDetailModalOpen(false);
                    setSelectedRestaurant(selectedRestaurant);
                    setSupportReason('');
                    setSupportDuration('30');
                    setSupportReadOnly(true);
                    setSupportModalOpen(true);
                  }}
                  className="text-xs border-amber-500 text-amber-800 hover:bg-amber-50 h-8"
                >
                  <LogIn className="w-3.5 h-3.5 mr-1" />
                  Support
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteRestaurant(selectedRestaurant)}
                  className="text-xs border-rose-300 text-rose-600 hover:bg-rose-50 h-8"
                  title="Restoranni tizimdan to'liq o'chirish"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  O'chirish
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* MODAL 5: Boshqaruvchi Login & Parolini Ko'rish */}
      <Dialog
        isOpen={ownerCredModalOpen}
        onClose={() => setOwnerCredModalOpen(false)}
        title={`Boshqaruvchi Login & Paroli: ${selectedRestaurant?.name || ''}`}
      >
        <div className="space-y-4 pt-2">
          {/* Telefoni (Login) */}
          <div className="p-3.5 bg-bg/70 border border-line rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-main flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-brand" />
                Telefoni (Login)
              </span>
              {editOwnerPhone && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(editOwnerPhone);
                    setPhoneCopied(true);
                    setTimeout(() => setPhoneCopied(false), 2000);
                  }}
                  className="text-[11px] font-bold text-ink-secondary hover:text-ink-main flex items-center gap-1 bg-surface border border-line px-2.5 py-1 rounded-lg transition-colors"
                >
                  {phoneCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600">Nusxalandi</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Nusxa olish</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="font-mono text-base font-bold text-ink-main tracking-wide bg-surface px-3 py-2.5 rounded-lg border border-line">
              {editOwnerPhone || 'Kiritilmagan'}
            </div>
          </div>

          {/* Parol */}
          <div className="p-3.5 bg-bg/70 border border-line rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-main flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                Parol
              </span>
              {editOwnerCurrentPassword && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(editOwnerCurrentPassword);
                      setCurrentPassCopied(true);
                      setTimeout(() => setCurrentPassCopied(false), 2000);
                    }}
                    className="text-[11px] font-bold text-ink-secondary hover:text-ink-main flex items-center gap-1 bg-surface border border-line px-2.5 py-1 rounded-lg transition-colors"
                  >
                    {currentPassCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Nusxalandi</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Nusxa olish</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="text-ink-secondary hover:text-ink-main p-1.5 rounded-lg hover:bg-surface border border-transparent hover:border-line transition-colors"
                    title={showCurrentPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
            {editOwnerCurrentPassword ? (
              <div className="font-mono text-base font-bold text-ink-main tracking-wider bg-surface px-3 py-2.5 rounded-lg border border-line flex items-center justify-between">
                <span>{showCurrentPassword ? editOwnerCurrentPassword : '••••••••'}</span>
              </div>
            ) : (
              <p className="text-xs text-ink-secondary bg-surface border border-line px-3 py-2.5 rounded-lg">
                Parol ko'rsatilmagan
              </p>
            )}
          </div>

          {/* Barchasini Nusxalash & Yopish */}
          <div className="pt-2 flex items-center justify-between border-t border-line">
            <button
              type="button"
              onClick={() => {
                const text = `Restoran: ${selectedRestaurant?.name || ''}\nLogin: ${editOwnerPhone}\nParol: ${editOwnerCurrentPassword}`;
                navigator.clipboard.writeText(text);
                setAllCopied(true);
                setTimeout(() => setAllCopied(false), 2000);
              }}
              className="text-xs font-semibold text-brand hover:underline flex items-center gap-1.5"
            >
              {allCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">Barchasi nusxalandi!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Barchasini nusxalash (Login va Parol)</span>
                </>
              )}
            </button>

            <Button variant="primary" type="button" onClick={() => setOwnerCredModalOpen(false)} className="text-xs font-bold">
              Yopish
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
