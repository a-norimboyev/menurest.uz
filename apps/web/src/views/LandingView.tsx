import React, { useState, useEffect } from 'react';
import {
  QrCode,
  ChefHat,
  CreditCard,
  BarChart3,
  Phone,
  Send,
  Instagram,
  Store,
  ArrowRight,
  ArrowUpRight,
  Smartphone,
  LogIn,
  Menu,
  X,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { BrandLogo } from '../components/ui/BrandLogo.tsx';

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
  onSelectRoleView: (role: 'GUEST' | 'WAITER' | 'CASHIER' | 'MANAGER' | 'SUPER_ADMIN' | 'SESSION') => void;
  onOpenRestaurantMenu?: (slugOrId: string) => void;
}

export function LandingView({
  onOpenLogin,
}: LandingViewProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Platform public contact details (Telefon, Telegram, Instagram)
  const [contactInfo, setContactInfo] = useState({
    supportPhone: '+998 97 622 00 34',
    supportTelegram: '@muhammadqodirdev',
    supportInstagram: '',
  });

  useEffect(() => {
    fetch('/api/v1/public/contact-info')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setContactInfo({
            supportPhone: res.data.supportPhone || '+998 97 622 00 34',
            supportTelegram: res.data.supportTelegram || '@muhammadqodirdev',
            supportInstagram: res.data.supportInstagram || '',
          });
        }
      })
      .catch(() => null);
  }, []);

  const getTelegramHref = (val: string) => {
    if (!val) return '#';
    const clean = val.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    return `https://t.me/${clean.replace(/^@/, '')}`;
  };

  const getInstagramHref = (val: string) => {
    if (!val) return '#';
    const clean = val.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    return `https://instagram.com/${clean.replace(/^@/, '')}`;
  };

  // Contact form state
  const [contactForm, setContactForm] = useState({
    phone: '',
    name: '',
    region: 'Toshkent shahri',
    plan: 'BUSINESS',
  });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [submittingContact, setSubmittingContact] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.phone || !contactForm.name.trim()) return;
    try {
      setSubmittingContact(true);
      await fetch('/api/v1/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      setContactSubmitted(true);
    } catch {
      setContactSubmitted(true);
    } finally {
      setSubmittingContact(false);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLoginAction = () => {
    onOpenLogin();
  };

  return (
    <div className="min-h-screen bg-bg text-ink-main flex flex-col font-sans">
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-40 bg-surface border-b border-line shadow-xs">
        <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 h-20 flex items-center justify-between gap-4">
          <div
            className="flex items-center space-x-3 cursor-pointer select-none"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <BrandLogo size="md" />
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-ink-secondary">
            <button onClick={() => scrollToSection('features-section')} className="hover:text-brand transition-colors">
              Imkoniyatlar
            </button>
            <button onClick={() => scrollToSection('how-it-works-section')} className="hover:text-brand transition-colors">
              Qanday ishlaydi?
            </button>
            <button onClick={() => scrollToSection('pricing-section')} className="hover:text-brand transition-colors">
              Tariflar
            </button>
            <button onClick={() => scrollToSection('contact-section')} className="hover:text-brand transition-colors">
              Bog'lanish
            </button>
          </nav>

          <div className="flex items-center space-x-3">
            <Button
              size="sm"
              variant="primary"
              onClick={handleLoginAction}
              className="gap-2 shadow-sm min-h-[40px] font-bold px-5 rounded-xl"
            >
              <LogIn className="w-4 h-4" />
              <span>Kirish</span>
            </Button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl border border-line bg-surface text-ink-main hover:bg-bg transition-colors"
              aria-label="Menyu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-line bg-surface px-4 py-4 space-y-3 shadow-xl">
            <nav className="flex flex-col space-y-2 text-sm font-semibold text-ink-secondary">
              <button
                onClick={() => {
                  scrollToSection('features-section');
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 px-3 rounded-xl hover:bg-bg hover:text-brand"
              >
                Imkoniyatlar
              </button>
              <button
                onClick={() => {
                  scrollToSection('how-it-works-section');
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 px-3 rounded-xl hover:bg-bg hover:text-brand"
              >
                Qanday ishlaydi?
              </button>
              <button
                onClick={() => {
                  scrollToSection('pricing-section');
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 px-3 rounded-xl hover:bg-bg hover:text-brand"
              >
                Tariflar
              </button>
              <button
                onClick={() => {
                  scrollToSection('contact-section');
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 px-3 rounded-xl hover:bg-bg hover:text-brand"
              >
                Bog'lanish
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* 2. Hero Section */}
      <section className="bg-gradient-to-b from-brand-500/10 via-brand-50/20 to-bg pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-line">
        <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-ink-main tracking-tight leading-[1.15]">
                Aqlli <span className="text-brand">QR Menyu</span> va Restoran Boshqaruvi
              </h1>

              <p className="text-base sm:text-lg text-ink-secondary max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                O'zbekistondagi restoran, kafe va choyxonalar uchun zamonaviy elektron QR menyu, kassa va oshxona avtomatlashtirish tizimi. Mijozlar menyuni QR kod orqali ilovasiz ko'radi va buyurtma beradi.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-2">
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => scrollToSection('contact-section')}
                  className="gap-2 shadow-lg shadow-brand/20 font-bold text-base py-3.5 px-6 rounded-2xl"
                >
                  <Store className="w-5 h-5" />
                  <span>Ulanish</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleLoginAction}
                  className="gap-2 bg-surface font-semibold text-base py-3.5 px-6 rounded-2xl border-line hover:border-brand"
                >
                  <LogIn className="w-5 h-5 text-brand" />
                  <span>Kirish</span>
                </Button>
              </div>

              {/* Short Value Bullets */}
              <div className="grid grid-cols-3 gap-3 pt-6 border-t border-line/80 max-w-lg mx-auto lg:mx-0 text-center">
                <div className="p-3 bg-surface rounded-xl border border-line">
                  <div className="text-base sm:text-lg font-black text-ink-main">Tezkor</div>
                  <div className="text-[11px] text-ink-secondary">Xizmat va oshxona</div>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-line">
                  <div className="text-base sm:text-lg font-black text-brand">Ilovasiz</div>
                  <div className="text-[11px] text-ink-secondary">Brauzerda ochiladi</div>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-line">
                  <div className="text-base sm:text-lg font-black text-ink-main">Aniq</div>
                  <div className="text-[11px] text-ink-secondary">Kassa va hisob</div>
                </div>
              </div>
            </div>

            {/* Right Column (Clean Menu Visual) */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-sm bg-surface rounded-3xl p-5 shadow-xl border border-line space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand flex items-center justify-center font-bold">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-ink-main">Rayhon Restorani</div>
                      <div className="text-[11px] text-ink-secondary">Stol #4 • QR Menyu</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Faol
                  </span>
                </div>

                {/* Sample Menu Items */}
                <div className="space-y-2.5">
                  <div className="p-3 bg-bg rounded-2xl border border-line flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-ink-main">Choyxona Palov</div>
                      <div className="text-[11px] text-ink-secondary">Go'sht, no'xot, mayiz bilan</div>
                    </div>
                    <span className="text-xs font-bold text-brand">45 000 so'm</span>
                  </div>

                  <div className="p-3 bg-bg rounded-2xl border border-line flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-ink-main">Kavkaz Shashlik</div>
                      <div className="text-[11px] text-ink-secondary">Momiq qo'y go'shti</div>
                    </div>
                    <span className="text-xs font-bold text-brand">24 000 so'm</span>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="w-full py-2.5 bg-brand text-white text-center rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-1.5">
                    <QrCode className="w-4 h-4" />
                    <span>Buyurtma Berish</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. How It Works */}
      <section id="how-it-works-section" className="py-14 sm:py-20 bg-surface border-b border-line">
        <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 space-y-10">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-ink-main tracking-tight">
              Tizim Qanday Ishlaydi?
            </h2>
            <p className="text-ink-secondary text-sm">
              3 oddiy bosqichda buyurtma va to'lov jarayoni
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-bg rounded-2xl p-6 border border-line space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand flex items-center justify-center font-black">
                1
              </div>
              <h3 className="text-base font-bold text-ink-main">QR Skanerlash</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Mijoz stoldagi QR kodni ochib menyuni ko'radi va taom tanlaydi. Ilova yuklash shart emas.
              </p>
            </div>

            <div className="bg-bg rounded-2xl p-6 border border-line space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black">
                2
              </div>
              <h3 className="text-base font-bold text-ink-main">Oshxonaga Yetkazish</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Buyurtma bir zumda oshxona ekraniga boradi. Oshpaz tayyorlaydi, ofitsiant stolga eltadi.
              </p>
            </div>

            <div className="bg-bg rounded-2xl p-6 border border-line space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
                3
              </div>
              <h3 className="text-base font-bold text-ink-main">Tezkor To'lov</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Kassada barcha hisoblar aniq ko'rinadi. Naqd yoki kartada to'lov qabul qilinadi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Features */}
      <section id="features-section" className="py-14 sm:py-20 bg-bg border-b border-line">
        <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 space-y-10">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-ink-main tracking-tight">
              Asosiy Imkoniyatlar
            </h2>
            <p className="text-ink-secondary text-sm">
              Restoran ishini osonlashtiruvchi qulay vositalar
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-surface rounded-2xl p-5 border border-line space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-ink-main">QR Menyu</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Chiroyli taom rasmlari, tavsifi va narxlari. Istalgan vaqtda o'zgartirish mumkin.
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-line space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <ChefHat className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-ink-main">Oshxona Ekrani</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Qog'oz cheklarsiz, yangi buyurtmalar planshetda darhol ko'rinadi.
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-line space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-ink-main">Kassa va POS</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Naqd va karta to'lovlari nazorati, smena yopish va chek chiqarish.
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-line space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-ink-main">Hisobotlar</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Kunlik tushum, xaridorgir taomlar va xodimlar harakati nazorati.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Pricing Plans */}
      <section id="pricing-section" className="py-14 sm:py-20 bg-surface border-b border-line">
        <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 space-y-10">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-ink-main tracking-tight">
              Tariflar
            </h2>
            <p className="text-ink-secondary text-sm">
              Restoraningiz hajmiga mos qulay narxlar
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* 1. Start Plan */}
            <div className="bg-bg rounded-2xl p-6 border border-line flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="text-xs font-bold text-ink-secondary uppercase">Kichik Kafe</div>
                <h3 className="text-lg font-bold text-ink-main">Boshlang'ich</h3>
                <div className="text-2xl font-black text-ink-main">
                  100 000 <span className="text-xs font-normal text-ink-secondary">so'm / oy</span>
                </div>
                <ul className="space-y-2 text-xs text-ink-main pt-2 border-t border-line">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>30 tagacha stol</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Raqamli QR Menyu</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Ofitsiant chaqiruvi</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Telegram bildirishnomalar</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Kunlik savdo hisoboti</span>
                  </li>
                </ul>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setContactForm((f) => ({ ...f, plan: 'START' }));
                  scrollToSection('contact-section');
                }}
                className="w-full bg-surface"
              >
                Tanlash
              </Button>
            </div>

            {/* 2. Business Plan */}
            <div className="bg-surface rounded-2xl p-6 border-2 border-brand shadow-lg flex flex-col justify-between space-y-5 relative">
              <div className="space-y-3">
                <div className="text-xs font-bold text-brand uppercase">Eng Ommabop</div>
                <h3 className="text-lg font-bold text-ink-main">Standart</h3>
                <div className="text-2xl font-black text-brand">
                  200 000 <span className="text-xs font-normal text-ink-secondary">so'm / oy</span>
                </div>
                <ul className="space-y-2 text-xs text-ink-main pt-2 border-t border-line">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>100 tagacha stol</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Boshlang'ich imkoniyatlari</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Kassa va POS tizimi</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Oshxona ekrani (KDS)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Ofitsiant mobil paneli</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Kengaytirilgan hisobotlar</span>
                  </li>
                </ul>
              </div>

              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setContactForm((f) => ({ ...f, plan: 'BUSINESS' }));
                  scrollToSection('contact-section');
                }}
                className="w-full"
              >
                Tanlash
              </Button>
            </div>

            {/* 3. Enterprise Plan */}
            <div className="bg-bg rounded-2xl p-6 border border-line flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="text-xs font-bold text-ink-secondary uppercase">Katta Tarmoq</div>
                <h3 className="text-lg font-bold text-ink-main">Premium</h3>
                <div className="text-2xl font-black text-ink-main">
                  350 000 <span className="text-xs font-normal text-ink-secondary">so'm / oy</span>
                </div>
                <ul className="space-y-2 text-xs text-ink-main pt-2 border-t border-line">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Cheksiz stollar</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Standart imkoniyatlari</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Ko'p filialli tarmoq</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Xodimlar nazorati</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>Omborxona va masalliqlar</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>VIP texnik yordam 24/7</span>
                  </li>
                </ul>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setContactForm((f) => ({ ...f, plan: 'ENTERPRISE' }));
                  scrollToSection('contact-section');
                }}
                className="w-full bg-surface"
              >
                Tanlash
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Contact Section */}
      <section id="contact-section" className="py-14 sm:py-20 bg-bg border-b border-line">
        <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            
            {/* Info */}
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-black text-ink-main tracking-tight">
                Restoraningizni Ulang
              </h2>
              <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
                Tizimni o'rnatish va bepul sinab ko'rish uchun ma'lumotlaringizni qoldiring. Tez orada siz bilan bog'lanamiz.
              </p>

              <div className="space-y-3 pt-2 text-xs text-ink-main">
                <a
                  href={`tel:${contactInfo.supportPhone.replace(/\s+/g, '')}`}
                  className="group flex items-center gap-3 p-3 rounded-xl bg-surface border border-line hover:border-brand/40 transition-all hover:shadow-subtle"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-ink-secondary block font-medium">Telefon orqali bog'lanish</span>
                    <span className="font-bold text-sm font-mono text-ink-main">{contactInfo.supportPhone}</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-ink-secondary/40 group-hover:text-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </a>

                {contactInfo.supportTelegram && (
                  <a
                    href={getTelegramHref(contactInfo.supportTelegram)}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 p-3 rounded-xl bg-surface border border-line hover:border-sky-500/40 transition-all hover:shadow-subtle"
                  >
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
                      <Send className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-ink-secondary block font-medium">Biz bilan Telegram orqali bog'laning</span>
                      <span className="font-bold text-sm font-mono text-sky-700 truncate block">{contactInfo.supportTelegram}</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-ink-secondary/40 group-hover:text-sky-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </a>
                )}

                {contactInfo.supportInstagram && (
                  <a
                    href={getInstagramHref(contactInfo.supportInstagram)}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 p-3 rounded-xl bg-surface border border-line hover:border-pink-500/40 transition-all hover:shadow-subtle"
                  >
                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 flex items-center justify-center shrink-0">
                      <Instagram className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-ink-secondary block font-medium">Instagram bilan bog'lanish</span>
                        <span className="text-[9px] font-semibold text-pink-600 bg-pink-500/10 px-1.5 py-0.5 rounded">Instagram sahifamiz</span>
                      </div>
                      <span className="font-bold text-sm font-mono text-pink-700 truncate block">{contactInfo.supportInstagram}</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-ink-secondary/40 group-hover:text-pink-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </a>
                )}
              </div>
            </div>

            {/* Form */}
            <div className="bg-surface rounded-2xl p-6 border border-line shadow-sm">
              {contactSubmitted ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-ink-main">Arizangiz qabul qilindi!</h3>
                    <p className="text-xs text-ink-secondary">
                      Hurmatli <strong>{contactForm.name}</strong>, <strong>{contactForm.phone}</strong> raqamiga tez orada mutaxassisimiz bog'lanadi ({contactForm.region}).
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-main">Telefon raqam *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+998 90 123 45 67"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-brand font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-main">Ism *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ismingizni kiriting"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-brand font-medium text-ink-main"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-main">Viloyat (Manzil) *</label>
                    <select
                      value={contactForm.region}
                      onChange={(e) => setContactForm({ ...contactForm, region: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-brand font-medium text-ink-main cursor-pointer"
                    >
                      <option value="Toshkent shahri">Toshkent shahri</option>
                      <option value="Toshkent viloyati">Toshkent viloyati</option>
                      <option value="Samarqand viloyati">Samarqand viloyati</option>
                      <option value="Buxoro viloyati">Buxoro viloyati</option>
                      <option value="Andijon viloyati">Andijon viloyati</option>
                      <option value="Farg'ona viloyati">Farg'ona viloyati</option>
                      <option value="Namangan viloyati">Namangan viloyati</option>
                      <option value="Qashqadaryo viloyati">Qashqadaryo viloyati</option>
                      <option value="Surxondaryo viloyati">Surxondaryo viloyati</option>
                      <option value="Xorazm viloyati">Xorazm viloyati</option>
                      <option value="Navoiy viloyati">Navoiy viloyati</option>
                      <option value="Jizzax viloyati">Jizzax viloyati</option>
                      <option value="Sirdaryo viloyati">Sirdaryo viloyati</option>
                      <option value="Qoraqalpog'iston Respublikasi">Qoraqalpog'iston Respublikasi</option>
                    </select>
                  </div>

                  <Button
                    type="submit"
                    size="md"
                    variant="primary"
                    disabled={submittingContact}
                    className="w-full font-bold gap-2 mt-2 py-2.5 rounded-xl"
                  >
                    <Send className="w-4 h-4" />
                    <span>{submittingContact ? 'Yuborilmoqda...' : 'Ariza Qoldirish'}</span>
                  </Button>
                </form>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="bg-surface py-6 text-xs text-ink-secondary border-t border-line">
        <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Menurest.uz. Barcha huquqlar himoyalangan.</p>
          <div className="flex items-center gap-4 text-xs">
            {contactInfo.supportTelegram && (
              <a
                href={getTelegramHref(contactInfo.supportTelegram)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-sky-600 transition-colors font-medium"
              >
                <Send className="w-3.5 h-3.5 text-sky-600" />
                <span>Telegram</span>
              </a>
            )}
            {contactInfo.supportInstagram && (
              <a
                href={getInstagramHref(contactInfo.supportInstagram)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-pink-600 transition-colors font-medium"
              >
                <Instagram className="w-3.5 h-3.5 text-pink-600" />
                <span>Instagram sahifamiz</span>
              </a>
            )}
          </div>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-brand font-semibold">
            Yuqoriga Qaytish ↑
          </button>
        </div>
      </footer>
    </div>
  );
}
