import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Database,
  Server,
  User,
  LogOut,
  LogIn,
  Store,
  ShieldAlert,
  KeyRound,
} from 'lucide-react';
import { formatMoneyUzs } from '@menurest/shared';
import { LoginModal } from './components/LoginModal.tsx';
import { RestaurantSelectorModal } from './components/RestaurantSelectorModal.tsx';
import { ChangePasswordModal } from './components/ChangePasswordModal.tsx';
import { GuestView } from './views/GuestView.tsx';
import { WaiterView } from './views/WaiterView.tsx';
import { KitchenView } from './views/KitchenView.tsx';
import { CashierView } from './views/CashierView.tsx';
import { ManagerView } from './views/ManagerView.tsx';
import { SuperAdminView } from './views/SuperAdminView.tsx';
import { LandingView } from './views/LandingView.tsx';

interface HealthStatus {
  status: string;
  timestamp: string;
  uptimeSeconds: number;
}

interface ReadyStatus {
  ready: boolean;
  database: string;
  timestamp: string;
}

interface UserProfile {
  user: {
    id: string;
    phone: string;
    fullName: string;
    isSuperAdmin: boolean;
  };
  activeRestaurant: {
    id: string;
    name: string;
    slug: string;
    isActive?: boolean;
    suspendedReason?: string | null;
    subscriptionExpiresAt?: string | null;
  } | null;
  roles: string[];
  permissions: string[];
  availableRestaurants?: {
    id: string;
    name: string;
    slug: string;
    roles: string[];
  }[];
  csrfToken?: string;
}

type PreviewRole = 'HOME' | 'SESSION' | 'GUEST' | 'WAITER' | 'KITCHEN' | 'CASHIER' | 'MANAGER' | 'BOSS' | 'SUPER_ADMIN';

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [ready, setReady] = useState<ReadyStatus | null>(null);
  const [authProfile, setAuthProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [restaurantModalOpen, setRestaurantModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);

  function detectRoleFromUrl(): PreviewRole {
    try {
      const path = window.location.pathname.toLowerCase();
      const search = window.location.search.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const target = `${path} ${search} ${hash}`;

      if (target.includes('super_admin') || target.includes('superadmin') || target.includes('super-admin') || target.includes('platform')) {
        return 'SUPER_ADMIN';
      }
      if (target.includes('waiter')) return 'WAITER';
      if (target.includes('kitchen')) return 'KITCHEN';
      if (target.includes('cashier')) return 'CASHIER';
      if (target.includes('manager')) return 'MANAGER';
      if (target.includes('boss')) return 'BOSS';
      if (target.includes('session')) return 'SESSION';
      if (target.includes('/table/') || target.includes('qr=') || target.includes('token=') || target.includes('guest')) {
        return 'GUEST';
      }
    } catch {}
    return 'HOME';
  }

  // Active View / Preview Role Switcher (Default: HOME, or GUEST if scanning a table QR)
  const [currentRoleView, setCurrentRoleView] = useState<PreviewRole>(detectRoleFromUrl);

  const switchRole = (role: PreviewRole) => {
    setCurrentRoleView(role);
    try {
      const hashName = role === 'HOME' ? '' : `#${role.toLowerCase()}`;
      if (window.location.hash !== hashName) {
        window.location.hash = hashName;
      }
    } catch {}
  };



  // Active support session in localStorage
  const [supportSession, setSupportSession] = useState<{
    token: string;
    restaurantId: string;
    restaurantName: string;
    reason: string;
    isReadOnly: boolean;
    expiresAt: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('menurest_support_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleUrlChange = () => {
      setCurrentRoleView(detectRoleFromUrl());
    };
    const handleSupportChange = () => {
      try {
        const saved = localStorage.getItem('menurest_support_session');
        setSupportSession(saved ? JSON.parse(saved) : null);
      } catch {
        setSupportSession(null);
      }
    };
    const handleAuthChange = () => {
      fetch('/api/v1/auth/me', { credentials: 'include' })
        .then((r) => r.json())
        .then((resMe) => {
          if (resMe?.success) setAuthProfile(resMe.data);
        })
        .catch(() => null);
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('storage', handleSupportChange);
    window.addEventListener('menurest_support_change', handleSupportChange);
    window.addEventListener('menurest_auth_change', handleAuthChange);

    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('storage', handleSupportChange);
      window.removeEventListener('menurest_support_change', handleSupportChange);
      window.removeEventListener('menurest_auth_change', handleAuthChange);
    };
  }, []);

  async function handleRevokeGlobalSupportSession() {
    if (!supportSession) return;
    try {
      await fetch(`/api/v1/platform/restaurants/${supportSession.restaurantId}/support-session/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ supportToken: supportSession.token }),
      });
    } catch (err) {
      console.error('Revoke support error:', err);
    } finally {
      localStorage.removeItem('menurest_support_session');
      setSupportSession(null);
      window.dispatchEvent(new Event('menurest_support_change'));
    }
  }

  // Fetch initial status and session
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [resHealth, resReady, resMe] = await Promise.all([
          fetch('/api/health').then((r) => r.json()).catch(() => null),
          fetch('/api/ready').then((r) => r.json()).catch(() => null),
          fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        ]);
        if (resHealth?.success) setHealth(resHealth.data);
        if (resReady?.success) setReady(resReady.data);
        if (resMe?.success) setAuthProfile(resMe.data);
      } catch (err) {
        console.error('Initial data load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  async function handleLogout() {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': authProfile?.csrfToken || '',
        },
      });
      setAuthProfile(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  async function handleSwitchRestaurant(targetRestaurantId: string) {
    try {
      const res = await fetch('/api/v1/auth/switch-restaurant', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': authProfile?.csrfToken || '',
        },
        body: JSON.stringify({ restaurantId: targetRestaurantId }),
      });
      const data = await res.json();
      if (data.success) {
        const meRes = await fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => r.json());
        if (meRes?.success) setAuthProfile(meRes.data);
      }
    } catch (err) {
      console.error('Switch restaurant error:', err);
    }
  }

  // Preview Switcher Bar - hidden
  const PreviewSwitcherBar = null;

  return (
    <div className="min-h-screen bg-bg text-ink-main flex flex-col font-sans">
      {/* Top Preview Bar */}
      {PreviewSwitcherBar}

      {/* Suspended Restaurant Warning Banner */}
      {authProfile?.activeRestaurant && authProfile.activeRestaurant.isActive === false && (
        <div className="bg-red-600 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 shadow-sm border-b border-red-700 sticky top-10 z-40">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-white animate-bounce" />
            <span>
              <strong>XIZMAT TO'XTATILGAN (SUSPENDED):</strong> Yangi tashrif ochish va yangi buyurtma kiritish cheklangan.
              Mavjud hisoblar va qabul qilingan taomlarni yakunlash mumkin.
              {authProfile.activeRestaurant.suspendedReason && (
                <span className="ml-1 opacity-95">• Sabab: "{authProfile.activeRestaurant.suspendedReason}"</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Active Support Mode Global Banner */}
      {supportSession && currentRoleView !== 'SUPER_ADMIN' && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 font-semibold text-xs flex flex-wrap items-center justify-between gap-2 shadow-sm border-b border-amber-600 sticky top-10 z-40">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-950 animate-pulse shrink-0" />
            <span>
              <strong>SUPPORT REJIMI FAOL:</strong> "{supportSession.restaurantName}" restorani • Sabab: "{supportSession.reason}" • Rejim: {supportSession.isReadOnly ? 'O\'qish (Read-Only)' : 'To\'liq (Mutation)'} • Tugaydi: {new Date(supportSession.expiresAt).toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={handleRevokeGlobalSupportSession}
            className="px-2.5 py-1 rounded bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 transition-colors shrink-0"
          >
            Sessiyani Yakunlash & Chiqish
          </button>
        </div>
      )}

      {/* Render Selected View */}
      {currentRoleView === 'HOME' && (
        <LandingView
          authProfile={authProfile}
          onOpenLogin={() => setLoginModalOpen(true)}
          onSelectRoleView={(role) => switchRole(role)}
          onOpenRestaurantMenu={(_slug) => switchRole('GUEST')}
        />
      )}
      {currentRoleView === 'GUEST' && <GuestView />}
      {currentRoleView === 'WAITER' && <WaiterView />}
      {currentRoleView === 'KITCHEN' && <KitchenView />}
      {currentRoleView === 'CASHIER' && <CashierView />}
      {currentRoleView === 'MANAGER' && (
        <ManagerView
          initialRole="MANAGER"
          activeRestaurantId={authProfile?.activeRestaurant?.id}
          authProfile={authProfile}
          onLogout={handleLogout}
          onSwitchRole={(role) => switchRole(role as any)}
          onOpenRestaurantSelector={() => setRestaurantModalOpen(true)}
        />
      )}
      {currentRoleView === 'BOSS' && (
        <ManagerView
          initialRole="BOSS"
          activeRestaurantId={authProfile?.activeRestaurant?.id}
          authProfile={authProfile}
          onLogout={handleLogout}
          onSwitchRole={(role) => switchRole(role as any)}
          onOpenRestaurantSelector={() => setRestaurantModalOpen(true)}
        />
      )}
      {currentRoleView === 'SUPER_ADMIN' && <SuperAdminView />}

      {/* Production RBAC Session Dashboard */}
      {currentRoleView === 'SESSION' && (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="bg-brand-900 text-white shadow-md border-b border-brand-800 sticky top-10 z-40">
            <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img src="/logo.svg" alt="MENUREST.UZ" className="w-10 h-10 rounded-xl object-contain shadow-md shrink-0" />
                <div>
                  <span className="text-xl font-bold tracking-tight text-white">MENUREST.UZ</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {authProfile ? (
                  <div className="flex items-center space-x-3">
                    {/* Active Restaurant Pill */}
                    {authProfile.activeRestaurant && (
                      <button
                        onClick={() => setRestaurantModalOpen(true)}
                        className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-brand-800 hover:bg-brand-700 text-xs text-brand-100 border border-brand-700 transition-colors"
                      >
                        <Store className="w-3.5 h-3.5 text-brand-300" />
                        <span className="font-semibold">{authProfile.activeRestaurant.name}</span>
                      </button>
                    )}

                    {/* User Pill */}
                    <div className="flex items-center space-x-2 bg-brand-950/80 px-3 py-1.5 rounded-xl border border-brand-800 text-xs">
                      <User className="w-3.5 h-3.5 text-brand-300" />
                      <div className="text-left">
                        <span className="font-bold text-white block leading-tight">{authProfile.user.fullName}</span>
                        <span className="text-[10px] text-brand-300 block">{authProfile.roles.join(', ')}</span>
                      </div>
                    </div>

                    {/* Change Password Button */}
                    <button
                      onClick={() => setChangePasswordModalOpen(true)}
                      className="p-2 rounded-xl bg-brand-800 hover:bg-brand-700 text-brand-200 hover:text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title="Parolni o'zgartirish"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>

                    {/* Logout Button */}
                    <button
                      onClick={handleLogout}
                      className="p-2 rounded-xl bg-brand-800 hover:bg-red-700 text-brand-200 hover:text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title="Tizimdan chiqish"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setLoginModalOpen(true)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-colors min-h-[44px]"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Xodim Kirishi</span>
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Main Dashboard */}
          <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="bg-surface rounded-2xl p-6 sm:p-8 shadow-subtle border border-line flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-ink-main tracking-tight">
                  Xodim Shaxsiy Kabineti
                </h1>
                <p className="text-ink-secondary max-w-2xl text-sm">
                  Tizimdagi faol xodim va biriktirilgan restoran ma'lumotlari.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="w-full sm:w-auto px-4 py-3 bg-brand-50 rounded-xl border border-brand-200 text-brand text-center font-bold text-sm">
                  Valyuta formati: {formatMoneyUzs(4500000n)}
                </div>
              </div>
            </div>

            {/* Authenticated User Status Dashboard */}
            {authProfile ? (
              <div className="bg-surface rounded-2xl p-6 border border-brand-200 shadow-subtle space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-bold text-ink-main text-base">{authProfile.user.fullName}</span>
                      <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand text-xs font-semibold">
                        {authProfile.roles.join(', ')}
                      </span>
                    </div>
                    <div className="text-xs text-ink-secondary font-mono">
                      Telefon: {authProfile.user.phone} • Faol Restoran: {authProfile.activeRestaurant?.name || 'Super Admin'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setChangePasswordModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-bg text-ink-main text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[44px]"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-brand" /> Parolni O'zgartirish
                    </button>
                    {authProfile.availableRestaurants && authProfile.availableRestaurants.length > 1 && (
                      <button
                        onClick={() => setRestaurantModalOpen(true)}
                        className="px-3 py-1.5 rounded-xl border border-brand-300 bg-brand-50 hover:bg-brand-100 text-brand text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[44px]"
                      >
                        <Store className="w-3.5 h-3.5" /> Restoran Tanlash ({authProfile.availableRestaurants.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Permissions Badges */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-ink-secondary flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-brand" />
                    Server tomonidan tasdiqlangan huquqlar ({authProfile.permissions.length} ta):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {authProfile.permissions.map((p) => (
                      <span
                        key={p}
                        className="px-2.5 py-1 rounded-lg bg-bg text-ink-main border border-line text-xs font-mono"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="font-bold text-amber-900 text-sm flex items-center justify-center sm:justify-start gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-700" />
                    Hozirda server sessiyasiga kirmagansiz
                  </h3>
                  <p className="text-xs text-amber-700">
                    Tizim imkoniyatlaridan to'liq foydalanish uchun xodim hisobingiz bilan tizimga kiring.
                  </p>
                </div>
                <button
                  onClick={() => setLoginModalOpen(true)}
                  className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold transition-colors shrink-0 shadow-sm flex items-center gap-2 min-h-[44px]"
                >
                  <LogIn className="w-4 h-4" /> Kirish Oynasini Ochish
                </button>
              </div>
            )}

            {/* System Health & Readiness */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface p-6 rounded-2xl shadow-subtle border border-line space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-800">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink-main">API Health Holati</h3>
                      <p className="text-xs text-ink-secondary">GET /api/health</p>
                    </div>
                  </div>
                  {loading ? (
                    <span className="text-xs text-ink-secondary">Tekshirilmoqda...</span>
                  ) : health ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ISHLAMOQDA
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                      <AlertCircle className="w-3.5 h-3.5" /> XATOLIK
                    </span>
                  )}
                </div>
                <div className="bg-bg rounded-xl p-3 text-xs font-mono text-ink-secondary border border-line space-y-1">
                  <div>Uptime: {health ? `${Math.round(health.uptimeSeconds)} soniya` : '—'}</div>
                  <div>Vaqt: {health ? new Date(health.timestamp).toLocaleTimeString() : '—'}</div>
                </div>
              </div>

              <div className="bg-surface p-6 rounded-2xl shadow-subtle border border-line space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-blue-100 rounded-xl text-blue-800">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink-main">PostgreSQL DB Readiness</h3>
                      <p className="text-xs text-ink-secondary">GET /api/ready</p>
                    </div>
                  </div>
                  {loading ? (
                    <span className="text-xs text-ink-secondary">Tekshirilmoqda...</span>
                  ) : ready?.ready ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ULANGAN
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5" /> ULASH KUTILMOQDA
                    </span>
                  )}
                </div>
                <div className="bg-bg rounded-xl p-3 text-xs font-mono text-ink-secondary border border-line space-y-1">
                  <div>Baza holati: {ready?.database || 'Ulanmagan'}</div>
                  <div>Tekshiruv vaqti: {ready ? new Date(ready.timestamp).toLocaleTimeString() : '—'}</div>
                </div>
              </div>
            </div>
          </main>

          <footer className="bg-surface border-t border-line py-4 text-center text-xs text-ink-secondary">
            MENUREST.UZ v2.0 • Azizjon Norimboyev • O'zbekiston
          </footer>
        </div>
      )}

      {/* Modals */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={(profile) => {
          setAuthProfile(profile);
          if (profile?.user?.isSuperAdmin) {
            switchRole('SUPER_ADMIN');
          } else if (profile?.roles?.includes('BOSS')) {
            switchRole('BOSS');
          } else if (profile?.roles?.includes('MANAGER')) {
            switchRole('MANAGER');
          } else if (profile?.roles?.includes('CASHIER')) {
            switchRole('CASHIER');
          } else if (profile?.roles?.includes('KITCHEN')) {
            switchRole('KITCHEN');
          } else if (profile?.roles?.includes('WAITER')) {
            switchRole('WAITER');
          } else {
            switchRole('SESSION');
          }
        }}
      />

      <RestaurantSelectorModal
        isOpen={restaurantModalOpen}
        onClose={() => setRestaurantModalOpen(false)}
        restaurants={authProfile?.availableRestaurants || []}
        activeRestaurantId={authProfile?.activeRestaurant?.id}
        onSelect={handleSwitchRestaurant}
      />

      <ChangePasswordModal
        isOpen={changePasswordModalOpen}
        onClose={() => setChangePasswordModalOpen(false)}
      />


    </div>
  );
}
