import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Bell,
  ChefHat,
  CreditCard,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  Phone,
  Send,
  Store,
  Sparkles,
  ArrowRight,
  Search,
  Check,
  MapPin,
  Smartphone,
  Laptop,
  ChevronDown,
  HelpCircle,
  Zap,
  TrendingUp,
  FileCheck,
  LogIn,
  Menu,
  X,
  Users,
  Receipt,
  Clock,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { BrandLogo } from '../components/ui/BrandLogo.tsx';

interface PublicRestaurant {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  openingHours?: string | null;
  subscriptionPlan: string;
  _count: {
    tables: number;
    menuItems: number;
    halls: number;
  };
}

interface LandingViewProps {
  authProfile?: {
    user: {
      fullName: string;
      phone: string;
      isSuperAdmin: boolean;
    };
    activeRestaurant?: {
      id: string;
      name: string;
      slug: string;
      isActive?: boolean;
    } | null;
    roles: string[];
  } | null;
  onOpenLogin: () => void;
  onSelectRoleView: (role: 'GUEST' | 'WAITER' | 'KITCHEN' | 'CASHIER' | 'MANAGER' | 'BOSS' | 'SUPER_ADMIN' | 'SESSION') => void;
  onOpenRestaurantMenu?: (slugOrId: string) => void;
}

export function LandingView({
  authProfile,
  onOpenLogin,
  onSelectRoleView,
  onOpenRestaurantMenu,
}: LandingViewProps) {
  const [restaurants, setRestaurants] = useState<PublicRestaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pricingCycle, setPricingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    restName: '',
    phone: '',
    city: 'Toshkent',
    plan: 'BUSINESS',
    notes: '',
  });
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // Fetch connected public restaurants
  useEffect(() => {
    let isMounted = true;
    async function loadRestaurants() {
      try {
        setLoadingRestaurants(true);
        const res = await fetch('/api/v1/public/restaurants');
        if (res.ok) {
          const json = await res.json();
          if (json.success && isMounted) {
            setRestaurants(json.data || []);
          }
        }
      } catch (err) {
        console.error('Failed to load restaurants on landing:', err);
      } finally {
        if (isMounted) setLoadingRestaurants(false);
      }
    }
    loadRestaurants();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredRestaurants = restaurants.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.address && r.address.toLowerCase().includes(q)) ||
      (r.phone && r.phone.includes(q))
    );
  });

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.restName || !contactForm.phone) return;
    setContactSubmitted(true);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const faqs = [
    {
      q: 'Mijozlar telefoniga maxsus ilova yuklab olishi kerakmi?',
      a: 'Yo\'q, mutlaqo shart emas! Mehmon stoldagi QR kodni o\'z telefon kamerasida skanerlaydi va menyu darhol brauzerda (Chrome, Safari va b.) ochiladi.',
    },
    {
      q: 'Tizimni ishlatish uchun qanday qurilmalar kerak bo\'ladi?',
      a: 'Hech qanday qimmat uskunalar talab qilinmaydi. Ofitsiantlar o\'z smartfonlarida, oshxona planshetda, kassa esa mavjud har qanday kompyuter yoki noutbukda ishlayveradi.',
    },
    {
      q: 'Menyu, taom rasmlari va narxlarni o\'zimiz mustaqil o\'zgartira olamizmi?',
      a: 'Albatta! Menejer yoki Restoran Egasi (Boss) paneli orqali 1 daqiqa ichida yangi taom qo\'shish, narxlarni yangilash yoki vaqtincha tugagan taomni to\'xtatib qo\'yish mumkin.',
    },
    {
      q: 'Internet tezligi past bo\'lsa yoki uzilib qolsa tizim qanday ishlaydi?',
      a: 'Menurest.uz yengil va yuqori tezlikka moslangan bo\'lib, hatto 3G mobil internetda ham barqaror ishlaydi. Ma\'lumotlar xavfsiz serverda saqlanadi.',
    },
    {
      q: 'Boshlashda bizga menyuni kiritishda yordam berasizmi?',
      a: 'Ha, albatta! Mutaxassislarimiz mavjud qog\'oz menyungizni tizimga bepul kiritib, xodimlaringizga tizimdan qanday foydalanishni 1 kunda to\'liq o\'rgatib berishadi.',
    },
  ];

  return (
    <div className="min-h-screen bg-bg text-ink-main flex flex-col font-sans selection:bg-brand/20">
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-line shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div
            className="flex items-center space-x-3 cursor-pointer select-none"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <BrandLogo size="md" />
            <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              O'zbekistonda №1 Ekotizim
            </span>
          </div>

          <nav className="hidden lg:flex items-center space-x-7 text-sm font-semibold text-ink-secondary">
            <button onClick={() => scrollToSection('features-section')} className="hover:text-brand transition-colors">
              Imkoniyatlar
            </button>
            <button onClick={() => scrollToSection('how-it-works-section')} className="hover:text-brand transition-colors">
              Qanday Ishlaydi?
            </button>
            <button onClick={() => scrollToSection('roles-section')} className="hover:text-brand transition-colors flex items-center gap-1.5">
              <span>Rollar Portali</span>
              <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-black uppercase">
                Demo
              </span>
            </button>
            <button onClick={() => scrollToSection('pricing-section')} className="hover:text-brand transition-colors">
              Tariflar
            </button>
            <button onClick={() => scrollToSection('faq-section')} className="hover:text-brand transition-colors">
              Savollar
            </button>
            <button onClick={() => scrollToSection('contact-section')} className="hover:text-brand transition-colors">
              Bog'lanish
            </button>
          </nav>

          <div className="flex items-center space-x-2">
            {authProfile?.activeRestaurant ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-bold text-ink-main flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {authProfile.activeRestaurant.name}
                  </span>
                  <span className="text-[10px] text-ink-secondary font-medium">
                    {authProfile.user.fullName} ({authProfile.roles.join(', ')})
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onSelectRoleView('SESSION')}
                  className="gap-1.5 shadow-sm"
                >
                  <Store className="w-4 h-4" />
                  <span>Mening Panelim</span>
                </Button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onSelectRoleView('SUPER_ADMIN')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all border border-slate-700 min-h-[40px] shadow-xs"
                  title="Super Admin boshqaruv paneliga kirish"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Super Admin</span>
                </button>

                <Button size="sm" variant="primary" onClick={onOpenLogin} className="gap-1.5 shadow-sm min-h-[40px] font-bold">
                  <LogIn className="w-4 h-4" />
                  <span>Xodim Kirishi</span>
                </Button>

                {/* Mobile Menu Toggle Button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 rounded-xl border border-line bg-surface text-ink-main hover:bg-bg transition-colors"
                  aria-label="Menyuni ochish"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5 text-ink-main" /> : <Menu className="w-5 h-5 text-ink-main" />}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Dropdown Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-line bg-surface/98 backdrop-blur-xl px-4 py-4 space-y-4 shadow-xl">
            <nav className="flex flex-col space-y-1.5 text-sm font-semibold text-ink-secondary">
              <button
                onClick={() => {
                  scrollToSection('features-section');
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 px-3 rounded-xl hover:bg-bg hover:text-brand transition-colors"
              >
                Imkoniyatlar
              </button>
              <button
                onClick={() => {
                  scrollToSection('how-it-works-section');
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 px-3 rounded-xl hover:bg-bg hover:text-brand transition-colors"
              >
                Qanday Ishlaydi?
              </button>
              <button
                onClick={() => {
                  scrollToSection('roles-section');
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 px-3 rounded-xl hover:bg-bg hover:text-brand transition-colors flex items-center justify-between"
              >
                <span>Rollar Portali</span>
                <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-black uppercase">
                  Demo
                </span>
              </button>
              <button
                onClick={() => {
                  scrollToSection('pricing-section');
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 px-3 rounded-xl hover:bg-bg hover:text-brand transition-colors"
              >
                Tariflar
              </button>
              <button
                onClick={() => {
                  scrollToSection('faq-section');
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 px-3 rounded-xl hover:bg-bg hover:text-brand transition-colors"
              >
                Savollar
              </button>
              <button
                onClick={() => {
                  scrollToSection('contact-section');
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 px-3 rounded-xl hover:bg-bg hover:text-brand transition-colors"
              >
                Bog'lanish
              </button>
            </nav>

            <div className="pt-3 border-t border-line flex flex-col gap-2">
              <button
                onClick={() => {
                  onSelectRoleView('SUPER_ADMIN');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-900 text-white flex items-center justify-center gap-2 shadow-sm"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Super Admin Paneli (+998901111111)</span>
              </button>
              <Button
                size="md"
                variant="primary"
                onClick={() => {
                  onOpenLogin();
                  setMobileMenuOpen(false);
                }}
                className="w-full font-bold gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Xodim Kirishi</span>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-500/10 via-brand-50/20 to-bg pt-10 pb-20 sm:pt-16 sm:pb-28 border-b border-line">
        {/* Ambient Top Glow Orbs */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-brand/20 to-transparent blur-3xl rounded-full opacity-60 -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-brand/20 shadow-xs text-xs font-bold text-ink-main hover:border-brand/40 transition-colors cursor-default">
                <span className="flex h-2 w-2 rounded-full bg-brand animate-pulse" />
                <span className="text-brand">YANGILIK:</span>
                <span className="text-ink-secondary">Click, Payme & 1–10+ xodimli moslashuvchan rejim</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-ink-main tracking-tight leading-[1.12]">
                Aqlli <span className="text-brand bg-gradient-to-r from-brand to-brand-hover bg-clip-text text-transparent">QR Menyu</span>, Tezkor Oshxona va Aniq Kassa.
              </h1>

              <p className="text-base sm:text-lg text-ink-secondary max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                Mijozlar telefoniga ilova yuklamasdan stoldan QR orqali buyurtma beradi. Ofitsiant va oshxona soniyalarda xabar oladi.
                Naqd, Terminal, Click va Payme to'lovlari 100% aniqlikda boshqariladi.
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-2">
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => scrollToSection('contact-section')}
                  className="gap-2 shadow-lg shadow-brand/25 hover:shadow-xl transition-all font-bold text-sm sm:text-base py-3.5 px-6 rounded-2xl"
                >
                  <Store className="w-5 h-5" />
                  <span>Restoranni Ulash (Bepul Sinash)</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => scrollToSection('roles-section')}
                  className="gap-2 bg-surface font-semibold text-sm sm:text-base py-3.5 px-6 rounded-2xl border-line hover:border-brand shadow-xs"
                >
                  <Laptop className="w-5 h-5 text-brand" />
                  <span>Rollar va Panellarni Sinash</span>
                </Button>
              </div>

              {/* Tezkor Demo Rollar Chizig'i (1-bosishda interaktiv sinash) */}
              <div className="pt-2 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-secondary flex items-center justify-center lg:justify-start gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Istalgan rolni hoziroq sinab ko'ring (1-bosishda):</span>
                </div>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5">
                  <button
                    onClick={() => onSelectRoleView('GUEST')}
                    className="px-2.5 py-1.5 rounded-xl bg-surface border border-line hover:border-brand text-xs font-semibold text-ink-main shadow-xs flex items-center gap-1.5 hover:bg-brand/5 transition-all"
                    title="Mehmon QR menyu ko'rinishi"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-brand" />
                    <span>1. Mehmon (QR)</span>
                  </button>
                  <button
                    onClick={() => onSelectRoleView('WAITER')}
                    className="px-2.5 py-1.5 rounded-xl bg-surface border border-line hover:border-brand text-xs font-semibold text-ink-main shadow-xs flex items-center gap-1.5 hover:bg-brand/5 transition-all"
                    title="Ofitsiant mobil paneli"
                  >
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    <span>2. Ofitsiant</span>
                  </button>
                  <button
                    onClick={() => onSelectRoleView('KITCHEN')}
                    className="px-2.5 py-1.5 rounded-xl bg-surface border border-line hover:border-brand text-xs font-semibold text-ink-main shadow-xs flex items-center gap-1.5 hover:bg-brand/5 transition-all"
                    title="Oshxona va Bar KDS planshet ekrani"
                  >
                    <ChefHat className="w-3.5 h-3.5 text-indigo-600" />
                    <span>3. Oshxona (KDS)</span>
                  </button>
                  <button
                    onClick={() => onSelectRoleView('CASHIER')}
                    className="px-2.5 py-1.5 rounded-xl bg-surface border border-line hover:border-brand text-xs font-semibold text-ink-main shadow-xs flex items-center gap-1.5 hover:bg-brand/5 transition-all"
                    title="Kassa POS kompyuter ekrani"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                    <span>4. Kassa (POS)</span>
                  </button>
                  <button
                    onClick={() => onSelectRoleView('MANAGER')}
                    className="px-2.5 py-1.5 rounded-xl bg-surface border border-line hover:border-brand text-xs font-semibold text-ink-main shadow-xs flex items-center gap-1.5 hover:bg-brand/5 transition-all"
                    title="Restoran boshqaruvchisi va hisobotlar"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
                    <span>5. Menejer</span>
                  </button>
                  <button
                    onClick={() => onSelectRoleView('BOSS')}
                    className="px-2.5 py-1.5 rounded-xl bg-surface border border-line hover:border-brand text-xs font-semibold text-ink-main shadow-xs flex items-center gap-1.5 hover:bg-brand/5 transition-all"
                    title="Restoran egasi moliyaviy nazorat"
                  >
                    <Store className="w-3.5 h-3.5 text-rose-600" />
                    <span>6. Boss</span>
                  </button>
                  <button
                    onClick={() => onSelectRoleView('SUPER_ADMIN')}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-brand text-xs font-bold text-white shadow-xs flex items-center gap-1.5 transition-all"
                    title="Super Admin platforma nazorati"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>7. Super Admin</span>
                  </button>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-line/80 max-w-2xl mx-auto lg:mx-0">
                <div className="p-3.5 bg-surface rounded-2xl border border-line shadow-xs space-y-1">
                  <div className="text-2xl font-black text-ink-main tracking-tight">0 ta Ilova</div>
                  <div className="text-xs text-ink-secondary">Brauzerda darhol ochiladi</div>
                </div>
                <div className="p-3.5 bg-surface rounded-2xl border border-line shadow-xs space-y-1">
                  <div className="text-2xl font-black text-brand tracking-tight">2x Tezroq</div>
                  <div className="text-xs text-ink-secondary">Buyurtma va stolga xizmat</div>
                </div>
                <div className="p-3.5 bg-surface rounded-2xl border border-line shadow-xs space-y-1">
                  <div className="text-2xl font-black text-ink-main tracking-tight">100% Aniq</div>
                  <div className="text-xs text-ink-secondary">Naqd, Karta, Click, Payme</div>
                </div>
                <div className="p-3.5 bg-surface rounded-2xl border border-line shadow-xs space-y-1">
                  <div className="text-2xl font-black text-ink-main tracking-tight">1–10+</div>
                  <div className="text-xs text-ink-secondary">Har qanday jamoa formati</div>
                </div>
              </div>

              {/* Segment Chips */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 pt-1 text-xs text-ink-secondary">
                <span className="font-semibold text-ink-main text-[11px] mr-1">Mos formatlar:</span>
                <span className="px-2.5 py-1 rounded-full bg-surface border border-line text-[11px] font-medium">☕ Qahvaxonalar & Barlar</span>
                <span className="px-2.5 py-1 rounded-full bg-surface border border-line text-[11px] font-medium">🥟 Milliy Taomlar & Choyxona</span>
                <span className="px-2.5 py-1 rounded-full bg-surface border border-line text-[11px] font-medium">🍔 Fast-Food & Lavash</span>
                <span className="px-2.5 py-1 rounded-full bg-surface border border-line text-[11px] font-medium">🍕 Pitseriya & Burger</span>
                <span className="px-2.5 py-1 rounded-full bg-surface border border-line text-[11px] font-medium">🍽️ Katta Restoranlar</span>
              </div>
            </div>

            {/* Hero Visual Mockup */}
            <div className="lg:col-span-5 relative">
              <div className="absolute -inset-2 bg-gradient-to-r from-brand/20 to-purple-500/20 rounded-3xl blur-2xl opacity-60 -z-10" />

              <div className="bg-surface rounded-3xl p-6 shadow-2xl border border-line relative overflow-hidden space-y-4">
                <div className="flex items-center justify-between pb-3.5 border-b border-line">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-ink-main ml-2 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-brand" />
                      Rayhon Chilonzor • Stol #4
                    </span>
                  </div>
                  <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Jonli Rejim (SSE)
                  </span>
                </div>

                {/* Simulated Order Process Cards */}
                <div className="space-y-3">
                  <div className="p-3.5 bg-brand-50/70 rounded-2xl border border-brand-200 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center font-black text-sm shadow-sm">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-ink-main flex items-center gap-1.5">
                          <span>1. Mehmon Buyurtmasi (QR)</span>
                          <span className="text-[10px] font-mono bg-brand-100 text-brand-900 px-1.5 py-0.5 rounded font-bold">PIN: 4821</span>
                        </div>
                        <div className="text-[11px] text-ink-secondary">
                          Choyxona palov x2, Shashlik x2, Ko'k choy x1
                        </div>
                      </div>
                    </div>
                    <Badge variant="success" size="sm">145 000 UZS</Badge>
                  </div>

                  <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-sm">
                        <ChefHat className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-ink-main flex items-center gap-1.5">
                          <span>2. Oshxona KDS Qabul Qildi</span>
                          <span className="text-[10px] text-amber-800 font-semibold flex items-center gap-0.5">
                            <Clock className="w-3 h-3" /> 03:45 daqiqa
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-secondary">
                          Issiq oshxona • Tayyorlanmoqda va yetkazilmoqda
                        </div>
                      </div>
                    </div>
                    <Badge variant="warning" size="sm">Oshpaz Boshladi</Badge>
                  </div>

                  <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-ink-main flex items-center gap-1.5">
                          <span>3. Hisob va To'lov (Kassa / Ofitsiant)</span>
                        </div>
                        <div className="text-[11px] text-ink-secondary flex items-center gap-2 pt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-[#00aaff]/15 text-[#0088cc] font-black text-[9px]">CLICK</span>
                          <span className="px-1.5 py-0.2 rounded bg-[#00cccc]/15 text-[#00a896] font-black text-[9px]">PAYME</span>
                          <span className="text-[10px] text-emerald-800 font-medium">To'liq to'landi</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="success" size="sm">Yakunlandi</Badge>
                  </div>
                </div>

                <div className="pt-3 border-t border-line flex items-center justify-between text-xs text-ink-secondary">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Real-vaqt sinxronizatsiya</span>
                  </div>
                  <span className="font-bold text-brand">Kassada 0% xatolik</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. How It Works (Qanday Ishlaydi?) */}
      <section id="how-it-works-section" className="py-16 sm:py-24 bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand text-xs font-bold">
              <Zap className="w-3.5 h-3.5" />
              <span>ODDIY VA TEZKOR</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-ink-main tracking-tight">
              Tizim Qanday Ishlaydi?
            </h2>
            <p className="text-ink-secondary text-sm sm:text-base">
              Mehmon stolga kelganidan to hisob to'languncha barcha jarayon 3 oddiy bosqichda to'liq avtomatlashtiriladi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-bg rounded-3xl p-8 border border-line space-y-4 relative group hover:border-brand/40 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-200 text-brand flex items-center justify-center font-black text-xl">
                01
              </div>
              <h3 className="text-lg font-bold text-ink-main">Mehmon QR Skanerlaydi</h3>
              <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
                Mijoz stol ustidagi QR kodni skanerlab menyuni ko'radi. Ilova o'rnatish shart emas. Taomlarni savatga qo'shib, o'zi buyurtma beradi.
              </p>
            </div>

            <div className="bg-bg rounded-3xl p-8 border border-line space-y-4 relative group hover:border-brand/40 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-black text-xl">
                02
              </div>
              <h3 className="text-lg font-bold text-ink-main">Oshxona va Ofitsiant Biladi</h3>
              <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
                Buyurtma bir zumda oshxona ekranida (KDS) paydo bo'ladi. Oshpaz tayyorlashni boshlaydi, ofitsiant esa tayyor bo'lgan taomni stolga eltadi.
              </p>
            </div>

            <div className="bg-bg rounded-3xl p-8 border border-line space-y-4 relative group hover:border-brand/40 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black text-xl">
                03
              </div>
              <h3 className="text-lg font-bold text-ink-main">Tezkor Hisob va To'lov</h3>
              <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
                Mijoz hisob so'raganda kassa xodimi bir tugma bilan chek chiqaradi. Naqd, karta yoki aralash to'lov qabul qilinadi va stol bo'shaydi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Features / Asosiy Imkoniyatlar */}
      <section id="features-section" className="py-16 sm:py-24 bg-bg border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>IMKONIYATLAR</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-ink-main tracking-tight">
              Restoraningiz Uchun Nima Beradi?
            </h2>
            <p className="text-ink-secondary text-sm sm:text-base leading-relaxed">
              Biz faqatgina elektron menyu emas, balki butun restoran xizmatini yagona va xatosiz tizimga aylantiruvchi qulay vositalarni taqdim etamiz.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-surface rounded-2xl p-6 border border-line space-y-3 shadow-subtle hover:border-brand/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand flex items-center justify-center">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-ink-main">Raqamli QR Menyu</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Mehmonlar uchun qulay dizayn, taom rasmlari, tarkibi, yarim/to'liq porsiya variantlari va qo'shimchalar tanlash imkoniyati.
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-6 border border-line space-y-3 shadow-subtle hover:border-brand/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-ink-main">Ofitsiant Chaqiruvi</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Mijoz ofitsiantni yoki hisobni bir bosishda chaqiradi. Xabarlar planshetga darhol tushadi va xodimlar tezkor xizmat ko'rsatadi.
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-6 border border-line space-y-3 shadow-subtle hover:border-brand/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <ChefHat className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-ink-main">Oshxona & Bar Ekranlari (KDS)</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Taomlar bo'limlarga (Issiq oshxona, Bar, Mangal) avtomatik ajratiladi. Qog'oz cheklar o'rniga zamonaviy ekran orqali nazorat qilinadi.
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-6 border border-line space-y-3 shadow-subtle hover:border-brand/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-ink-main">Kassa va To'lovlar Nazorati</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Naqd va karta aralash to'lovlar, qaytim hisobi, smena balansi va pre-check cheklari. Kassadagi kamomad va adashishlarga chek qo'yiladi.
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-6 border border-line space-y-3 shadow-subtle hover:border-brand/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-ink-main">Boss Uchun Onlayn Analitika</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Istalgan joydan turib restoranning kunlik tushumi, o'rtacha cheki, eng xaridorgir taomlari va xodimlar hisobotini ko'rib boring.
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-6 border border-line space-y-3 shadow-subtle hover:border-brand/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-ink-main">Qat'iy Xavfsizlik & Audit</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Har bir xodim o'z shaxsiy roli bilan kiradi. Hisobni bekor qilish yoki o'zgartirish faqat ruxsat berilgan shaxslar tomonidan amalga oshiriladi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Connected Restaurants Showcase (Ulangan Restoranlar) */}
      <section id="restaurants-section" className="py-16 sm:py-24 bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand text-xs font-bold">
                <Store className="w-3.5 h-3.5" />
                <span>FAOL RESTORANLAR</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-ink-main tracking-tight">
                Tizimga Ulangan Restoranlar
              </h2>
              <p className="text-ink-secondary text-sm max-w-xl">
                Platformamizdan foydalanayotgan restoranlar va ularning ochiq raqamli menyulari bilan tanishing.
              </p>
            </div>

            {restaurants.length > 0 && (
              <div className="w-full md:w-80 relative">
                <Search className="w-4 h-4 text-ink-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Restoran nomi yoki manzil..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            )}
          </div>

          {loadingRestaurants ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 bg-bg rounded-2xl animate-pulse border border-line p-6" />
              ))}
            </div>
          ) : restaurants.length === 0 ? (
            <div className="bg-gradient-to-r from-brand-50/70 via-bg to-brand-50/70 rounded-3xl border border-brand-200 p-8 sm:p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-brand-100 text-brand flex items-center justify-center mx-auto shadow-sm">
                <Store className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-lg mx-auto">
                <h3 className="text-xl font-bold text-ink-main">Sizning Restoraningiz Bu Yerda Birinchi Bo'lishi Mumkin!</h3>
                <p className="text-xs sm:text-sm text-ink-secondary">
                  Hozirda yangi restoranlar qabul qilinmoqda. Restoraningizni ulang va bepul sozlash hamda sinov muddatiga ega bo'ling.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Button size="md" variant="primary" onClick={() => scrollToSection('contact-section')} className="gap-2">
                  <Store className="w-4 h-4" />
                  <span>Restoran Qo'shish Uchun Ariza</span>
                </Button>
                <Button size="md" variant="outline" onClick={() => onSelectRoleView('SUPER_ADMIN')} className="gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand" />
                  <span>Super Admin orqali qo'shish</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRestaurants.map((rest) => {
                const isCurrentlyActive = authProfile?.activeRestaurant?.id === rest.id;
                return (
                  <div
                    key={rest.id}
                    className={`bg-surface rounded-2xl p-6 border transition-all hover:shadow-lg flex flex-col justify-between space-y-5 ${
                      isCurrentlyActive
                        ? 'border-brand ring-2 ring-brand/20 shadow-md'
                        : 'border-line hover:border-brand/40'
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-200 text-brand flex items-center justify-center font-bold text-lg shrink-0">
                            {rest.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-ink-main leading-tight flex items-center gap-1.5">
                              <span>{rest.name}</span>
                              {isCurrentlyActive && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                                  Faol
                                </span>
                              )}
                            </h3>
                            <span className="text-xs text-ink-secondary font-mono">@{rest.slug}</span>
                          </div>
                        </div>
                        <Badge variant="success">{rest.subscriptionPlan}</Badge>
                      </div>

                      <div className="space-y-2 text-xs text-ink-secondary border-t border-line/80 pt-3">
                        {rest.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                            <span className="truncate">{rest.address}</span>
                          </div>
                        )}
                        {rest.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-brand shrink-0" />
                            <span>{rest.phone}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-bg p-3 rounded-xl border border-line text-center text-xs">
                        <div>
                          <div className="font-bold text-ink-main text-sm">{rest._count.halls} ta</div>
                          <div className="text-[10px] text-ink-secondary">Zal</div>
                        </div>
                        <div className="border-x border-line">
                          <div className="font-bold text-ink-main text-sm">{rest._count.tables} ta</div>
                          <div className="text-[10px] text-ink-secondary">Stol</div>
                        </div>
                        <div>
                          <div className="font-bold text-ink-main text-sm">{rest._count.menuItems} ta</div>
                          <div className="text-[10px] text-ink-secondary">Taom</div>
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        if (onOpenRestaurantMenu) onOpenRestaurantMenu(rest.slug);
                        else onSelectRoleView('GUEST');
                      }}
                      className="w-full gap-1.5"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Menyuni Ko'rish</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 6. Roles Portal Section / Rollar Portali (Interaktiv Demo) */}
      <section id="roles-section" className="py-16 sm:py-24 bg-bg border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand text-xs font-bold">
              <Laptop className="w-3.5 h-3.5" />
              <span>INTERAKTIV DEMO PORTAL</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-ink-main tracking-tight">
              Har Qanday Jamoa Formati (1 kishidan butun tarmoqqacha)
            </h2>
            <p className="text-ink-secondary text-sm sm:text-base">
              1-2 kishilik kichik kafelardan tortib katta restoranlargacha moslashuvchan interfeyslar. Quyidagi kartalar orqali xohlagan rolni sinab ko'rishingiz mumkin:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Guest */}
            <div
              onClick={() => onSelectRoleView('GUEST')}
              className="bg-surface rounded-2xl p-6 border border-line hover:border-brand hover:shadow-lg transition-all cursor-pointer group space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-colors">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink-main group-hover:text-brand transition-colors">
                    1. Mehmon Menyusi
                  </h3>
                  <span className="text-xs text-ink-secondary">QR orqali brauzerda</span>
                </div>
                <p className="text-xs text-ink-secondary">
                  Taom tanlash, savat, buyurtma yuborish, ofitsiant chaqiruvi va hisob so'rash.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-brand">
                <span>Ko'rish</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Waiter */}
            <div
              onClick={() => onSelectRoleView('WAITER')}
              className="bg-surface rounded-2xl p-6 border border-line hover:border-brand hover:shadow-lg transition-all cursor-pointer group space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-colors">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink-main group-hover:text-brand transition-colors">
                    2. Ofitsiant Paneli
                  </h3>
                  <span className="text-xs text-ink-secondary">Mobil planshet/telefon</span>
                </div>
                <p className="text-xs text-ink-secondary">
                  Jonli chaqiruvlarni qabul qilish, yangi buyurtmalarni tasdiqlash, tayyor taomlarni yetkazish.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-brand">
                <span>Ko'rish</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Kitchen */}
            <div
              onClick={() => onSelectRoleView('KITCHEN')}
              className="bg-surface rounded-2xl p-6 border border-line hover:border-brand hover:shadow-lg transition-all cursor-pointer group space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-colors">
                  <ChefHat className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink-main group-hover:text-brand transition-colors">
                    3. Oshxona & Bar (KDS)
                  </h3>
                  <span className="text-xs text-ink-secondary">Katta ekran/planshet</span>
                </div>
                <p className="text-xs text-ink-secondary">
                  Oshxona bo'limlari chiptalari, tayyorlash taymerlari, tayyor deb belgilash.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-brand">
                <span>Ko'rish</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Cashier */}
            <div
              onClick={() => onSelectRoleView('CASHIER')}
              className="bg-surface rounded-2xl p-6 border border-line hover:border-brand hover:shadow-lg transition-all cursor-pointer group space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-colors">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink-main group-hover:text-brand transition-colors">
                    4. Kassa & Smena (POS)
                  </h3>
                  <span className="text-xs text-ink-secondary">POS kassa kompyuteri</span>
                </div>
                <p className="text-xs text-ink-secondary">
                  Ochiq hisoblar, naqd va karta aralash to'lov, pre-check cheki, xavfsiz stol yopish.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-brand">
                <span>Ko'rish</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Manager */}
            <div
              onClick={() => onSelectRoleView('MANAGER')}
              className="bg-surface rounded-2xl p-6 border border-line hover:border-brand hover:shadow-lg transition-all cursor-pointer group space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-colors">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink-main group-hover:text-brand transition-colors">
                    5. Zal Menejeri
                  </h3>
                  <span className="text-xs text-ink-secondary">Zal monitoringi</span>
                </div>
                <p className="text-xs text-ink-secondary">
                  Jonli zal va stollar holati, kechikkan taomlar nazorati, menyu boshqaruvi.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-brand">
                <span>Ko'rish</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Boss */}
            <div
              onClick={() => onSelectRoleView('BOSS')}
              className="bg-surface rounded-2xl p-6 border border-line hover:border-brand hover:shadow-lg transition-all cursor-pointer group space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-colors">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink-main group-hover:text-brand transition-colors">
                    6. Restoran Egasi (Boss)
                  </h3>
                  <span className="text-xs text-ink-secondary">Moliya va hisobotlar</span>
                </div>
                <p className="text-xs text-ink-secondary">
                  Kunlik sof tushum, xizmat haqi, o'rtacha chek va xodimlar harakati jurnali.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-brand">
                <span>Ko'rish</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Super Admin */}
            <div
              onClick={() => onSelectRoleView('SUPER_ADMIN')}
              className="bg-surface rounded-2xl p-6 border border-line hover:border-brand hover:shadow-lg transition-all cursor-pointer group space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-colors">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink-main group-hover:text-brand transition-colors">
                    7. Super Admin
                  </h3>
                  <span className="text-xs text-ink-secondary">Platforma boshqaruvi</span>
                </div>
                <p className="text-xs text-ink-secondary">
                  Yangi restoranlar ochish, obuna muddatlari nazorati, tizim salomatligi.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-brand">
                <span>Ko'rish</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Session API */}
            <div
              onClick={() => onSelectRoleView('SESSION')}
              className="bg-surface rounded-2xl p-6 border border-line hover:border-brand hover:shadow-lg transition-all cursor-pointer group space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-colors">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink-main group-hover:text-brand transition-colors">
                    Haqiqiy Sessiya (API)
                  </h3>
                  <span className="text-xs text-ink-secondary">Server sessiyasi</span>
                </div>
                <p className="text-xs text-ink-secondary">
                  Xodim login va paroli bilan haqiqiy tizimga kirish va server huquqlari holati.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-brand">
                <span>Ochish</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Pricing Plans / Tariflar */}
      <section id="pricing-section" className="py-16 sm:py-24 bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand text-xs font-bold">
              <CreditCard className="w-3.5 h-3.5" />
              <span>SHAFFOF VA QULAY TARIFLAR</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-ink-main tracking-tight">
              Restoraningiz Hajmiga Mos Tarif Rejasi
            </h2>
            <p className="text-ink-secondary text-sm sm:text-base">
              Yashirin to'lovlarsiz, O'zbekiston so'mida shaffof oylik obuna.
            </p>

            {/* Cycle Switcher */}
            <div className="inline-flex p-1 bg-bg rounded-xl border border-line mt-4">
              <button
                onClick={() => setPricingCycle('monthly')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  pricingCycle === 'monthly' ? 'bg-surface text-ink-main shadow-sm' : 'text-ink-secondary'
                }`}
              >
                Oylik To'lov
              </button>
              <button
                onClick={() => setPricingCycle('yearly')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  pricingCycle === 'yearly' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary'
                }`}
              >
                <span>Yillik (2 oy bepul)</span>
                <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full font-extrabold">-17%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* 1. Start Plan */}
            <div className="bg-bg rounded-3xl p-8 border border-line flex flex-col justify-between space-y-6 hover:shadow-lg transition-all">
              <div className="space-y-4">
                <div className="space-y-1">
                  <Badge variant="neutral">Kichik Kafe / Qahvaxona</Badge>
                  <h3 className="text-xl font-black text-ink-main">Boshlang'ich (Start)</h3>
                  <p className="text-xs text-ink-secondary">Kichik kafelar, barlar va qahvaxonalar uchun.</p>
                </div>

                <div className="py-4 border-y border-line space-y-1">
                  <div className="text-3xl font-black text-ink-main">
                    {pricingCycle === 'monthly' ? '290 000' : '2 900 000'}{' '}
                    <span className="text-sm font-semibold text-ink-secondary">UZS / {pricingCycle === 'monthly' ? 'oy' : 'yil'}</span>
                  </div>
                  <div className="text-[11px] text-ink-secondary">Boshlang'ich sozlash bepul</div>
                </div>

                <ul className="space-y-3 text-xs text-ink-main">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span>1 tagacha zal va 10 tagacha stol</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span>Raqamli QR Menyu</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span>Ofitsiant chaqiruvi (Call waiter)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span>Cheksiz taomlar kiritish</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span>2 tagacha xodim akkaunti</span>
                  </li>
                </ul>
              </div>

              <Button
                size="md"
                variant="outline"
                onClick={() => {
                  setContactForm((f) => ({ ...f, plan: 'START' }));
                  scrollToSection('contact-section');
                }}
                className="w-full bg-surface"
              >
                Boshlang'ichni Tanlash
              </Button>
            </div>

            {/* 2. Business Plan (Featured) */}
            <div className="bg-surface rounded-3xl p-8 border-2 border-brand shadow-xl relative flex flex-col justify-between space-y-6">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand text-white text-[11px] font-black uppercase tracking-wider px-4 py-1 rounded-full shadow-md">
                Eng Ko'p Tanlanadigan
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <Badge variant="success">Restoran & Choyxona</Badge>
                  <h3 className="text-xl font-black text-ink-main">Standart (Business)</h3>
                  <p className="text-xs text-ink-secondary">To'liq xizmat ko'rsatuvchi faol restoran va choyxonalar uchun.</p>
                </div>

                <div className="py-4 border-y border-line space-y-1">
                  <div className="text-3xl font-black text-brand">
                    {pricingCycle === 'monthly' ? '590 000' : '5 900 000'}{' '}
                    <span className="text-sm font-semibold text-ink-secondary">UZS / {pricingCycle === 'monthly' ? 'oy' : 'yil'}</span>
                  </div>
                  <div className="text-[11px] text-brand-700 font-medium">Barcha asosiy modullar kiritilgan</div>
                </div>

                <ul className="space-y-3 text-xs text-ink-main">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span><strong>3 tagacha zal va 30 tagacha stol</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span><strong>KDS Oshxona va Bar displeylari</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span><strong>To'liq Kassa (POS), smena balansi, aralash to'lov</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span>Ofitsiant mobil paneli</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span>10 tagacha xodim akkaunti</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span>Jonli yangilanish (SSE)</span>
                  </li>
                </ul>
              </div>

              <Button
                size="md"
                variant="primary"
                onClick={() => {
                  setContactForm((f) => ({ ...f, plan: 'BUSINESS' }));
                  scrollToSection('contact-section');
                }}
                className="w-full shadow-md"
              >
                Standartga Ulanish
              </Button>
            </div>

            {/* 3. Enterprise Plan */}
            <div className="bg-bg rounded-3xl p-8 border border-line flex flex-col justify-between space-y-6 hover:shadow-lg transition-all">
              <div className="space-y-4">
                <div className="space-y-1">
                  <Badge variant="neutral">Katta Tarmoqlar</Badge>
                  <h3 className="text-xl font-black text-ink-main">Premium (Enterprise)</h3>
                  <p className="text-xs text-ink-secondary">Katta restoran majmualari va tarmoqlar uchun.</p>
                </div>

                <div className="py-4 border-y border-line space-y-1">
                  <div className="text-3xl font-black text-ink-main">
                    {pricingCycle === 'monthly' ? '990 000' : '9 900 000'}{' '}
                    <span className="text-sm font-semibold text-ink-secondary">UZS / {pricingCycle === 'monthly' ? 'oy' : 'yil'}</span>
                  </div>
                  <div className="text-[11px] text-ink-secondary">Shaxsiy menejer bilan</div>
                </div>

                <ul className="space-y-3 text-xs text-ink-main">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span><strong>Cheksiz zallar va stollar</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span>Ko'p filialli markaziy boshqaruv</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span>Barcha oshxona stansiyalari</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span>Cheksiz xodimlar akkaunti</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand shrink-0" />
                    <span>24/7 VIP qo'llab-quvvatlash</span>
                  </li>
                </ul>
              </div>

              <Button
                size="md"
                variant="outline"
                onClick={() => {
                  setContactForm((f) => ({ ...f, plan: 'ENTERPRISE' }));
                  scrollToSection('contact-section');
                }}
                className="w-full bg-surface"
              >
                Premiumga Bog'lanish
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FAQ Section (Ko'p So'raladigan Savollar) */}
      <section id="faq-section" className="py-16 sm:py-24 bg-bg border-b border-line">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand text-xs font-bold">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>SAVOL-JAVOBLAR</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-ink-main tracking-tight">
              Ko'p Beriladigan Savollar
            </h2>
            <p className="text-ink-secondary text-sm sm:text-base">
              Menurest.uz haqida eng ko'p so'raladigan savollarga aniq javoblar.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-surface rounded-2xl border border-line overflow-hidden transition-all shadow-subtle"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-4.5 text-left flex items-center justify-between gap-4 font-bold text-ink-main text-sm sm:text-base hover:text-brand transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-ink-secondary shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-brand' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-ink-secondary leading-relaxed border-t border-line/60">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9. Contact Section (Bog'lanish & Ariza) */}
      <section id="contact-section" className="py-16 sm:py-24 bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand text-xs font-bold">
                <Phone className="w-3.5 h-3.5" />
                <span>BOG'LANISH VA ULASH</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-ink-main tracking-tight">
                Restoraningizni Menurest.uz Ga Ulang
              </h2>

              <p className="text-ink-secondary text-sm sm:text-base leading-relaxed">
                Platformamizga yangi restoran qo'shish yoki tariflar bo'yicha ma'lumot olish uchun ariza qoldiring. Mutaxassislarimiz 15 daqiqa ichida siz bilan bog'lanib, bepul namoyish qilib berishadi.
              </p>

              <div className="space-y-4 pt-2 text-sm text-ink-main">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-bg border border-line flex items-center justify-center text-brand shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-ink-secondary">Telefon orqali:</div>
                    <div className="font-bold">+998 71 200 11 22</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-bg border border-line flex items-center justify-center text-brand shrink-0">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-ink-secondary">Telegram qo'llab-quvvatlash:</div>
                    <div className="font-bold">@menurest_support</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-bg border border-line flex items-center justify-center text-brand shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-ink-secondary">Manzil:</div>
                    <div className="font-bold">Toshkent shahri, IT Park, 4-bino</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-6">
              <div className="bg-bg rounded-3xl p-8 border border-line shadow-subtle">
                {contactSubmitted ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-ink-main">Arizangiz Qabul Qilindi!</h3>
                      <p className="text-xs text-ink-secondary max-w-sm mx-auto">
                        Tez orada mutaxassisimiz <strong>{contactForm.phone}</strong> raqamiga qo'ng'iroq qilib, "{contactForm.restName}" restoranini ulash bo'yicha yordam beradi.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setContactSubmitted(false);
                        setContactForm({ restName: '', phone: '', city: 'Toshkent', plan: 'BUSINESS', notes: '' });
                      }}
                      className="bg-surface"
                    >
                      Yangi ariza qoldirish
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <h3 className="text-lg font-bold text-ink-main">Tezkor Ariza Qoldirish</h3>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-ink-main">Restoran yoki Kafe Nomi *</label>
                      <input
                        type="text"
                        required
                        placeholder="Masalan: Rayhon Chilonzor"
                        value={contactForm.restName}
                        onChange={(e) => setContactForm({ ...contactForm, restName: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-ink-main">Telefon Raqamingiz *</label>
                        <input
                          type="tel"
                          required
                          placeholder="+998 90 123 45 67"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-ink-main">Shahar</label>
                        <input
                          type="text"
                          placeholder="Toshkent, Samarqand..."
                          value={contactForm.city}
                          onChange={(e) => setContactForm({ ...contactForm, city: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-ink-main">Qiziqtirgan Tarif</label>
                      <select
                        value={contactForm.plan}
                        onChange={(e) => setContactForm({ ...contactForm, plan: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value="START">Boshlang'ich (Start) — 290 000 UZS/oy</option>
                        <option value="BUSINESS">Standart (Business) — 590 000 UZS/oy</option>
                        <option value="ENTERPRISE">Premium (Enterprise) — 990 000 UZS/oy</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-ink-main">Qo'shimcha Izoh (Ixtiyoriy)</label>
                      <textarea
                        rows={2}
                        placeholder="Stollar soni yoki maxsus talablar..."
                        value={contactForm.notes}
                        onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                      />
                    </div>

                    <Button type="submit" size="md" variant="primary" className="w-full gap-2 shadow-md font-bold">
                      <Send className="w-4 h-4" />
                      <span>Arizani Yuborish</span>
                    </Button>
                    <p className="text-[11px] text-ink-secondary text-center">
                      Mutaxassislarimiz 15 daqiqada siz bilan bog'lanishadi.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Footer */}
      <footer className="bg-surface py-12 border-t border-line text-xs text-ink-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <BrandLogo size="sm" />
            <p className="text-[11px] text-ink-secondary ml-2">© 2026 Menurest.uz. Barcha huquqlar himoyalangan.</p>
          </div>

          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Tizim holati: Faol (Online)
            </span>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-brand font-semibold">
              Yuqoriga Qaytish ↑
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
