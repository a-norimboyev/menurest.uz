import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  Utensils,
  LayoutGrid,
  Clock,
  AlertTriangle,
  Receipt,
  RefreshCw,
  X,
  AlertCircle,
  CreditCard,
  Banknote,
  QrCode,
  Printer,
  ChevronRight,
  User,
  Settings,
  Globe,
  Phone,
  Lock,
  Volume2,
  Volume1,
  VolumeX,
  Smartphone,
  LogOut,
  Save,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { Money } from '../components/ui/Money.tsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { useRealtime } from '../hooks/useRealtime.ts';
import { ConnectionBanner } from '../components/ui/ConnectionBanner.tsx';
import { UzPaymentQr } from '../components/payment/UzPaymentQr.tsx';
import { formatMoneyUzs, stripParentheses } from '@menurest/shared';

interface ServiceCallItem {
  id: string;
  tableId: string;
  tableNumber: number;
  hallName: string;
  type: string;
  status: string;
  acknowledgedByUserId?: string | null;
  isMyTable: boolean;
  createdAt: string;
}

interface ReadyDishItem {
  id: string;
  orderId: string;
  orderNumber: number;
  tableId: string;
  tableNumber: number;
  hallName: string;
  name: string;
  variantName?: string | null;
  quantity: number;
  stationName: string;
  status: string;
  priceTiyin: string;
  isMyTable: boolean;
}

interface PendingOrderItem {
  id: string;
  orderNumber: number;
  tableId: string;
  tableNumber: number;
  hallName: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  isMyTable: boolean;
  items: {
    id: string;
    name: string;
    variantName?: string | null;
    quantity: number;
    status: string;
    priceTiyin: string;
    addons: { name: string; priceTiyin: string }[];
  }[];
}

interface WaiterTableItem {
  id: string;
  number: number;
  capacity: number;
  status: 'FREE' | 'OCCUPIED' | 'DIRTY';
  qrToken: string;
  hall: { id: string; name: string };
  assignedWaiter?: { id: string; fullName: string; phone: string } | null;
  isMyTable?: boolean;
  activeVisit?: {
    id: string;
    openedAt: string;
    pinCode: string;
    ordersCount: number;
    itemsCount: number;
    totalBillTiyin: string;
    items?: Array<{
      id: string;
      orderId?: string;
      orderNumber?: number;
      orderStatus?: string;
      name: string;
      variantName?: string | null;
      quantity: number;
      status: string;
      priceTiyin?: string;
    }>;
  } | null;
}

interface WaiterViewProps {
  restaurantSlug?: string;
  authProfile?: any;
}

export const WaiterView: React.FC<WaiterViewProps> = ({
  restaurantSlug: propSlug,
  authProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'calls' | 'orders' | 'tables' | 'settings'>('tables');
  const [loading, setLoading] = useState(false);
  const [restaurantSlug, setRestaurantSlug] = useState(authProfile?.activeRestaurant?.slug || propSlug || 'qaldirgoch-bodomzor');

  // --- SOZLAMALAR (SETTINGS) STATE ---
  const [lang, setLang] = useState<'uz' | 'ru'>(() => {
    try {
      const saved = localStorage.getItem('menurest_waiter_lang');
      return saved === 'ru' ? 'ru' : 'uz';
    } catch {
      return 'uz';
    }
  });

  const handleLanguageChange = (newLang: 'uz' | 'ru') => {
    setLang(newLang);
    try {
      localStorage.setItem('menurest_waiter_lang', newLang);
    } catch {}
  };

  // Profil (Ism va Telefon)
  const [profileName, setProfileName] = useState(authProfile?.user?.fullName || '');
  const [profilePhone, setProfilePhone] = useState(authProfile?.user?.phone || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (authProfile?.user?.fullName) setProfileName(authProfile.user.fullName);
    if (authProfile?.user?.phone) setProfilePhone(authProfile.user.phone);
  }, [authProfile]);

  // Ovozli signal va Vibratsiya
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('menurest_sound_alert') !== 'false';
    } catch {
      return true;
    }
  });

  const [soundVolume, setSoundVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('menurest_sound_volume');
      return saved !== null ? Number(saved) : 80;
    } catch {
      return 80;
    }
  });

  const [volumeMenuOpen, setVolumeMenuOpen] = useState(false);

  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('menurest_vibration_alert') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleSound = (val: boolean) => {
    setSoundEnabled(val);
    try {
      localStorage.setItem('menurest_sound_alert', val ? 'true' : 'false');
    } catch {}
  };

  const handleVolumeChange = (newVol: number) => {
    setSoundVolume(newVol);
    if (newVol === 0) {
      setSoundEnabled(false);
      try {
        localStorage.setItem('menurest_sound_alert', 'false');
      } catch {}
    } else if (!soundEnabled) {
      setSoundEnabled(true);
      try {
        localStorage.setItem('menurest_sound_alert', 'true');
      } catch {}
    }
    try {
      localStorage.setItem('menurest_sound_volume', newVol.toString());
    } catch {}
  };

  const toggleVibration = (val: boolean) => {
    setVibrationEnabled(val);
    try {
      localStorage.setItem('menurest_vibration_alert', val ? 'true' : 'false');
    } catch {}
  };

  // Parol o'zgartirish
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Audio Chime funksiyasi
  function playNotificationSound(customVol?: number) {
    try {
      const activeVol = customVol !== undefined ? customVol : (soundEnabled ? soundVolume : 0);
      if (activeVol <= 0) return;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      const targetGain = (activeVol / 100) * 0.35;
      gain.gain.setValueAtTime(targetGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Profilni saqlash
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileName.trim() || !profilePhone.trim()) {
      setFeedbackMsg({ text: 'Ism va telefon raqam bo\'sh bo\'lishi mumkin emas', type: 'error' });
      return;
    }
    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/v1/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': authProfile?.csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify({ fullName: profileName, phone: profilePhone }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMsg({ text: 'Profil ma\'lumotlari muvaffaqiyatli saqlandi!', type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3500);
        window.dispatchEvent(new Event('menurest_auth_change'));
      } else {
        setFeedbackMsg({ text: data.error?.message || 'Profilni saqlashda xatolik', type: 'error' });
      }
    } catch {
      setFeedbackMsg({ text: 'Tarmoq xatoligi', type: 'error' });
    } finally {
      setIsSavingProfile(false);
    }
  }

  // Parolni yangilash
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      setPasswordMsg({ text: 'Barcha maydonlarni to\'ldiring', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'Yangi parollar mos kelmadi', type: 'error' });
      return;
    }

    setIsChangingPassword(true);
    setPasswordMsg(null);
    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': authProfile?.csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordMsg({ text: 'Parol muvaffaqiyatli yangilandi!', type: 'success' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMsg({ text: data.error?.message || 'Parolni yangilashda xatolik', type: 'error' });
      }
    } catch {
      setPasswordMsg({ text: 'Tarmoq xatoligi', type: 'error' });
    } finally {
      setIsChangingPassword(false);
    }
  }

  // Tizimdan chiqish
  async function handleLogout() {
    if (!confirm('Haqiqatan ham tizimdan chiqmoqchimisiz?')) return;
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': authProfile?.csrfToken || '',
        },
      });
    } catch {}
    window.location.hash = '';
    window.location.reload();
  }

  // Tarjimalar lug'ati
  const tr = {
    uz: {
      calls: 'Chaqiruv',
      orders: 'Buyurtmalar',
      tables: 'Stollar',
      settings: 'Sozlamalar',
      settingsTitle: 'Ofitsiant Sozlamalari',
      settingsSubtitle: 'Til, shaxsiy profil, bildirishnomalar va xavfsizlik',
      personalInfo: 'Shaxsiy Ma\'lumotlar',
      fullNameLabel: 'F.I.SH',
      phoneLabel: 'Telefon Raqam',
      saveProfile: 'Profilni Saqlash',
      saving: 'Saqlanmoqda...',
      langTitle: 'Tizim Tili',
      soundTitle: 'Ovozli Bildirishnoma va Signal',
      soundDesc: 'Yangi chaqiruv yoki yangi buyurtma kelganda chalinadigan audio signal',
      testSound: 'Ovozni Sinab Ko\'rish',
      vibrationTitle: 'Tebranish',
      vibrationDesc: 'Smartfoningizda tebranish signali',
      testVibration: 'Vibratsiyani Tekshirish',
      securityTitle: 'Xavfsizlik va Parol',
      oldPassLabel: 'Amaldagi Eski Parol',
      newPassLabel: 'Yangi Parol Kamida 6 belgi',
      confirmPassLabel: 'Yangi Parolni Takrorlang',
      updatePass: 'Parolni Yangilash',
      changingPass: 'Yangilanmoqda...',
      shiftTitle: 'Restoran va Xodim Ma\'lumotlari',
      waiterRole: 'Ofitsiant',
      activeRest: 'Faol Restoran',
      assignedTablesCount: 'Biriktirilgan Stollar',
      logoutBtn: 'Hisobdan Chiqish',
      tablesUnit: 'ta stol',
    },
    ru: {
      calls: 'Вызовы',
      orders: 'Заказы',
      tables: 'Столы',
      settings: 'Настройки',
      settingsTitle: 'Настройки Официанта',
      settingsSubtitle: 'Язык, профиль, уведомления и безопасность',
      personalInfo: 'Личные Данные',
      fullNameLabel: 'Ф.И.О.',
      phoneLabel: 'Номер Телефона',
      saveProfile: 'Сохранить Профиль',
      saving: 'Сохранение...',
      langTitle: 'Язык Интерфейса',
      soundTitle: 'Звуковое Оповещение',
      soundDesc: 'Звуковой сигнал при вызове или новом заказе',
      testSound: 'Проверить Звук',
      vibrationTitle: 'Вибрация',
      vibrationDesc: 'Вибросигнал на вашем смартфоне',
      testVibration: 'Проверить Вибрацию',
      securityTitle: 'Безопасность и Пароль',
      oldPassLabel: 'Текущий Пароль',
      newPassLabel: 'Новый Пароль Мин. 6 символов',
      confirmPassLabel: 'Повторите Новый Пароль',
      updatePass: 'Обновить Пароль',
      changingPass: 'Обновление...',
      shiftTitle: 'Ресторан и Данные Сотрудника',
      waiterRole: 'Официант',
      activeRest: 'Активный Ресторан',
      assignedTablesCount: 'Закрепленные Столы',
      logoutBtn: 'Выйти из Системы',
      tablesUnit: 'столов',
    },
  }[lang];

  useEffect(() => {
    if (authProfile?.activeRestaurant?.slug) {
      setRestaurantSlug(authProfile.activeRestaurant.slug);
    }
  }, [authProfile]);

  // Dashboard Data
  const [metrics, setMetrics] = useState({
    openCallsCount: 0,
    readyItemsCount: 0,
    pendingOrdersCount: 0,
    billRequestsCount: 0,
  });
  const [serviceCalls, setServiceCalls] = useState<ServiceCallItem[]>([]);
  const [readyItems, setReadyItems] = useState<ReadyDishItem[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrderItem[]>([]);
  const [myTables, setMyTables] = useState<WaiterTableItem[]>([]);

  // Modals & Forms
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Reject Order Dialog
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);



  // Direct Payment & Bill Dialog State
  const [waiterPaymentModalOpen, setWaiterPaymentModalOpen] = useState(false);
  const [selectedVisitForPayment, setSelectedVisitForPayment] = useState<{ visitId: string; tableNumber: number } | null>(null);
  const [paymentDetailedBill, setPaymentDetailedBill] = useState<any | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentModalTab, setPaymentModalTab] = useState<'pay' | 'precheck'>('pay');
  const [waiterPaymentMethod, setWaiterPaymentMethod] = useState<'CASH' | 'TERMINAL' | 'QR'>('CASH');
  const [waiterTenderedCashUzs, setWaiterTenderedCashUzs] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Qaytim (Change) hisoblash
  const parsedWaiterTenderedCashTiyin = useMemo(() => {
    try {
      const clean = waiterTenderedCashUzs.replace(/\s+/g, '');
      const num = BigInt(clean || '0');
      return num * 100n;
    } catch {
      return 0n;
    }
  }, [waiterTenderedCashUzs]);

  const waiterCalculatedChangeTiyin = useMemo(() => {
    if (!paymentDetailedBill || waiterPaymentMethod !== 'CASH') return 0n;
    const balance = BigInt(paymentDetailedBill.bill?.balanceTiyin || '0');
    if (parsedWaiterTenderedCashTiyin > balance) {
      return parsedWaiterTenderedCashTiyin - balance;
    }
    return 0n;
  }, [paymentDetailedBill, waiterPaymentMethod, parsedWaiterTenderedCashTiyin]);

  // Waiter Session state
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  // Table filters
  const [tableFilter, setTableFilter] = useState<'all' | 'occupied' | 'free'>('all');

  const filteredTables = useMemo(() => {
    return myTables.filter((t) => {
      const isOccupied = t.status === 'OCCUPIED' || !!t.activeVisit;
      if (tableFilter === 'occupied' && !isOccupied) return false;
      if (tableFilter === 'free' && isOccupied) return false;
      return true;
    });
  }, [myTables, tableFilter]);

  // Har bir stol uchun yagona birlashtirilgan buyurtmalar ro'yxati (1 stol = 1 karta)
  const tablesWithOrders = useMemo(() => {
    const map = new Map<
      number,
      {
        table: WaiterTableItem;
        visitId?: string;
        pendingOrderIds: string[];
        items: Array<{
          id: string;
          orderId?: string;
          orderNumber?: number;
          orderStatus?: string;
          name: string;
          variantName?: string | null;
          quantity: number;
          status: string;
          priceTiyin?: string;
        }>;
        hasNewOrder: boolean;
        hasUnservedItems: boolean;
      }
    >();

    // 1. myTables ichidagi barcha faol buyurtmali stollar
    for (const t of myTables) {
      const v = t.activeVisit;
      const vItems = (v?.items || []) as any[];
      const tablePendingOrders = pendingOrders.filter(
        (po) => po.tableId === t.id || po.tableNumber === t.number
      );
      const pendingOrderIds = tablePendingOrders.map((po) => po.id);

      const itemsMap = new Map<string, any>();
      for (const it of vItems) {
        itemsMap.set(it.id, it);
      }
      for (const po of tablePendingOrders) {
        for (const it of po.items) {
          if (!itemsMap.has(it.id)) {
            itemsMap.set(it.id, {
              id: it.id,
              orderId: po.id,
              orderNumber: po.orderNumber,
              orderStatus: 'NEW',
              name: it.name,
              variantName: it.variantName,
              quantity: it.quantity,
              status: it.status,
              priceTiyin: it.priceTiyin,
            });
          }
        }
      }

      // Oshxona/bardan tayyor bo'lgan taomlarni ham qo'shish
      const tableReadyItems = readyItems.filter((ri) => ri.tableNumber === t.number);
      for (const ri of tableReadyItems) {
        if (!itemsMap.has(ri.id)) {
          itemsMap.set(ri.id, {
            id: ri.id,
            orderId: ri.orderId,
            orderNumber: ri.orderNumber,
            name: ri.name,
            variantName: ri.variantName,
            quantity: ri.quantity,
            status: ri.status,
            priceTiyin: ri.priceTiyin,
          });
        }
      }

      const allItems = Array.from(itemsMap.values());
      if (allItems.length > 0 || tablePendingOrders.length > 0) {
        const hasNewOrder =
          tablePendingOrders.length > 0 ||
          allItems.some((i) => i.status === 'NEW' || i.orderStatus === 'NEW');
        const hasUnservedItems = allItems.some(
          (i) => i.status !== 'SERVED' && i.status !== 'CANCELLED'
        );

        map.set(t.number, {
          table: t,
          visitId: v?.id,
          pendingOrderIds,
          items: allItems,
          hasNewOrder,
          hasUnservedItems,
        });
      }
    }

    // 2. pendingOrders ichida bo'lib, myTables da hali bo'lmagan stollar
    for (const po of pendingOrders) {
      if (!map.has(po.tableNumber)) {
        map.set(po.tableNumber, {
          table: {
            id: po.tableId,
            number: po.tableNumber,
            status: 'OCCUPIED',
            capacity: 4,
            qrToken: '',
            hall: { id: '', name: po.hallName || '' },
            isMyTable: po.isMyTable,
            activeVisit: null,
          },
          visitId: undefined,
          pendingOrderIds: [po.id],
          items: po.items.map((it) => ({
            id: it.id,
            orderId: po.id,
            orderNumber: po.orderNumber,
            orderStatus: 'NEW',
            name: it.name,
            variantName: it.variantName,
            quantity: it.quantity,
            status: it.status,
            priceTiyin: it.priceTiyin,
          })),
          hasNewOrder: true,
          hasUnservedItems: true,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.table.number - b.table.number);
  }, [myTables, pendingOrders, readyItems]);

  // Fetch Waiter Dashboard
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/waiter/dashboard`, {
        credentials: 'include',
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setMetrics(json.data.metrics);
          setServiceCalls(json.data.serviceCalls || []);
          setReadyItems(json.data.readyItems || []);
          setPendingOrders(json.data.pendingOrders || []);
          setMyTables(json.data.myTables || []);
          setIsLoggedIn(true);
        }
      } else if (res.status === 401) {
        setIsLoggedIn(false);
      }
    } catch {
      // Tarmoq xatosi
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug]);

  // Jonli yangilanish (SSE) va ulanish nazorati
  const { status } = useRealtime({
    restaurantId: restaurantSlug,
    onReconnect: fetchDashboard,
    onEvent: () => {
      fetchDashboard();
    },
  });

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Yangi chaqiruv kelganda ovoz va vibratsiya
  const prevCallsCountRef = useRef(serviceCalls.length);
  useEffect(() => {
    if (serviceCalls.length > prevCallsCountRef.current && prevCallsCountRef.current >= 0) {
      if (soundEnabled) playNotificationSound();
      if (vibrationEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([200, 100, 200]);
      }
    }
    prevCallsCountRef.current = serviceCalls.length;
  }, [serviceCalls.length, soundEnabled, vibrationEnabled]);



  // 1. Chaqiruvni qabul qilish (Claim)
  async function handleClaimCall(callId: string) {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/waiter/service-calls/${callId}/claim`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setFeedbackMsg({ text: 'Chaqiruv qabul qilindi!', type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3000);
        await fetchDashboard();
      } else if (res.status === 409) {
        setFeedbackMsg({ text: 'Boshqa xodim qabul qilgan!', type: 'error' });
        setTimeout(() => setFeedbackMsg(null), 4000);
        await fetchDashboard();
      } else if (res.status === 403) {
        setFeedbackMsg({ text: json.error?.message || 'Ushbu stol sizga biriktirilmagan', type: 'error' });
        setTimeout(() => setFeedbackMsg(null), 4000);
      } else {
        alert(json.error?.message || 'Xatolik yuz berdi');
      }
    } catch {
      alert('Tarmoq xatoligi');
    }
  }

  // 2. Chaqiruvni yakunlash (Resolve)
  async function handleResolveCall(callId: string) {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/waiter/service-calls/${callId}/resolve`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setFeedbackMsg({ text: 'Chaqiruv muvaffaqiyatli yakunlandi!', type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3000);
        await fetchDashboard();
      } else {
        alert(json.error?.message || 'Xatolik yuz berdi');
      }
    } catch {
      alert('Tarmoq xatoligi');
    }
  }

  // 3. Tayyor taomni SERVED qilish
  async function handleServeItem(itemId: string) {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/waiter/items/${itemId}/serve`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setFeedbackMsg({ text: 'Taom yetkazildi!', type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3000);
        await fetchDashboard();
      } else if (res.status === 400) {
        alert(json.error?.message || 'Faqat TAYYOR holatdagi taomni yetkazish mumkin');
      } else {
        alert(json.error?.message || 'Xatolik yuz berdi');
      }
    } catch {
      alert('Tarmoq xatoligi');
    }
  }

  // 4. Buyurtmani tasdiqlash (Confirm Order)
  async function handleConfirmOrder(orderId: string) {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/waiter/orders/${orderId}/confirm`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setFeedbackMsg({ text: 'Buyurtma tasdiqlandi!', type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3000);
        await fetchDashboard();
      } else {
        alert(json.error?.message || 'Tasdiqlashda xatolik');
      }
    } catch {
      alert('Tarmoq xatoligi');
    }
  }

  // 4.1. Stolning barcha faol taomlarini yetkazilgan deb belgilash
  async function handleServeVisit(visitId?: string) {
    if (!visitId) return;
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/waiter/visits/${visitId}/serve-all`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setFeedbackMsg({ text: 'Taomlar yetkazildi!', type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3000);
        await fetchDashboard();
      } else {
        alert(json.error?.message || 'Xatolik yuz berdi');
      }
    } catch {
      alert('Tarmoq xatoligi');
    }
  }

  // 4.2. Stolning barcha yangi buyurtmalarini tasdiqlash
  async function handleConfirmTable(row: {
    pendingOrderIds: string[];
    items: Array<{ orderId?: string; orderStatus?: string }>;
    table: { number: number };
  }) {
    try {
      const orderIds =
        row.pendingOrderIds.length > 0
          ? row.pendingOrderIds
          : [
              ...new Set(
                row.items
                  .filter((i) => i.orderStatus === 'NEW' && i.orderId)
                  .map((i) => i.orderId as string)
              ),
            ];

      for (const id of orderIds) {
        await handleConfirmOrder(id);
      }
      setFeedbackMsg({ text: `Stol #${row.table.number} buyurtmasi tasdiqlandi!`, type: 'success' });
      setTimeout(() => setFeedbackMsg(null), 3000);
      await fetchDashboard();
    } catch {
      alert('Tarmoq xatoligi');
    }
  }

  // 5. Buyurtmani rad etish (Reject Order)
  async function handleRejectOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectOrderId || !rejectReason.trim()) return;

    try {
      setIsRejecting(true);
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/waiter/orders/${rejectOrderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setRejectModalOpen(false);
        setRejectReason('');
        setRejectOrderId(null);
        setFeedbackMsg({ text: 'Buyurtma rad etildi.', type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3000);
        await fetchDashboard();
      } else {
        alert(json.error?.message || 'Rad etishda xatolik');
      }
    } catch {
      alert('Tarmoq xatoligi');
    } finally {
      setIsRejecting(false);
    }
  }




  // 9. To'lov va hisob oynasini ochish
  async function handleOpenPaymentModal(visitId: string, tableNumber: number) {
    setSelectedVisitForPayment({ visitId, tableNumber });
    setPaymentModalTab('pay');
    setWaiterPaymentMethod('CASH');
    setWaiterPaymentModalOpen(true);
    setPaymentLoading(true);
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/billing/visits/${visitId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setPaymentDetailedBill(json.data);
        const balance = BigInt(json.data?.bill?.balanceTiyin || '0');
        if (balance > 0n) {
          setWaiterTenderedCashUzs((balance / 100n).toString());
        }
      }
    } catch {
      // xatolik
    } finally {
      setPaymentLoading(false);
    }
  }

  // 10. To'lovni tasdiqlash va tashrifni yopish
  async function handleCompletePaymentAndCloseVisit() {
    if (!selectedVisitForPayment || !paymentDetailedBill) return;
    const balance = BigInt(paymentDetailedBill.bill?.balanceTiyin || '0');

    try {
      setIsSubmittingPayment(true);
      // 1. Agar to'lanmagan qoldiq bo'lsa -> To'lov kiritish
      if (balance > 0n) {
        const idempotencyKey = crypto.randomUUID();
        const payRes = await fetch(`/api/v1/restaurants/${restaurantSlug}/billing/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            visitId: selectedVisitForPayment.visitId,
            method: waiterPaymentMethod === 'CASH' ? 'CASH' : 'TERMINAL',
            amountTiyin: balance.toString(),
            tenderedCashTiyin:
              waiterPaymentMethod === 'CASH'
                ? parsedWaiterTenderedCashTiyin.toString()
                : undefined,
            changeTiyin:
              waiterPaymentMethod === 'CASH'
                ? waiterCalculatedChangeTiyin.toString()
                : undefined,
            idempotencyKey,
          }),
        });

        const payJson = await payRes.json();
        if (!payRes.ok || !payJson.success) {
          alert(payJson.error?.message || 'To\'lovni qabul qilishda xatolik');
          setIsSubmittingPayment(false);
          return;
        }
      }

      // 2. Tashrifni yopish (Close Visit)
      const closeRes = await fetch(
        `/api/v1/restaurants/${restaurantSlug}/billing/visits/${selectedVisitForPayment.visitId}/close`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        }
      );
      const closeJson = await closeRes.json();

      if (closeRes.ok && closeJson.success) {
        setWaiterPaymentModalOpen(false);
        setSelectedVisitForPayment(null);
        setPaymentDetailedBill(null);
        setFeedbackMsg({
          text: `Stol #${selectedVisitForPayment.tableNumber} hisobi to'landi va stol bo'shatildi!`,
          type: 'success',
        });
        setTimeout(() => setFeedbackMsg(null), 3000);
        await fetchDashboard();
      } else {
        alert(closeJson.error?.message || 'Tashrifni yopishda xatolik');
      }
    } catch {
      alert('Tarmoq xatoligi');
    } finally {
      setIsSubmittingPayment(false);
    }
  }

  return (
    <div className="w-full min-h-screen bg-bg flex flex-col pb-24 select-none">
      {/* Offline Ogohlantirish Paneli */}
      <ConnectionBanner
        status={status}
        onManualRefresh={fetchDashboard}
      />

      {/* Header */}
      <header className="bg-brand-900 text-white px-4 py-3 sm:px-6 lg:px-8 sticky top-0 z-20 shadow-subtle flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-700 flex items-center justify-center font-bold text-sm text-white shadow-inner">
            OF
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Ofitsiant Paneli</h1>
            <p className="text-[11px] text-brand-200 truncate max-w-[200px] sm:max-w-none">
              {profileName || authProfile?.user?.fullName || 'Sardor Rustamov'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 relative">
          {/* Ovoz balandligi */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setVolumeMenuOpen((prev) => !prev)}
              className="p-2 rounded-xl bg-surface/10 hover:bg-surface/20 text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Ovoz balandligi"
            >
              {!soundEnabled || soundVolume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-300" />
              ) : soundVolume < 50 ? (
                <Volume1 className="w-3.5 h-3.5 text-amber-200" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-white" />
              )}
              <span className="hidden sm:inline font-mono">
                {!soundEnabled || soundVolume === 0 ? 'O\'chiq' : `${soundVolume}%`}
              </span>
            </button>

            {/* Ovoz popover oynasi */}
            {volumeMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setVolumeMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-surface rounded-2xl shadow-2xl border border-line p-4 text-ink-main z-40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5 text-ink-main">
                      <Volume2 className="w-4 h-4 text-brand" />
                      Signal Ovozi
                    </span>
                    <span className="text-xs font-mono font-bold text-brand">
                      {!soundEnabled || soundVolume === 0 ? 'O\'chiq' : `${soundVolume}%`}
                    </span>
                  </div>

                  {/* Range Slider: Past va Baland */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-ink-secondary font-medium">
                      <span>Past</span>
                      <span>O'rta</span>
                      <span>Baland</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={soundEnabled ? soundVolume : 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        handleVolumeChange(val);
                      }}
                      className="w-full accent-brand cursor-pointer"
                    />
                  </div>

                  {/* Tezkor darajalar */}
                  <div className="grid grid-cols-4 gap-1 text-[10px] font-bold">
                    {[
                      { label: 'O\'chiq', val: 0 },
                      { label: '30%', val: 30 },
                      { label: '70%', val: 70 },
                      { label: '100%', val: 100 },
                    ].map((step) => (
                      <button
                        key={step.val}
                        type="button"
                        onClick={() => {
                          handleVolumeChange(step.val);
                          playNotificationSound(step.val);
                        }}
                        className={`py-1 rounded-lg border text-center transition-colors ${
                          (soundEnabled && soundVolume === step.val) || (!soundEnabled && step.val === 0)
                            ? 'bg-brand text-white border-brand'
                            : 'bg-bg text-ink-secondary border-line hover:border-brand/40'
                        }`}
                      >
                        {step.label}
                      </button>
                    ))}
                  </div>

                  {/* Sinab ko'rish tugmasi */}
                  <button
                    type="button"
                    onClick={() => playNotificationSound()}
                    className="w-full py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand font-bold text-xs flex items-center justify-center gap-1.5 border border-brand/20 transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Ovozni Sinash</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={fetchDashboard}
            className="p-2 rounded-xl bg-surface/10 hover:bg-surface/20 text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Yangilash"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Yangilash</span>
          </button>
        </div>
      </header>

      {/* FEEDBACK TOAST / BANNER */}
      {feedbackMsg && (
        <div
          className={`mx-4 sm:mx-6 lg:mx-8 mt-3 p-3 rounded-2xl text-xs font-bold shadow-lg flex items-center justify-between animate-fade-in ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-800 text-white border border-emerald-600'
              : 'bg-rose-800 text-white border border-rose-600'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Not Logged In Warning Banner */}
      {!isLoggedIn && (
        <div className="mx-4 sm:mx-6 lg:mx-8 mt-3 p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Ofitsiant sessiyasi talab qilinadi
          </div>
          <p>Buyurtmalar va chaqiruvlarni qabul qilish uchun ofitsiant hisobingiz bilan tizimga kiring.</p>
        </div>
      )}

      {/* Kontent */}
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 flex-1 w-full">
        {/* 1. Chaqiruvlar Tabi */}
        {activeTab === 'calls' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-ink-muted uppercase tracking-wider">
                Faol Chaqiruvlar ({serviceCalls.length})
              </h2>
              {metrics.billRequestsCount > 0 && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded-full border border-blue-200">
                  {metrics.billRequestsCount} ta hisob so'rovi
                </span>
              )}
            </div>

            {serviceCalls.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-muted bg-surface rounded-card border border-line">
                Hozirda faol chaqiruvlar yo'q
              </div>
            ) : (
              serviceCalls.map((call) => {
                const isClaimed = call.status === 'ACKNOWLEDGED';
                const isBill = call.type === 'BILL';
                const table = myTables.find(
                  (t) => t.id === call.tableId || t.number === call.tableNumber
                );
                const tableItems = table?.activeVisit?.items || [];

                return (
                  <div
                    key={call.id}
                    className={`p-4 rounded-card border shadow-subtle bg-surface space-y-3 transition-all ${
                      isBill ? 'border-blue-300 ring-1 ring-blue-100' : 'border-line'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-ink-main">Stol #{call.tableNumber}</span>
                        {call.isMyTable && (
                          <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand text-[9px] font-bold border border-brand-200">
                            Mening stolim
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          isClaimed
                            ? 'bg-blue-100 text-blue-900 border-blue-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                        }`}
                      >
                        {isClaimed ? 'Qabul qilingan' : 'Kutilmoqda'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-ink-main">
                      {isBill ? (
                        <>
                          <Receipt className="w-4 h-4 text-blue-600" />
                          <span>Hisob / Chek so'rovi</span>
                        </>
                      ) : (
                        <>
                          <Bell className="w-4 h-4 text-amber-600" />
                          <span>Ofitsiant chaqiruvi</span>
                        </>
                      )}
                    </div>

                    {/* Stolning ayni vaqtdagi buyurtmalari ro'yxati */}
                    {tableItems.length > 0 ? (
                      <div className="p-2.5 rounded-xl bg-bg/80 border border-line/70 space-y-1.5">
                        <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider flex items-center justify-between">
                          <span>Stol buyurtmalari:</span>
                          {table?.activeVisit?.totalBillTiyin && (
                            <Money
                              amountTiyin={table.activeVisit.totalBillTiyin}
                              className="font-extrabold text-ink-main"
                            />
                          )}
                        </div>
                        <div className="space-y-1 divide-y divide-line/40">
                          {tableItems.map((it) => (
                            <div key={it.id} className="pt-1 flex items-center justify-between text-xs">
                              <span className="font-semibold text-ink-main">
                                {it.quantity}x {stripParentheses(it.name)} {it.variantName ? stripParentheses(it.variantName) : ''}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  it.status === 'SERVED'
                                    ? 'text-zinc-500 bg-zinc-100'
                                    : it.status === 'READY'
                                    ? 'text-emerald-700 bg-emerald-100'
                                    : it.status === 'PREPARING'
                                    ? 'text-amber-700 bg-amber-100'
                                    : 'text-blue-700 bg-blue-100'
                                }`}
                              >
                                {it.status === 'SERVED'
                                  ? 'Yetkazilgan'
                                  : it.status === 'READY'
                                  ? '🟢 Tayyor'
                                  : it.status === 'PREPARING'
                                  ? '⏳ Tayyorlanmoqda'
                                  : 'Yangi'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-ink-muted italic">
                        Bu stolda hali buyurtma yo'q
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-line text-[11px]">
                      <span className="text-ink-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isBill && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              const t = myTables.find((table) => table.id === call.tableId);
                              if (t?.activeVisit) {
                                handleOpenPaymentModal(t.activeVisit.id, call.tableNumber);
                              } else {
                                handleClaimCall(call.id);
                              }
                            }}
                            className="font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 text-xs py-1"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Hisob / To'lov</span>
                          </Button>
                        )}

                        {!isClaimed ? (
                          <Button
                            size="sm"
                            variant={isBill ? 'secondary' : 'primary'}
                            onClick={() => handleClaimCall(call.id)}
                            className="font-bold text-xs py-1"
                          >
                            Qabul Qilish
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveCall(call.id)}
                            className="font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs py-1"
                          >
                            Hal Qilindi
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 2. Buyurtmalar Tabi (Har bir stol uchun yagona karta) */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            {tablesWithOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-muted bg-surface rounded-card border border-line">
                Faol buyurtmalar yo'q
              </div>
            ) : (
              tablesWithOrders.map((row) => {
                const totalTiyin = row.items.reduce(
                  (sum, i) => sum + BigInt(i.priceTiyin || '0') * BigInt(i.quantity || 1),
                  0n
                );

                return (
                  <div
                    key={row.table.number}
                    className="p-4 rounded-card border border-line bg-surface shadow-subtle space-y-3"
                  >
                    {/* Yuqori qator: Stol raqami va Asosiy Tugma */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-ink-main">
                          Stol #{row.table.number}
                        </span>
                        {totalTiyin > 0n && (
                          <Money amountTiyin={totalTiyin} className="text-xs font-bold text-ink-muted ml-1" />
                        )}
                      </div>

                      {/* Asosiy harakat: Tasdiqlash yoki Yetkazildi */}
                      <div className="flex items-center gap-2">
                        {row.hasNewOrder ? (
                          <>
                            {row.pendingOrderIds.length > 0 && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setRejectOrderId(row.pendingOrderIds[0]);
                                  setRejectReason('');
                                  setRejectModalOpen(true);
                                }}
                                className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs py-1.5 px-2.5 font-bold"
                              >
                                Rad etish
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleConfirmTable(row)}
                              className="font-bold text-xs py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            >
                              Tasdiqlash
                            </Button>
                          </>
                        ) : row.hasUnservedItems ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleServeVisit(row.visitId)}
                            className="font-bold text-xs py-1.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Yetkazildi</span>
                          </Button>
                        ) : (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                            ✓ Yetkazildi
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Taomlar ro'yxati */}
                    <div className="space-y-1.5 divide-y divide-line/60 pt-1">
                      {row.items.map((item) => (
                        <div
                          key={item.id}
                          className="pt-1.5 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-extrabold text-ink-main shrink-0">
                              {item.quantity}x
                            </span>
                            <span className="font-medium text-ink-main truncate">
                              {stripParentheses(item.name)}
                              {item.variantName ? ` ${stripParentheses(item.variantName)}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.status === 'READY' ? (
                              <button
                                onClick={() => handleServeItem(item.id)}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 transition-colors"
                                title="Yetkazildi deb belgilash"
                              >
                                🟢 Tayyor
                              </button>
                            ) : (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  item.status === 'SERVED'
                                    ? 'bg-zinc-100 text-zinc-500'
                                    : item.status === 'PREPARING'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {item.status === 'SERVED'
                                  ? 'Yetkazildi'
                                  : item.status === 'PREPARING'
                                  ? '⏳ Tayyorlanmoqda'
                                  : '🟡 Yangi'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Stollar Tabi */}
        {activeTab === 'tables' && (
          <div className="space-y-4">
            {/* Filter Tugmalari */}
            <div className="flex gap-2 text-xs font-bold">
              <button
                onClick={() => setTableFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl border transition-all ${
                  tableFilter === 'all'
                    ? 'bg-brand text-white border-brand shadow-sm font-black'
                    : 'bg-surface text-ink-secondary border-line hover:border-brand/40'
                }`}
              >
                Barcha Stollar
              </button>
              <button
                onClick={() => setTableFilter('occupied')}
                className={`px-3.5 py-1.5 rounded-xl border transition-all ${
                  tableFilter === 'occupied'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm font-black'
                    : 'bg-surface text-amber-800 border-amber-200 hover:bg-amber-50'
                }`}
              >
                Band
              </button>
              <button
                onClick={() => setTableFilter('free')}
                className={`px-3.5 py-1.5 rounded-xl border transition-all ${
                  tableFilter === 'free'
                    ? 'bg-slate-700 text-white border-slate-700 shadow-sm font-black'
                    : 'bg-surface text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Bo'sh
              </button>
            </div>

            {/* Table Cards Grid */}
            {filteredTables.length === 0 ? (
              <div className="p-12 text-center text-xs text-ink-muted bg-surface rounded-card border border-line">
                Stollar topilmadi
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredTables.map((t) => {
                  const isOccupied = t.status === 'OCCUPIED' || !!t.activeVisit;

                  return (
                    <div
                      key={t.id}
                      className={`p-3.5 bg-surface rounded-card border shadow-subtle flex flex-col justify-between transition-all ${
                        isOccupied
                          ? 'border-amber-300 ring-2 ring-amber-500/10'
                          : 'border-line'
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Stol raqami va Holati */}
                        <div className="flex items-center justify-between">
                          <span className="font-black text-base text-ink-main">Stol #{t.number}</span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              isOccupied
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isOccupied ? 'Band' : 'Bo\'sh'}
                          </span>
                        </div>

                        {/* Mas'ul xodim */}
                        {t.assignedWaiter?.fullName ? (
                          <div className="pt-2 border-t border-line/60">
                            <div className="text-[10px] text-ink-muted flex items-center gap-1">
                              <User className="w-3 h-3 text-ink-muted" />
                              <span>Mas'ul xodim:</span>
                            </div>
                            <div className="text-xs font-bold text-ink-main truncate mt-0.5">
                              {t.assignedWaiter.fullName.replace(/\s*\([^)]*\)/g, '').trim()}
                            </div>
                          </div>
                        ) : isOccupied ? (
                          <div className="pt-2 border-t border-line/60">
                            <div className="text-[10px] text-ink-muted flex items-center gap-1">
                              <User className="w-3 h-3 text-ink-muted" />
                              <span>Mas'ul xodim:</span>
                            </div>
                            <div className="text-xs font-semibold text-ink-muted truncate mt-0.5">
                              Biriktirilmagan
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. Sozlamalar Tabi */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-xl mx-auto pb-12 animate-fade-in">
            {/* Profil Qisqacha Kartasi */}
            <div className="bg-surface rounded-2xl p-5 border border-line shadow-subtle flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand flex items-center justify-center font-extrabold text-xl shrink-0 shadow-inner">
                {profileName ? profileName.slice(0, 2).toUpperCase() : 'OF'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-ink-main truncate">{profileName || 'Ofitsiant'}</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand">
                    {tr.waiterRole}
                  </span>
                </div>
                <p className="text-xs text-ink-secondary truncate mt-0.5 font-mono">{profilePhone}</p>
              </div>
            </div>

            {/* 1. Tizim Tili */}
            <div className="bg-surface rounded-2xl p-5 border border-line shadow-subtle space-y-3">
              <div className="flex items-center gap-2 text-ink-main font-bold text-sm">
                <Globe className="w-4 h-4 text-brand" />
                <span>{tr.langTitle}</span>
              </div>
              <p className="text-xs text-ink-secondary">Ilova interfeysi tilini tanlang:</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { code: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
                  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
                ].map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => handleLanguageChange(item.code as any)}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      lang === item.code
                        ? 'border-brand bg-brand-50 text-brand shadow-sm ring-2 ring-brand/20'
                        : 'border-line bg-surface text-ink-secondary hover:border-brand/40'
                    }`}
                  >
                    <span className="text-lg">{item.flag}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Shaxsiy Ma'lumotlar */}
            <div className="bg-surface rounded-2xl p-5 border border-line shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-ink-main font-bold text-sm">
                  <User className="w-4 h-4 text-brand" />
                  <span>{tr.personalInfo}</span>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    {tr.fullNameLabel}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                      placeholder="Masalan: Sardor Rustamov"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-bg focus:bg-surface focus:border-brand focus:ring-2 focus:ring-brand/20 text-xs text-ink-main font-medium outline-none transition-all pl-9"
                    />
                    <User className="w-4 h-4 text-ink-muted absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    {tr.phoneLabel}
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      required
                      placeholder="+998901234567"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-bg focus:bg-surface focus:border-brand focus:ring-2 focus:ring-brand/20 text-xs text-ink-main font-mono outline-none transition-all pl-9"
                    />
                    <Phone className="w-4 h-4 text-ink-muted absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div className="pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSavingProfile}
                    className="w-full gap-2 rounded-xl py-2.5 font-bold text-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingProfile ? tr.saving : tr.saveProfile}</span>
                  </Button>
                </div>
              </form>
            </div>

            {/* 3. Bildirishnomalar va Ovoz */}
            <div className="bg-surface rounded-2xl p-5 border border-line shadow-subtle space-y-4">
              <div className="flex items-center gap-2 text-ink-main font-bold text-sm">
                <Volume2 className="w-4 h-4 text-brand" />
                <span>{tr.soundTitle}</span>
              </div>

              {/* Ovozli signal */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-bg border border-line/60">
                <div className="space-y-0.5 pr-2">
                  <div className="text-xs font-bold text-ink-main">{tr.soundTitle}</div>
                  <div className="text-[11px] text-ink-secondary">{tr.soundDesc}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleSound(!soundEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                      soundEnabled ? 'bg-brand justify-end' : 'bg-zinc-300 justify-start'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
              </div>

              {/* Ovoz balandligi sozlagichi */}
              {soundEnabled && (
                <div className="p-3 rounded-xl bg-bg border border-line/60 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-ink-main">
                    <span>Ovoz balandligi</span>
                    <span className="font-mono text-brand">{soundVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={soundVolume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-full accent-brand cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-ink-secondary">
                    <span>Past</span>
                    <span>O'rta</span>
                    <span>Baland</span>
                  </div>
                </div>
              )}

              {/* Ovozni sinash */}
              <button
                type="button"
                onClick={() => playNotificationSound()}
                className="w-full py-2 px-3 rounded-xl border border-line bg-surface hover:bg-bg text-xs font-semibold text-ink-main flex items-center justify-center gap-2 transition-colors"
              >
                <Volume2 className="w-4 h-4 text-brand" />
                <span>{tr.testSound} 🔊</span>
              </button>

              {/* Vibratsiya */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-bg border border-line/60">
                <div className="space-y-0.5 pr-2">
                  <div className="text-xs font-bold text-ink-main">{tr.vibrationTitle}</div>
                  <div className="text-[11px] text-ink-secondary">{tr.vibrationDesc}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleVibration(!vibrationEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                      vibrationEnabled ? 'bg-brand justify-end' : 'bg-zinc-300 justify-start'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
              </div>

              {/* Vibratsiyani sinash */}
              {typeof navigator !== 'undefined' && 'vibrate' in navigator && (
                <button
                  type="button"
                  onClick={() => navigator.vibrate?.([200, 100, 200])}
                  className="w-full py-2 px-3 rounded-xl border border-line bg-surface hover:bg-bg text-xs font-semibold text-ink-main flex items-center justify-center gap-2 transition-colors"
                >
                  <Smartphone className="w-4 h-4 text-brand" />
                  <span>{tr.testVibration} 📳</span>
                </button>
              )}
            </div>

            {/* 4. Xavfsizlik & Parol o'zgartirish */}
            <div className="bg-surface rounded-2xl p-5 border border-line shadow-subtle space-y-4">
              <div className="flex items-center gap-2 text-ink-main font-bold text-sm">
                <Lock className="w-4 h-4 text-brand" />
                <span>{tr.securityTitle}</span>
              </div>

              {passwordMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    passwordMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {passwordMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{passwordMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    {tr.oldPassLabel}
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 rounded-xl border border-line bg-bg focus:bg-surface focus:border-brand text-xs text-ink-main outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    {tr.newPassLabel}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 rounded-xl border border-line bg-bg focus:bg-surface focus:border-brand text-xs text-ink-main outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    {tr.confirmPassLabel}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 rounded-xl border border-line bg-bg focus:bg-surface focus:border-brand text-xs text-ink-main outline-none transition-all"
                  />
                </div>

                <div className="pt-1">
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    isLoading={isChangingPassword}
                    className="w-full font-bold text-xs rounded-xl py-2.5"
                  >
                    <span>{isChangingPassword ? tr.changingPass : tr.updatePass}</span>
                  </Button>
                </div>
              </form>
            </div>

            {/* Chiqish Tugmasi */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>{tr.logoutBtn}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4 Ta Asosiy Bo'lim: Chaqiruv, Buyurtmalar, Stollar, Sozlamalar (FIXED FOOTER) */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-brand-950/95 backdrop-blur-md border-t border-brand-800 shadow-2xl px-2 py-2 sm:px-6 safe-area-pb">
        <div className="max-w-xl mx-auto grid grid-cols-4 gap-1.5 p-1 rounded-xl text-[11px] font-bold text-center">
          <button
            onClick={() => setActiveTab('calls')}
            className={`py-2 px-1 rounded-xl transition-all relative flex flex-col items-center ${
              activeTab === 'calls'
                ? 'bg-surface text-brand shadow-sm font-black'
                : 'text-brand-200 hover:text-white hover:bg-brand-900/60'
            }`}
          >
            <Bell className="w-5 h-5 mb-0.5" />
            <span className="truncate">{tr.calls}</span>
            {metrics.openCallsCount > 0 && (
              <span className="absolute -top-1 right-2 sm:right-6 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold animate-pulse">
                {metrics.openCallsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`py-2 px-1 rounded-xl transition-all relative flex flex-col items-center ${
              activeTab === 'orders'
                ? 'bg-surface text-brand shadow-sm font-black'
                : 'text-brand-200 hover:text-white hover:bg-brand-900/60'
            }`}
          >
            <Utensils className="w-5 h-5 mb-0.5" />
            <span className="truncate">{tr.orders}</span>
            {tablesWithOrders.filter((t) => t.hasNewOrder || t.hasUnservedItems).length > 0 && (
              <span className="absolute -top-1 right-2 sm:right-6 w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                {tablesWithOrders.filter((t) => t.hasNewOrder || t.hasUnservedItems).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`py-2 px-1 rounded-xl transition-all relative flex flex-col items-center ${
              activeTab === 'tables'
                ? 'bg-surface text-brand shadow-sm font-black'
                : 'text-brand-200 hover:text-white hover:bg-brand-900/60'
            }`}
          >
            <LayoutGrid className="w-5 h-5 mb-0.5" />
            <span className="truncate">{tr.tables}</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-1 rounded-xl transition-all relative flex flex-col items-center ${
              activeTab === 'settings'
                ? 'bg-surface text-brand shadow-sm font-black'
                : 'text-brand-200 hover:text-white hover:bg-brand-900/60'
            }`}
          >
            <Settings className="w-5 h-5 mb-0.5" />
            <span className="truncate">{tr.settings}</span>
          </button>
        </div>
      </footer>

      {/* RAD ETISH MODALI */}
      <Dialog
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Buyurtmani Rad Etish"
      >
        <form onSubmit={handleRejectOrderSubmit} className="space-y-4">
          <p className="text-xs text-ink-secondary">
            Mehmon buyurtmasini rad etish sababini ko'rsating:
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Sababni yozing..."
            className="w-full bg-surface border border-line rounded-xl p-2.5 text-xs text-ink-main focus:outline-none focus:ring-2 focus:ring-rose-500"
            required
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="w-1/3"
              onClick={() => setRejectModalOpen(false)}
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={isRejecting || !rejectReason.trim()}
              className="w-2/3 font-bold"
            >
              {isRejecting ? 'Rad etilmoqda...' : 'Rad etishni tasdiqlash'}
            </Button>
          </div>
        </form>
      </Dialog>




      {/* TO'LOV VA PRE-CHECK MODALI */}
      <Dialog
        isOpen={waiterPaymentModalOpen}
        onClose={() => setWaiterPaymentModalOpen(false)}
        title={`Stol #${selectedVisitForPayment?.tableNumber} — Hisob va To'lov`}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Tabs: To'lov vs Pre-Check */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-bg rounded-xl border border-line text-xs font-bold">
            <button
              type="button"
              onClick={() => setPaymentModalTab('pay')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                paymentModalTab === 'pay'
                  ? 'bg-surface text-brand shadow-sm font-extrabold'
                  : 'text-ink-secondary hover:text-ink-main'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>To'lov Qabul Qilish</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentModalTab('precheck')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                paymentModalTab === 'precheck'
                  ? 'bg-surface text-brand shadow-sm font-extrabold'
                  : 'text-ink-secondary hover:text-ink-main'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Chek</span>
            </button>
          </div>

          {paymentLoading ? (
            <div className="py-12 text-center text-xs text-ink-muted">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand" />
              Hisob ma'lumotlari yuklanmoqda...
            </div>
          ) : !paymentDetailedBill ? (
            <div className="p-4 text-center text-xs text-red-600">
              Hisob topilmadi yoki yuklashda xatolik yuz berdi.
            </div>
          ) : paymentModalTab === 'pay' ? (
            /* PAYMENT TAB */
            <div className="space-y-4">
              {/* Balans & Umumiy Hisob */}
              <div className="p-3.5 bg-brand-50/60 border border-brand-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-brand-800 font-semibold block">To'lanishi kerak bo'lgan summa:</span>
                  <Money
                    amountTiyin={paymentDetailedBill.bill.balanceTiyin}
                    className="text-lg font-black text-brand-950"
                  />
                </div>
                <div className="text-right text-[11px] text-ink-secondary">
                  <div>Xizmat: {formatMoneyUzs(BigInt(paymentDetailedBill.bill.serviceChargeTiyin))}</div>
                  <div>Jami: {formatMoneyUzs(BigInt(paymentDetailedBill.bill.totalDueTiyin))}</div>
                </div>
              </div>

              {/* To'lov Usulini Tanlash */}
              <div>
                <label className="block text-xs font-semibold text-ink-main mb-1.5">
                  To'lov usulini tanlang:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWaiterPaymentMethod('CASH')}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      waiterPaymentMethod === 'CASH'
                        ? 'border-brand bg-brand-50 text-brand shadow-sm'
                        : 'border-line bg-surface text-ink-secondary hover:border-brand/40'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Naqd Pul</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaiterPaymentMethod('TERMINAL')}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      waiterPaymentMethod === 'TERMINAL'
                        ? 'border-brand bg-brand-50 text-brand shadow-sm'
                        : 'border-line bg-surface text-ink-secondary hover:border-brand/40'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Terminal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaiterPaymentMethod('QR')}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      waiterPaymentMethod === 'QR'
                        ? 'border-[#00aaff] bg-sky-50 text-[#0088cc] shadow-sm'
                        : 'border-line bg-surface text-ink-secondary hover:border-sky-300'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Click / Payme</span>
                  </button>
                </div>
              </div>

              {/* Method 1: NAQD PUL DETAILS */}
              {waiterPaymentMethod === 'CASH' && (
                <div className="p-3 bg-bg rounded-2xl border border-line space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
                      Mijozdan berilgan naqd summa:
                    </label>
                    <input
                      type="text"
                      value={waiterTenderedCashUzs}
                      onChange={(e) => setWaiterTenderedCashUzs(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-surface border border-line rounded-xl p-2.5 text-base font-bold text-ink-main focus:outline-none focus:ring-2 focus:ring-brand font-mono"
                      placeholder="0"
                    />
                  </div>

                  {/* Tezkor Summa Tugmalari */}
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setWaiterTenderedCashUzs(
                          (BigInt(paymentDetailedBill.bill.balanceTiyin) / 100n).toString()
                        )
                      }
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-surface border border-line hover:border-brand text-ink-main"
                    >
                      Aniq summa
                    </button>
                    {[50000, 100000, 200000, 500000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setWaiterTenderedCashUzs(v.toString())}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-surface border border-line hover:border-brand text-ink-secondary"
                      >
                        {v.toLocaleString('uz-UZ')}
                      </button>
                    ))}
                  </div>

                  {/* Qaytim Ko'rsatkichi */}
                  <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-secondary">Qaytim:</span>
                    <Money
                      amountTiyin={waiterCalculatedChangeTiyin}
                      className={`text-sm font-bold ${
                        waiterCalculatedChangeTiyin > 0n ? 'text-emerald-700' : 'text-ink-muted'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Method 2: TERMINAL DETAILS */}
              {waiterPaymentMethod === 'TERMINAL' && (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs space-y-1 text-blue-950">
                  <div className="font-bold flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-blue-700" />
                    Uzcard / Humo Terminali
                  </div>
                  <p className="text-[11px] text-blue-800">
                    Terminaldan to'lov qabul qilingach, quyidagi tugmani bosib hisobni yoping.
                  </p>
                </div>
              )}

              {/* Method 3: CLICK / PAYME QR */}
              {waiterPaymentMethod === 'QR' && (
                <UzPaymentQr
                  amountTiyin={paymentDetailedBill.bill.balanceTiyin}
                  tableNumber={selectedVisitForPayment?.tableNumber}
                  visitId={selectedVisitForPayment?.visitId}
                  onPaymentConfirmed={handleCompletePaymentAndCloseVisit}
                />
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-1/3"
                  onClick={() => setWaiterPaymentModalOpen(false)}
                >
                  Bekor qilish
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={
                    isSubmittingPayment ||
                    (waiterPaymentMethod === 'CASH' &&
                      parsedWaiterTenderedCashTiyin < BigInt(paymentDetailedBill.bill.balanceTiyin))
                  }
                  onClick={handleCompletePaymentAndCloseVisit}
                  className="w-2/3 font-bold bg-emerald-700 hover:bg-emerald-800"
                >
                  {isSubmittingPayment ? (
                    'Yopilmoqda...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      To'lov va Stolni Yopish
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* PRE-CHECK TAB */
            <div className="space-y-4 pt-1 font-mono text-xs max-h-[70vh] overflow-y-auto">
              <div className="p-4 bg-white border border-line rounded-xl shadow-inner text-ink-main space-y-3">
                <div className="text-center border-b border-dashed border-gray-400 pb-3 space-y-0.5">
                  <h4 className="font-bold text-sm tracking-widest uppercase">MENUREST RESTORANI</h4>
                  <p className="text-[10px] text-ink-secondary">Pre-Check / Hisob Varaqasi</p>
                  <p className="text-[9px] text-ink-muted">Mazkur hujjat fiskal chek hisoblanmaydi</p>
                </div>

                <div className="text-[11px] space-y-0.5 border-b border-dashed border-gray-400 pb-2">
                  <div className="flex justify-between">
                    <span>Stol:</span>
                    <span className="font-bold">№ {paymentDetailedBill.visit.tableNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sana:</span>
                    <span>{new Date().toLocaleString('uz-UZ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tashrif ID:</span>
                    <span>#{paymentDetailedBill.visit.id.slice(0, 8)}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="border-b border-dashed border-gray-400 pb-2 space-y-1">
                  {paymentDetailedBill.orders
                    .flatMap((o: any) => o.items)
                    .filter((i: any) => i.status !== 'CANCELLED')
                    .map((it: any) => (
                      <div key={it.id} className="flex justify-between text-[11px]">
                        <div className="truncate max-w-[190px]">
                          {stripParentheses(it.dishTitle || it.snapshotName || it.name)} {it.quantity > 1 ? `${it.quantity}x` : ''}
                        </div>
                        <div className="font-semibold">
                          <Money
                            amountTiyin={
                              (BigInt(it.snapshotPriceTiyin) +
                                (it.addonSnapshots?.reduce(
                                  (sum: bigint, a: any) => sum + BigInt(a.priceTiyin),
                                  0n
                                ) || 0n)) *
                              BigInt(it.quantity)
                            }
                          />
                        </div>
                      </div>
                    ))}
                </div>

                {/* Totals */}
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Oraliq summa:</span>
                    <span><Money amountTiyin={paymentDetailedBill.bill.subtotalTiyin} /></span>
                  </div>
                  {BigInt(paymentDetailedBill.bill.discountTiyin) > 0n && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Chegirma:</span>
                      <span>- <Money amountTiyin={paymentDetailedBill.bill.discountTiyin} /></span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Xizmat {paymentDetailedBill.bill.serviceChargeBps / 100}%:</span>
                    <span><Money amountTiyin={paymentDetailedBill.bill.serviceChargeTiyin} /></span>
                  </div>
                  <div className="pt-2 border-t border-dashed border-gray-400 flex justify-between font-bold text-sm">
                    <span>JAMI TO'LOV:</span>
                    <span><Money amountTiyin={paymentDetailedBill.bill.totalDueTiyin} /></span>
                  </div>
                  {BigInt(paymentDetailedBill.bill.netPaidTiyin) > 0n && (
                    <div className="flex justify-between text-[11px] text-emerald-700">
                      <span>To'langan:</span>
                      <span><Money amountTiyin={paymentDetailedBill.bill.netPaidTiyin} /></span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-xs pt-1">
                    <span>QOLDIQ:</span>
                    <span><Money amountTiyin={paymentDetailedBill.bill.balanceTiyin} /></span>
                  </div>
                </div>

                {/* QR Hint */}
                <div className="pt-3 border-t border-dashed border-gray-400 text-center space-y-1">
                  <div className="text-[10px] text-ink-secondary">Click va Payme orqali to'lash mumkin</div>
                  <div className="text-[9px] text-ink-muted">Tashrifingiz uchun rahmat!</div>
                </div>
              </div>

              <div className="flex justify-between gap-2 pt-2 font-sans">
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="flex items-center gap-1 font-bold text-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Chop Etish
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setPaymentModalTab('pay')}
                  className="font-bold text-xs"
                >
                  To'lovga O'tish <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>


    </div>
  );
};
