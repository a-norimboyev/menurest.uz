import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Activity,
  FileText,
  AlertTriangle,
  LogIn,
  Search,
  Database,
  Server,
  Zap,
  Plus,
  RefreshCw,
  PowerOff,
  CheckCircle2,
  Clock,
  Lock,
  Info,
  User,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.tsx';
import type { PlatformOverviewDto, PlatformRestaurantItemDto, AuditLogDto } from '@menurest/shared';

export interface ActiveSupportSession {
  token: string;
  restaurantId: string;
  restaurantName: string;
  reason: string;
  isReadOnly: boolean;
  expiresAt: string;
}

export const SuperAdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tenants' | 'health' | 'audit'>('tenants');
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [unauthorized, setUnauthorized] = useState(false);

  // Overview data
  const [overview, setOverview] = useState<PlatformOverviewDto & { technicalErrors: any[] } | null>(null);

  // Restaurants list
  const [restaurants, setRestaurants] = useState<PlatformRestaurantItemDto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLogDto[]>([]);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<PlatformRestaurantItemDto | null>(null);

  // Form states for Create Restaurant
  const [newRestName, setNewRestName] = useState('');
  const [newRestSlug, setNewRestSlug] = useState('');
  const [newRestPhone, setNewRestPhone] = useState('');
  const newRestPlan = 'BUSINESS';
  const [newRestExpiresAt, setNewRestExpiresAt] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('Demo12345!');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

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
        const [resOverview, resRestaurants, resAudit] = await Promise.all([
          fetch('/api/v1/platform/overview', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
          fetch(`/api/v1/platform/restaurants?search=${encodeURIComponent(searchQuery)}&status=${statusFilter}`, { credentials: 'include' })
            .then((r) => r.json())
            .catch(() => null),
          fetch('/api/v1/platform/audit?limit=25', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        ]);

        if (resOverview?.error?.code === 'UNAUTHORIZED' || resOverview?.error?.code === 'FORBIDDEN') {
          setUnauthorized(true);
        } else if (resOverview?.success) {
          setUnauthorized(false);
          setOverview(resOverview.data);
        }
        if (resRestaurants?.success) setRestaurants(resRestaurants.data.restaurants || []);
        if (resAudit?.success) setAuditLogs(resAudit.data.logs || []);
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

    try {
      const res = await fetch('/api/v1/platform/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newRestName,
          slug: newRestSlug,
          phone: newRestPhone,
          subscriptionPlan: newRestPlan,
          subscriptionExpiresAt: newRestExpiresAt ? new Date(newRestExpiresAt).toISOString() : null,
          ownerName: newOwnerName,
          ownerPhone: newOwnerPhone,
          ownerPassword: newOwnerPassword,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error?.message || 'Restoran yaratishda xatolik');
        return;
      }

      setCreateSuccess(`✓ "${json.data.restaurant.name}" muvaffaqiyatli yaratildi va Boss biriktirildi!`);
      setTimeout(() => {
        setCreateModalOpen(false);
        setCreateSuccess(null);
        setNewRestName('');
        setNewRestSlug('');
        setNewRestPhone('');
        setNewOwnerName('');
        setNewOwnerPhone('');
        setRefreshTrigger((c) => c + 1);
      }, 1500);
    } catch (err: any) {
      setCreateError(err.message || 'Server xatosi');
    }
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

      setSupportSuccess(`✓ Yordam sessiyasi ochildi! Rejim: ${supportReadOnly ? 'Read-Only' : 'Full'}. Token faollashtirildi.`);
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
      <header className="bg-ink-main text-white px-4 sm:px-6 py-3.5 shadow-md border-b border-ink-main/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-ink-secondary/30 flex items-center justify-center border border-ink-secondary/40">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight">MENUREST PLATFORM ADMIN</h1>
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Multi-tenant platforma boshqaruvi, texnik monitoring va qat'iy audit jurnali
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('tenants')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold min-h-[44px] transition-all ${
                activeTab === 'tenants'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Restoranlar ({overview?.totalRestaurants ?? restaurants.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('health')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold min-h-[44px] transition-all ${
                activeTab === 'health'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Texnik Holat</span>
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold min-h-[44px] transition-all ${
                activeTab === 'audit'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Platform Audit ({auditLogs.length})</span>
            </button>
            <button
              onClick={() => setRefreshTrigger((c) => c + 1)}
              disabled={loading}
              className="p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 min-h-[44px]"
              title="Yangilash"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
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
                  onClick={() => setCreateModalOpen(true)}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Yangi Restoran Ochish</span>
                </Button>
              </div>
            </div>

            {/* Invariant Policy Notice */}
            <div className="p-3 bg-blue-50 text-blue-900 border border-blue-200 rounded-xl text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Xavfsizlik va Ma'lumotlar Boshqaruvi Siyosati:</strong> Restoranlarni qasddan yoki tasodifan
                to'liq o'chirib yuboradigan (hard delete) kundalik tugma mavjud emas. Xizmatni to'xtatish uchun
                "SUSPEND" holatidan foydalaniladi; unda yangi tashrif va yangi buyurtmalar bloklanadi, ammo mavjud
                qabul qilingan hisoblar va taomlarni xavfsiz yakunlashga to'liq ruxsat beriladi.
              </div>
            </div>

            {/* Restaurants Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restoran</TableHead>
                  <TableHead>Egasi (Boss)</TableHead>
                  <TableHead>Platforma Tarifi</TableHead>
                  <TableHead>Amal Qilish Muddati</TableHead>
                  <TableHead>Resurslar</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restaurants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-ink-secondary text-xs">
                      Restoranlar topilmadi
                    </TableCell>
                  </TableRow>
                ) : (
                  restaurants.map((res) => (
                    <TableRow key={res.id}>
                      <TableCell>
                        <div>
                          <span className="font-bold text-ink-main block">{res.name}</span>
                          <span className="text-xs font-mono text-ink-secondary">/{res.slug}</span>
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
                      <TableCell>
                        <div className="space-y-1">
                          {res.subscriptionPlan === 'START' ? (
                            <Badge variant="warning" size="sm">
                              Tezkor
                            </Badge>
                          ) : res.subscriptionPlan === 'BUSINESS' ? (
                            <Badge variant="success" size="sm">
                              Standart
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              Enterprise
                            </Badge>
                          )}
                          <span className="text-[10px] text-ink-secondary block font-mono">
                            {res.subscriptionPlan}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-ink-secondary">
                        {res.subscriptionExpiresAt ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-brand" />
                            <span>{new Date(res.subscriptionExpiresAt).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Muddatsiz</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-ink-secondary">
                        {res.tablesCount} stol • {res.staffCount} xodim • {res.activeVisitsCount} faol tashrif
                      </TableCell>
                      <TableCell>
                        {res.status === 'ACTIVE' ? (
                          <Badge variant="success" size="sm" className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> FAOL
                          </Badge>
                        ) : (
                          <Badge variant="danger" size="sm" className="flex items-center gap-1">
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
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRestaurant(res);
                              setDetailModalOpen(true);
                            }}
                            className="text-xs h-8 min-h-[32px] text-ink-main border-line hover:bg-bg"
                          >
                            <Info className="w-3.5 h-3.5 mr-1 text-ink-secondary" />
                            Tafsilot
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRestaurant(res);
                              setNewStatus(res.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE');
                              setStatusReason(res.suspendedReason || '');
                              setStatusModalOpen(true);
                            }}
                            className={`text-xs h-8 min-h-[32px] ${
                              res.status === 'ACTIVE'
                                ? 'text-red-700 border-red-300 hover:bg-red-50'
                                : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                            }`}
                          >
                            {res.status === 'ACTIVE' ? 'To\'xtatish' : 'Faollashtirish'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRestaurant(res);
                              setSupportReason('');
                              setSupportDuration('30');
                              setSupportReadOnly(true);
                              setSupportModalOpen(true);
                            }}
                            className="text-xs border-amber-500 text-amber-800 hover:bg-amber-50 h-8 min-h-[32px]"
                          >
                            <LogIn className="w-3.5 h-3.5 mr-1" />
                            Support
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

        {/* TAB 2: SYSTEM HEALTH & TECHNICAL METRICS */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-surface rounded-2xl border border-line shadow-subtle space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 bg-emerald-100 rounded-xl text-emerald-800">
                    <Server className="w-6 h-6" />
                  </div>
                  <Badge variant={overview?.systemHealth.status === 'HEALTHY' ? 'success' : 'warning'}>
                    {overview?.systemHealth.status === 'HEALTHY' ? 'Barqaror (Healthy)' : 'Diqqat (Degraded)'}
                  </Badge>
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink-main">API Cluster Node.js</h3>
                  <p className="text-xs text-ink-secondary">Express + TypeScript • Asia/Tashkent</p>
                </div>
                <div className="p-3 bg-bg rounded-xl text-xs font-mono space-y-1.5 text-ink-secondary">
                  <div>Uptime: {overview ? `${Math.round(overview.systemHealth.uptimeSeconds / 60)} daqiqa` : '—'}</div>
                  <div>Xotira: {overview ? `${overview.systemHealth.memoryUsageMb} MB RSS` : '—'}</div>
                  <div>Muhit: Production-ready</div>
                </div>
              </div>

              <div className="p-6 bg-surface rounded-2xl border border-line shadow-subtle space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 bg-blue-100 rounded-xl text-blue-800">
                    <Database className="w-6 h-6" />
                  </div>
                  <Badge variant="success">Ulangan (PostgreSQL)</Badge>
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink-main">PostgreSQL 18 DB</h3>
                  <p className="text-xs text-ink-secondary">Composite keys, partial unique indexes</p>
                </div>
                <div className="p-3 bg-bg rounded-xl text-xs font-mono space-y-1.5 text-ink-secondary">
                  <div>DB Kechikishi (Latency): {overview ? `${overview.systemHealth.dbLatencyMs} ms` : '—'}</div>
                  <div>Tranzaksiya turi: Qat'iy ACID (Isolation)</div>
                  <div>Tenant izolyatsiyasi: Row-level restaurant_id</div>
                </div>
              </div>

              <div className="p-6 bg-surface rounded-2xl border border-line shadow-subtle space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 bg-amber-100 rounded-xl text-amber-800">
                    <Zap className="w-6 h-6" />
                  </div>
                  <Badge variant={overview && overview.technicalErrors.length > 0 ? 'danger' : 'success'}>
                    {overview && overview.technicalErrors.length > 0 ? 'Xatolar mavjud' : 'Toza'}
                  </Badge>
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink-main">Transactional Outbox Queue</h3>
                  <p className="text-xs text-ink-secondary">SSE xabarlar va jonli voqealar tarqatuvchisi</p>
                </div>
                <div className="p-3 bg-bg rounded-xl text-xs font-mono space-y-1.5 text-ink-secondary">
                  <div>Xatoliklar soni: {overview?.technicalErrors.length ?? 0} ta</div>
                  <div>Holat: Avtomatik qayta urinish (Retry)</div>
                </div>
              </div>
            </div>

            {/* Technical Errors Log Table */}
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
                        ✓ Hech qanday texnik xatoliklar aniqlanmadi. Tizim barqaror ishlamoqda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* TAB 3: PLATFORM AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-ink-main">Platforma Xavfsizlik va Boshqaruv Auditi</h3>
              <p className="text-xs text-ink-secondary">
                O'chirilmaydigan xavfsizlik jurnali. Barcha nozik ma'lumotlar (parollar, tokenlar) qat'iy sanitizatsiya qilingan ([REDACTED]).
              </p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vaqt</TableHead>
                  <TableHead>Foydalanuvchi</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Harakat</TableHead>
                  <TableHead>Resurs</TableHead>
                  <TableHead>Sabab</TableHead>
                  <TableHead>IP Manzil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-ink-secondary text-xs">
                      Audit yozuvlari mavjud emas
                    </TableCell>
                  </TableRow>
                ) : (
                  auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{new Date(log.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="font-semibold text-ink-main text-xs">{log.actorName || log.actorId}</TableCell>
                      <TableCell>
                        <Badge variant="neutral" size="sm">
                          {log.actorRole || 'SUPER_ADMIN'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.action.includes('SUSPEND')
                              ? 'danger'
                              : log.action.includes('SUPPORT')
                              ? 'warning'
                              : 'success'
                          }
                          size="sm"
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-ink-main">{log.entityName}</TableCell>
                      <TableCell className="text-xs text-ink-secondary">{log.reason || '—'}</TableCell>
                      <TableCell className="font-mono text-xs text-ink-secondary">{log.ipAddress || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* MODAL 1: Create Restaurant */}
      <Dialog
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Yangi Restoran va Boss Biriktirish"
        description="Multi-tenant platformada yangi restoran yaratish va uning birinchi Boss (Egasini) ro'yxatdan o'tkazish"
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

          {/* Section 1: Restoran Parametrlari */}
          <div className="bg-surface rounded-2xl border border-line p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-line pb-3">
              <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-ink-main">Restoran Ma'lumotlari</h4>
                <p className="text-[11px] text-ink-secondary">Restoran rasmiy nomi, manzili va tizimdagi URL identifikatori</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-main">Restoran Nomi *</label>
                <Input
                  value={newRestName}
                  onChange={(e) => {
                    setNewRestName(e.target.value);
                    if (!newRestSlug) {
                      setNewRestSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }
                  }}
                  placeholder="Masalan: Rayhon Chilonzor"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-main">Slug (URL Identifikator) *</label>
                <Input
                  value={newRestSlug}
                  onChange={(e) => setNewRestSlug(e.target.value)}
                  placeholder="rayhon-chilonzor"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-main">Aloqa Telefoni</label>
                <Input
                  value={newRestPhone}
                  onChange={(e) => setNewRestPhone(e.target.value)}
                  placeholder="+998 71 123 45 67"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-main">Xizmat Tugash Sanasi (Ixtiyoriy)</label>
                <Input
                  type="date"
                  value={newRestExpiresAt}
                  onChange={(e) => setNewRestExpiresAt(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Boss Hisobi */}
          <div className="bg-surface rounded-2xl border border-line p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-line pb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-ink-main">Restoran Egasi (Boss) Hisobi</h4>
                <p className="text-[11px] text-ink-secondary">Restoran ma'muri uchun shaxsiy hisob, login va boshlang'ich parol</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-main">Boss To'liq Ismi *</label>
                <Input
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  placeholder="Alisher Usmonov"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-main">Boss Telefoni (Login uchun) *</label>
                <Input
                  value={newOwnerPhone}
                  onChange={(e) => setNewOwnerPhone(e.target.value)}
                  placeholder="+998901234567"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-main">Dastlabki Parol *</label>
              <Input
                type="password"
                value={newOwnerPassword}
                onChange={(e) => setNewOwnerPassword(e.target.value)}
                placeholder="Demo12345!"
                required
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <Button variant="ghost" type="button" onClick={() => setCreateModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button variant="primary" type="submit" className="min-w-[180px]">
              Yaratish & Tasdiqlash
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
        title={`Restoran Tafsilotlari: ${selectedRestaurant?.name}`}
      >
        {selectedRestaurant && (
          <div className="space-y-4 pt-2 text-xs">
            {/* Header summary banner */}
            <div className="p-3 bg-bg rounded-xl border border-line flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-sm text-ink-main">{selectedRestaurant.name}</h4>
                <p className="font-mono text-ink-secondary text-[11px]">/{selectedRestaurant.slug}</p>
              </div>
              <Badge variant={selectedRestaurant.status === 'ACTIVE' ? 'success' : 'danger'}>
                {selectedRestaurant.status === 'ACTIVE' ? 'FAOL (ACTIVE)' : 'TO\'XTATILGAN (SUSPENDED)'}
              </Badge>
            </div>

            {/* Grid details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-surface rounded-xl border border-line space-y-1">
                <span className="text-[11px] text-ink-secondary block font-medium">Restoran Egasi (Boss)</span>
                <span className="font-bold text-ink-main block text-sm">
                  {selectedRestaurant.owner ? selectedRestaurant.owner.fullName : '—'}
                </span>
                <span className="font-mono text-ink-secondary block">
                  {selectedRestaurant.owner ? selectedRestaurant.owner.phone : '—'}
                </span>
              </div>

              <div className="p-3 bg-surface rounded-xl border border-line space-y-1">
                <span className="text-[11px] text-ink-secondary block font-medium">Platforma Ta'rifi / Tizim</span>
                <div className="flex items-center gap-2">
                  <Badge variant="success" size="sm">
                    To'liq Funktsional
                  </Badge>
                  <span className="text-[11px] text-ink-secondary font-mono">({selectedRestaurant.subscriptionPlan})</span>
                </div>
              </div>

              <div className="p-3 bg-surface rounded-xl border border-line space-y-1">
                <span className="text-[11px] text-ink-secondary block font-medium">Xizmat Boshlanishi (Start)</span>
                <span className="font-mono text-ink-main block">
                  {new Date(selectedRestaurant.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="p-3 bg-surface rounded-xl border border-line space-y-1">
                <span className="text-[11px] text-ink-secondary block font-medium">Xizmat Muddati (End / Expiry)</span>
                <span className="font-mono text-ink-main block">
                  {selectedRestaurant.subscriptionExpiresAt
                    ? new Date(selectedRestaurant.subscriptionExpiresAt).toLocaleDateString()
                    : 'Muddatsiz (Cheklanmagan)'}
                </span>
              </div>
            </div>

            {/* Suspended Reason Banner if suspended */}
            {selectedRestaurant.status === 'SUSPENDED' && (
              <div className="p-3 bg-red-50 text-red-900 border border-red-200 rounded-xl space-y-1">
                <span className="font-bold block flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Xizmat To'xtatilish Sababi:
                </span>
                <p className="text-red-800 italic">"{selectedRestaurant.suspendedReason || 'Sabab ko\'rsatilmagan'}"</p>
                {selectedRestaurant.suspendedAt && (
                  <span className="text-[10px] text-red-700 block font-mono">
                    To'xtatilgan vaqt: {new Date(selectedRestaurant.suspendedAt).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* Resources overview */}
            <div className="p-3 bg-surface rounded-xl border border-line space-y-2">
              <span className="font-bold text-ink-main block">Bog'langan Resurslar:</span>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-bg rounded-lg">
                  <span className="text-base font-bold text-ink-main block">{selectedRestaurant.hallsCount}</span>
                  <span className="text-[10px] text-ink-secondary">Zallar</span>
                </div>
                <div className="p-2 bg-bg rounded-lg">
                  <span className="text-base font-bold text-ink-main block">{selectedRestaurant.tablesCount}</span>
                  <span className="text-[10px] text-ink-secondary">Stollar</span>
                </div>
                <div className="p-2 bg-bg rounded-lg">
                  <span className="text-base font-bold text-ink-main block">{selectedRestaurant.staffCount}</span>
                  <span className="text-[10px] text-ink-secondary">Xodimlar</span>
                </div>
                <div className="p-2 bg-bg rounded-lg">
                  <span className="text-base font-bold text-brand block">{selectedRestaurant.activeVisitsCount}</span>
                  <span className="text-[10px] text-ink-secondary">Faol Tashrif</span>
                </div>
              </div>
            </div>

            {/* Policy & Security Note */}
            <div className="p-3 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl space-y-1 text-[11px]">
              <span className="font-bold text-slate-900 block">Xavfsizlik Kafolatlari:</span>
              <p>
                • Platforma Super Admini uchun restoranni hard delete qiluvchi kundalik tugma mavjud emas.
                <br />
                • Maxfiy kalitlar, parollar va to'liq so'rov yuklamalari ekranga aslo chiqarilmaydi.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => setDetailModalOpen(false)}>
                Yopish
              </Button>
              <div className="flex items-center gap-2">
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
                    setSupportReason('');
                    setSupportDuration('30');
                    setSupportReadOnly(true);
                    setSupportModalOpen(true);
                  }}
                  className="text-xs border-amber-500 text-amber-800 hover:bg-amber-50 h-8"
                >
                  <LogIn className="w-3.5 h-3.5 mr-1" />
                  Support Sessiyasi
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
