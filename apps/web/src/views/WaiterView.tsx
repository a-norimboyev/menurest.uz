import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bell,
  CheckCircle2,
  Utensils,
  LayoutGrid,
  Clock,
  AlertTriangle,
  Receipt,
  Plus,
  RefreshCw,
  X,
  AlertCircle,
  KeyRound,
  CreditCard,
  Banknote,
  QrCode,
  Sparkles,
  Printer,
  ChevronRight,
  UserCheck,
  User,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { Status } from '../components/ui/Status.tsx';
import { Money } from '../components/ui/Money.tsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { useRealtime } from '../hooks/useRealtime.ts';
import { ConnectionBanner, RealtimeIndicatorPill } from '../components/ui/ConnectionBanner.tsx';
import { UzPaymentQr } from '../components/payment/UzPaymentQr.tsx';
import { formatMoneyUzs } from '@menurest/shared';

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
  } | null;
}

export const WaiterView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calls' | 'ready' | 'pending' | 'tables'>('calls');
  const [loading, setLoading] = useState(false);
  const [restaurantSlug] = useState('rayhon-chilonzor');

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

  // Open Visit Dialog
  const [openVisitModalOpen, setOpenVisitModalOpen] = useState(false);
  const [selectedTableForVisit, setSelectedTableForVisit] = useState<WaiterTableItem | null>(null);
  const [openedPinCode, setOpenedPinCode] = useState<string | null>(null);
  const [isOpeningVisit, setIsOpeningVisit] = useState(false);

  // Staff Order Dialog
  const [staffOrderModalOpen, setStaffOrderModalOpen] = useState(false);
  const [staffOrderTable, setStaffOrderTable] = useState<WaiterTableItem | null>(null);
  const [staffOrderNotes, setStaffOrderNotes] = useState('');
  const [isSubmittingStaffOrder, setIsSubmittingStaffOrder] = useState(false);

  // Available Menu Dishes for Staff Order
  const [availableDishes, setAvailableDishes] = useState<any[]>([]);

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

  // Table filters & Waiter Accountability State
  const [tableFilter, setTableFilter] = useState<'all' | 'my' | 'occupied' | 'free'>('all');
  const [tableSearch, setTableSearch] = useState('');
  const [tableHallFilter, setTableHallFilter] = useState<string>('ALL');
  const [otherWaiterWarningTable, setOtherWaiterWarningTable] = useState<WaiterTableItem | null>(null);
  const [claimingTableId, setClaimingTableId] = useState<string | null>(null);

  // Hisoblangan metrikalar
  const myAssignedTablesCount = useMemo(() => myTables.filter((t) => t.isMyTable).length, [myTables]);
  const myOccupiedTablesCount = useMemo(
    () => myTables.filter((t) => t.isMyTable && t.status === 'OCCUPIED').length,
    [myTables]
  );
  const myTotalBillTiyin = useMemo(() => {
    return myTables
      .filter((t) => t.isMyTable && t.activeVisit)
      .reduce((sum, t) => sum + BigInt(t.activeVisit!.totalBillTiyin || '0'), 0n);
  }, [myTables]);

  const uniqueHalls = useMemo(() => {
    const map = new Map<string, string>();
    myTables.forEach((t) => {
      if (t.hall) map.set(t.hall.id, t.hall.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [myTables]);

  const filteredTables = useMemo(() => {
    return myTables.filter((t) => {
      if (tableFilter === 'my' && !t.isMyTable) return false;
      if (tableFilter === 'occupied' && t.status !== 'OCCUPIED') return false;
      if (tableFilter === 'free' && t.status !== 'FREE') return false;
      if (tableHallFilter !== 'ALL' && t.hall?.id !== tableHallFilter) return false;
      if (tableSearch.trim()) {
        const query = tableSearch.toLowerCase().trim();
        const numMatch = t.number.toString().includes(query);
        const waiterMatch = t.assignedWaiter?.fullName?.toLowerCase().includes(query);
        const hallMatch = t.hall?.name?.toLowerCase().includes(query);
        if (!numMatch && !waiterMatch && !hallMatch) return false;
      }
      return true;
    });
  }, [myTables, tableFilter, tableHallFilter, tableSearch]);

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
  const { status, soundEnabled, toggleSound } = useRealtime({
    restaurantId: restaurantSlug,
    onReconnect: fetchDashboard,
    onEvent: () => {
      fetchDashboard();
    },
  });

  // Load menu for staff order
  useEffect(() => {
    fetchDashboard();
    fetch(`/api/v1/public/restaurants/${restaurantSlug}/menu?lang=uz`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.items) {
          setAvailableDishes(d.data.items);
        }
      })
      .catch(() => {});
  }, [fetchDashboard, restaurantSlug]);



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
        setFeedbackMsg({ text: 'Taom yetkazildi (SERVED)!', type: 'success' });
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
        setFeedbackMsg({ text: 'Buyurtma tasdiqlandi va oshxonaga yo\'naltirildi!', type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3000);
        await fetchDashboard();
      } else {
        alert(json.error?.message || 'Tasdiqlashda xatolik');
      }
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

  // 6. Stolga tashrif ochish (Open Visit)
  async function handleOpenVisitSubmit() {
    if (!selectedTableForVisit) return;
    try {
      setIsOpeningVisit(true);
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/tables/${selectedTableForVisit.id}/open-visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setOpenedPinCode(json.data.pinCode);
        setFeedbackMsg({ text: `Stol #${selectedTableForVisit.number} ochildi! Kod: ${json.data.pinCode}`, type: 'success' });
        await fetchDashboard();
      } else {
        alert(json.error?.message || 'Tashrif ochishda xatolik');
      }
    } catch {
      alert('Tarmoq xatoligi');
    } finally {
      setIsOpeningVisit(false);
    }
  }

  // 7. Mehmon nomidan buyurtma yaratish (Staff Order)
  async function handleStaffOrderSubmit(dishId: string) {
    if (!staffOrderTable?.activeVisit) return;

    try {
      setIsSubmittingStaffOrder(true);
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/waiter/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId: staffOrderTable.activeVisit.id,
          orderNotes: staffOrderNotes.trim() || undefined,
          items: [{ menuItemId: dishId, quantity: 1 }],
        }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setStaffOrderModalOpen(false);
        setStaffOrderNotes('');
        setFeedbackMsg({ text: 'Buyurtma mehmon nomidan kiritildi!', type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3000);
        await fetchDashboard();
      } else {
        alert(json.error?.message || 'Buyurtma kiritishda xatolik');
      }
    } catch {
      alert('Tarmoq xatoligi');
    } finally {
      setIsSubmittingStaffOrder(false);
    }
  }

  // 8. Stolni tozalash (Clean Table: DIRTY -> FREE)
  async function handleCleanTable(tableId: string) {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/tables/${tableId}/clean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setFeedbackMsg({ text: 'Stol tozalandi va bo\'sh deb belgilandi!', type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3000);
        await fetchDashboard();
      } else {
        alert(json.error?.message || 'Stolni tozalashda xatolik');
      }
    } catch {
      alert('Tarmoq xatoligi');
    }
  }

  // 8.1. Stolni o'ziga biriktirish (Claim Table)
  async function handleClaimTable(tableId: string) {
    try {
      setClaimingTableId(tableId);
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/waiter/tables/${tableId}/claim`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setFeedbackMsg({ text: 'Stol sizga muvaffaqiyatli biriktirildi!', type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3000);
        await fetchDashboard();
      } else {
        alert(json.error?.message || 'Stolni biriktirishda xatolik yuz berdi');
      }
    } catch {
      alert('Tarmoq xatoligi');
    } finally {
      setClaimingTableId(null);
    }
  }

  // 8.2. Stol biriktirilishini bekor qilish (Unclaim Table)
  async function handleUnclaimTable(tableId: string) {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/waiter/tables/${tableId}/unclaim`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setFeedbackMsg({ text: 'Stol biriktirilishi bekor qilindi', type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3000);
        await fetchDashboard();
      } else {
        alert(json.error?.message || 'Xatolik yuz berdi');
      }
    } catch {
      alert('Tarmoq xatoligi');
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
      <div className="bg-brand-900 text-white p-4 sticky top-0 z-20 shadow-subtle space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-700 flex items-center justify-center font-bold text-sm text-white shadow-inner">
              OF
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Ofitsiant Paneli</h1>
              <p className="text-[11px] text-brand-200">Rayhon Milliy Taomlar • Mobil</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RealtimeIndicatorPill
              status={status}
              soundEnabled={soundEnabled}
              onToggleSound={toggleSound}
            />
            <button
              onClick={fetchDashboard}
              className="p-1.5 rounded-lg bg-surface/10 hover:bg-surface/20 text-white transition-colors"
              title="Yangilash"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4 Ta Asosiy Ko'rsatkichlar Pilli */}
        <div className="grid grid-cols-4 gap-1.5 bg-brand-950/60 p-1.5 rounded-xl border border-brand-800 text-[11px] font-bold text-center">
          <button
            onClick={() => setActiveTab('calls')}
            className={`py-2 px-1 rounded-lg transition-all relative flex flex-col items-center ${
              activeTab === 'calls' ? 'bg-surface text-brand shadow-sm font-extrabold' : 'text-brand-200 hover:text-white'
            }`}
          >
            <Bell className="w-4 h-4 mb-0.5" />
            <span className="truncate">Chaqiruv</span>
            {metrics.openCallsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                {metrics.openCallsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ready')}
            className={`py-2 px-1 rounded-lg transition-all relative flex flex-col items-center ${
              activeTab === 'ready' ? 'bg-surface text-brand shadow-sm font-extrabold' : 'text-brand-200 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 mb-0.5" />
            <span className="truncate">Tayyor</span>
            {metrics.readyItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                {metrics.readyItemsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2 px-1 rounded-lg transition-all relative flex flex-col items-center ${
              activeTab === 'pending' ? 'bg-surface text-brand shadow-sm font-extrabold' : 'text-brand-200 hover:text-white'
            }`}
          >
            <Utensils className="w-4 h-4 mb-0.5" />
            <span className="truncate">Tasdiq</span>
            {metrics.pendingOrdersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                {metrics.pendingOrdersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`py-2 px-1 rounded-lg transition-all relative flex flex-col items-center ${
              activeTab === 'tables' ? 'bg-surface text-brand shadow-sm font-extrabold' : 'text-brand-200 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4 mb-0.5" />
            <span className="truncate">Stollar</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK TOAST / BANNER */}
      {feedbackMsg && (
        <div
          className={`mx-4 mt-3 p-3 rounded-2xl text-xs font-bold shadow-lg flex items-center justify-between animate-fade-in ${
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
        <div className="mx-4 mt-3 p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 space-y-1.5">
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
                        <span className="text-[11px] text-ink-muted">({call.hallName})</span>
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

        {/* 2. Tayyor Taomlar (Yetkazish) */}
        {activeTab === 'ready' && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-ink-muted uppercase tracking-wider">
              Oshxona/Bardan Yetkazish ({readyItems.length})
            </h2>

            {readyItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-muted bg-surface rounded-card border border-line">
                Barcha tayyor taomlar yetkazildi
              </div>
            ) : (
              readyItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-card border border-emerald-200 bg-emerald-50/40 shadow-subtle flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-ink-main">Stol #{item.tableNumber}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                        {item.stationName}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-emerald-950 truncate">
                      {item.quantity}x {item.name} {item.variantName ? `(${item.variantName})` : ''}
                    </div>
                    <div className="text-[10px] text-ink-muted">Buyurtma #{item.orderNumber}</div>
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleServeItem(item.id)}
                    className="shrink-0 font-bold bg-emerald-700 hover:bg-emerald-800"
                  >
                    Yetkazildi (SERVED)
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. Tasdiq Kutayotgan Buyurtmalar */}
        {activeTab === 'pending' && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-ink-muted uppercase tracking-wider">
              Mehmon Buyurtmalari ({pendingOrders.length})
            </h2>

            {pendingOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-muted bg-surface rounded-card border border-line">
                Kutilayotgan yangi buyurtmalar yo'q
              </div>
            ) : (
              pendingOrders.map((ord) => {
                const totalTiyin = ord.items.reduce(
                  (sum, i) => sum + BigInt(i.priceTiyin) * BigInt(i.quantity),
                  0n
                );

                return (
                  <div
                    key={ord.id}
                    className="p-4 rounded-card border border-line bg-surface shadow-subtle space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-ink-main">Stol #{ord.tableNumber}</span>
                        <span className="text-xs text-ink-muted">Buyurtma #{ord.orderNumber}</span>
                      </div>
                      <Money amountTiyin={totalTiyin} className="text-sm font-bold text-brand" />
                    </div>

                    {ord.notes && (
                      <div className="text-xs text-ink-secondary bg-bg p-2 rounded-xl border border-line italic">
                        Izoh: "{ord.notes}"
                      </div>
                    )}

                    <div className="divide-y divide-line/60">
                      {ord.items.map((it) => (
                        <div key={it.id} className="py-1.5 flex justify-between text-xs text-ink-main">
                          <span>
                            {it.quantity}x {it.name} {it.variantName ? `(${it.variantName})` : ''}
                          </span>
                          <Money amountTiyin={BigInt(it.priceTiyin) * BigInt(it.quantity)} className="font-semibold" />
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-line">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setRejectOrderId(ord.id);
                          setRejectReason('');
                          setRejectModalOpen(true);
                        }}
                        className="w-1/3 text-rose-700 border border-rose-200 hover:bg-rose-50 font-bold"
                      >
                        Rad Etish
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleConfirmOrder(ord.id)}
                        className="w-2/3 font-bold"
                      >
                        Tasdiqlash & Oshxonaga
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 4. Mening Stollarim & Zaldagi Barcha Stollar */}
        {activeTab === 'tables' && (
          <div className="space-y-4">
            {/* Waiter Accountability & Table Summary Card */}
            <div className="p-3.5 bg-surface rounded-card border border-line shadow-subtle grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-bg border border-line/60">
                <div className="text-[10px] text-ink-muted font-semibold uppercase tracking-wider">Mening Stollarim</div>
                <div className="text-lg font-black text-emerald-800 flex items-center gap-1 mt-0.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>{myAssignedTablesCount} ta</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-bg border border-line/60">
                <div className="text-[10px] text-ink-muted font-semibold uppercase tracking-wider">Faol (Band) Stollarim</div>
                <div className="text-lg font-black text-brand flex items-center gap-1 mt-0.5">
                  <Clock className="w-4 h-4 text-brand" />
                  <span>{myOccupiedTablesCount} ta</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-brand-50/60 border border-brand-200 col-span-2">
                <div className="text-[10px] text-brand-800 font-semibold uppercase tracking-wider">Mening Stollarim Jami Balansi</div>
                <div className="mt-0.5">
                  <Money amountTiyin={myTotalBillTiyin} className="text-lg font-black text-brand-950" />
                </div>
              </div>
            </div>

            {/* Filter Pills, Search & Halls */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                  <button
                    onClick={() => setTableFilter('all')}
                    className={`px-3 py-1.5 rounded-xl border transition-all ${
                      tableFilter === 'all'
                        ? 'bg-brand text-white border-brand shadow-sm font-black'
                        : 'bg-surface text-ink-secondary border-line hover:border-brand/40'
                    }`}
                  >
                    Barcha Stollar ({myTables.length})
                  </button>
                  <button
                    onClick={() => setTableFilter('my')}
                    className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                      tableFilter === 'my'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm font-black'
                        : 'bg-surface text-emerald-800 border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Mening Stollarim ({myAssignedTablesCount})
                  </button>
                  <button
                    onClick={() => setTableFilter('occupied')}
                    className={`px-3 py-1.5 rounded-xl border transition-all ${
                      tableFilter === 'occupied'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm font-black'
                        : 'bg-surface text-amber-800 border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    Band ({myTables.filter((t) => t.status === 'OCCUPIED').length})
                  </button>
                  <button
                    onClick={() => setTableFilter('free')}
                    className={`px-3 py-1.5 rounded-xl border transition-all ${
                      tableFilter === 'free'
                        ? 'bg-slate-700 text-white border-slate-700 shadow-sm font-black'
                        : 'bg-surface text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Bo'sh ({myTables.filter((t) => t.status === 'FREE').length})
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative min-w-[170px]">
                  <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Stol # yoki ofitsiant..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-surface border border-line rounded-xl text-ink-main placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  {tableSearch && (
                    <button
                      onClick={() => setTableSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-main text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Hall Filter Pills (if multiple halls) */}
              {uniqueHalls.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-semibold">
                  <span className="text-ink-muted text-[10px] mr-1">Zal:</span>
                  <button
                    onClick={() => setTableHallFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg border shrink-0 transition-colors ${
                      tableHallFilter === 'ALL'
                        ? 'bg-brand-900 text-white border-brand-900'
                        : 'bg-surface text-ink-secondary border-line'
                    }`}
                  >
                    Barcha zallar
                  </button>
                  {uniqueHalls.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setTableHallFilter(h.id)}
                      className={`px-2.5 py-1 rounded-lg border shrink-0 transition-colors ${
                        tableHallFilter === h.id
                          ? 'bg-brand-900 text-white border-brand-900'
                          : 'bg-surface text-ink-secondary border-line'
                      }`}
                    >
                      {h.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Table Cards Grid */}
            {filteredTables.length === 0 ? (
              <div className="p-12 text-center text-xs text-ink-muted bg-surface rounded-card border border-line">
                Filtrga mos keluvchi stollar topilmadi
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredTables.map((t) => {
                  const isMine = t.isMyTable;

                  return (
                    <div
                      key={t.id}
                      className={`p-3.5 bg-surface rounded-card border shadow-subtle space-y-2.5 flex flex-col justify-between transition-all ${
                        isMine
                          ? 'border-emerald-400/80 ring-2 ring-emerald-500/10'
                          : 'border-line'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-base text-ink-main">Stol #{t.number}</span>
                          <span className="text-[10px] text-ink-muted font-medium">{t.capacity} kishilik</span>
                        </div>
                        <div>
                          <Status type="table" value={t.status} />
                        </div>
                        <div className="text-[10px] text-ink-muted truncate">{t.hall.name}</div>

                        {/* Mas'ul Ofitsiant Belgisi */}
                        {isMine ? (
                          <div className="flex items-center justify-between px-2 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 text-[11px] font-bold">
                            <span className="flex items-center gap-1 truncate">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">Mas'ul: Siz</span>
                            </span>
                            {t.status === 'FREE' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnclaimTable(t.id);
                                }}
                                className="text-[9px] text-emerald-700 hover:text-emerald-900 underline font-normal shrink-0 ml-1"
                                title="Stolni bo'shatish"
                              >
                                Ajratish
                              </button>
                            )}
                          </div>
                        ) : t.assignedWaiter ? (
                          <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-[11px] font-medium truncate">
                            <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate" title={t.assignedWaiter.fullName}>
                              Mas'ul: {t.assignedWaiter.fullName.split(' ')[0]}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between px-2 py-1 bg-amber-50/70 text-amber-800 rounded-lg border border-amber-200/60 text-[11px]">
                            <span className="text-[10px] text-amber-700 font-medium truncate">Biriktirilmagan</span>
                            <button
                              disabled={claimingTableId === t.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClaimTable(t.id);
                              }}
                              className="text-[10px] font-bold text-brand bg-white px-1.5 py-0.5 rounded border border-brand/30 hover:bg-brand-50 shrink-0 ml-1 transition-colors"
                            >
                              {claimingTableId === t.id ? '...' : '+ Olish'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* OCCUPIED HOLATIDAGI STOL HISOBI VA AMALLARI */}
                      {t.status === 'OCCUPIED' && t.activeVisit && (
                        <div className="pt-2 border-t border-line space-y-2 text-[11px]">
                          <div className="flex items-center justify-between font-mono font-bold text-brand bg-brand-50 px-2 py-0.5 rounded-md">
                            <span className="flex items-center gap-1">
                              <KeyRound className="w-3 h-3" /> PIN:
                            </span>
                            <span>{t.activeVisit.pinCode}</span>
                          </div>

                          <div className="flex justify-between text-ink-muted text-[10px]">
                            <span>Buyurtmalar:</span>
                            <span className="font-bold text-ink-main">{t.activeVisit.ordersCount} ta</span>
                          </div>

                          {/* Alohida Stol Hisobi */}
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
                            <div className="text-[9px] text-ink-muted uppercase font-bold tracking-wider">
                              Stol Alohida Hisobi:
                            </div>
                            <Money
                              amountTiyin={BigInt(t.activeVisit.totalBillTiyin)}
                              className="text-sm font-black text-ink-main block"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (!isMine && t.assignedWaiter) {
                                  setOtherWaiterWarningTable(t);
                                } else {
                                  setStaffOrderTable(t);
                                  setStaffOrderNotes('');
                                  setStaffOrderModalOpen(true);
                                }
                              }}
                              className="text-[10px] py-1 h-7 font-bold"
                            >
                              + Buyurtma
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleOpenPaymentModal(t.activeVisit!.id, t.number)}
                              className="text-[10px] py-1 h-7 font-bold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center gap-1"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>To'lov / Chek</span>
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* DIRTY HOLATIDAGI STOL */}
                      {t.status === 'DIRTY' && (
                        <div className="pt-2 border-t border-line">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleCleanTable(t.id)}
                            className="w-full text-xs font-bold text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 flex items-center justify-center gap-1.5 py-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>Tozalandi (Bo'shatish)</span>
                          </Button>
                        </div>
                      )}

                      {/* FREE HOLATIDAGI STOL */}
                      {t.status === 'FREE' && (
                        <div className="pt-2 border-t border-line space-y-1.5">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setSelectedTableForVisit(t);
                              setOpenedPinCode(null);
                              setOpenVisitModalOpen(true);
                            }}
                            className="w-full text-xs font-bold"
                          >
                            Tashrif Ochish
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RAD ETISH MODALI */}
      <Dialog
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Buyurtmani Rad Etish"
      >
        <form onSubmit={handleRejectOrderSubmit} className="space-y-4">
          <p className="text-xs text-ink-secondary">
            Mehmon buyurtmasini rad etish sababini ko'rsating (masalan: Masalliq tugagan, Stol bekor qildi):
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

      {/* TASHRIF OCHISH MODALI */}
      <Dialog
        isOpen={openVisitModalOpen}
        onClose={() => setOpenVisitModalOpen(false)}
        title={`Stol #${selectedTableForVisit?.number} ga Tashrif Ochish`}
      >
        <div className="space-y-4">
          {!openedPinCode ? (
            <>
              <p className="text-xs text-ink-secondary">
                Ushbu stolga yangi tashrif ochilsinmi? Tizim mehmonlar uchun 4-xonali kirish PIN kodini generatsiya qiladi.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="w-1/3"
                  onClick={() => setOpenVisitModalOpen(false)}
                >
                  Bekor qilish
                </Button>
                <Button
                  variant="primary"
                  disabled={isOpeningVisit}
                  className="w-2/3 font-bold"
                  onClick={handleOpenVisitSubmit}
                >
                  {isOpeningVisit ? 'Ochilmoqda...' : 'Tashrifni Ochish'}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center space-y-3 py-2">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-700">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-ink-main">Tashrif Muvaffaqiyatli Ochildi!</h3>
              <p className="text-xs text-ink-muted">Ushbu kodni stoldagi mehmonga bering:</p>
              <div className="text-3xl font-mono font-black text-brand bg-brand-50 py-3 rounded-2xl border border-brand-200 tracking-widest">
                {openedPinCode}
              </div>
              <Button
                variant="primary"
                className="w-full mt-2 font-bold"
                onClick={() => setOpenVisitModalOpen(false)}
              >
                Tushundim
              </Button>
            </div>
          )}
        </div>
      </Dialog>

      {/* MEHMON NOMIDAN BUYURTMA MODALI */}
      <Dialog
        isOpen={staffOrderModalOpen}
        onClose={() => setStaffOrderModalOpen(false)}
        title={`Stol #${staffOrderTable?.number} ga Buyurtma Kiritish`}
      >
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          <p className="text-xs text-ink-secondary">
            Mehmon nomidan taom tanlab buyurtma yarating:
          </p>

          <input
            type="text"
            value={staffOrderNotes}
            onChange={(e) => setStaffOrderNotes(e.target.value)}
            placeholder="Buyurtmaga izoh (ixtiyoriy)..."
            className="w-full bg-surface border border-line rounded-xl p-2 text-xs text-ink-main focus:outline-none focus:ring-2 focus:ring-brand"
          />

          <div className="divide-y divide-line/60">
            {availableDishes.map((dish) => (
              <div key={dish.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-ink-main">{dish.name}</div>
                  <Money amountTiyin={BigInt(dish.basePriceTiyin)} className="text-ink-muted" />
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={isSubmittingStaffOrder || !dish.isAvailable}
                  onClick={() => handleStaffOrderSubmit(dish.id)}
                  className="text-xs h-7 px-2.5 font-bold"
                >
                  <Plus className="w-3.5 h-3.5 mr-0.5" /> Qo'shish
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Dialog>
      {/* TO'LOV VA PRE-CHECK MODALI */}
      <Dialog
        isOpen={waiterPaymentModalOpen}
        onClose={() => setWaiterPaymentModalOpen(false)}
        title={`Stol #${selectedVisitForPayment?.tableNumber} — Hisob & To'lov`}
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
              <span>Pre-Check (Chek)</span>
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
                      Mijozdan berilgan naqd summa (so'm):
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
                    <span className="font-semibold text-ink-secondary">Qaytim (Mijozga):</span>
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
                      To'lov & Stolni Yopish
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
                          {it.dishTitle} {it.quantity > 1 ? `(${it.quantity}x)` : ''}
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
                    <span>Xizmat ({paymentDetailedBill.bill.serviceChargeBps / 100}%):</span>
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

      {/* BOSHQASINING STOLIGA BUYURTMA URISH OGOHLANTIRISH MODALI */}
      <Dialog
        isOpen={!!otherWaiterWarningTable}
        onClose={() => setOtherWaiterWarningTable(null)}
        title="Mas'uliyat Ogohlantirishi"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1 text-amber-950">
              <div className="font-bold">
                Stol #{otherWaiterWarningTable?.number} boshqa ofitsiantga biriktirilgan!
              </div>
              <p className="text-amber-800 leading-relaxed">
                Mazkur stolga rasman <strong>{otherWaiterWarningTable?.assignedWaiter?.fullName}</strong> mas'ul qilib belgilangan.
                Har bir stolning hisob-kitobi va buyurtmalari uchun biriktirilgan ofitsiant shaxsan javobgardir.
              </p>
            </div>
          </div>

          <p className="text-xs text-ink-secondary">
            Mehmon iltimosiga ko'ra ushbu stol nomidan buyurtma kiritishni davom ettirasizmi?
          </p>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="w-1/2"
              onClick={() => setOtherWaiterWarningTable(null)}
            >
              Bekor qilish
            </Button>
            <Button
              variant="primary"
              className="w-1/2 font-bold bg-amber-700 hover:bg-amber-800"
              onClick={() => {
                const target = otherWaiterWarningTable;
                setOtherWaiterWarningTable(null);
                if (target) {
                  setStaffOrderTable(target);
                  setStaffOrderNotes('');
                  setStaffOrderModalOpen(true);
                }
              }}
            >
              Davom ettirish
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
