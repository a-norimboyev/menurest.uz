import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Banknote,
  Receipt,
  CheckCircle2,
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Check,
  User,
  Menu,
  X,
  LogOut,
  Plus,
  ShoppingBag,
  Trash2,
  Search,
  Clock,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { useRealtime } from '../hooks/useRealtime.ts';
import { formatMoneyUzs } from '@menurest/shared';

const stripParentheses = (str?: string | null): string =>
  str ? str.replace(/\s*\([^)]*\)/g, '').trim() : '';

interface TakeawayItem {
  name: string;
  quantity: number;
  priceUzs: number;
}

interface TakeawayOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  pickupTime: string;
  items: TakeawayItem[];
  totalUzs: number;
  status: 'PREPARING' | 'READY' | 'COMPLETED';
  paymentStatus: 'UNPAID' | 'PAID';
  paymentMethod?: 'CASH' | 'TERMINAL' | 'CLICK';
  createdAt: string;
}

interface OpenBillDto {
  visitId: string;
  tableId: string;
  tableNumber: number;
  waiterName: string | null;
  openedAt: string;
  itemCount: number;
  items?: Array<{
    name: string;
    quantity: number;
    priceTiyin: string;
  }>;
  bill: {
    subtotalTiyin: string;
    discountTiyin: string;
    discountedSubtotalTiyin: string;
    serviceChargeBps: number;
    serviceChargeTiyin: string;
    adjustmentsTiyin: string;
    totalDueTiyin: string;
    grossPaidTiyin: string;
    reversedPaidTiyin: string;
    refundedTiyin: string;
    netPaidTiyin: string;
    balanceTiyin: string;
    isRefundDue: boolean;
    isFullyPaid: boolean;
  };
}

interface DetailedBillResponse {
  visit: {
    id: string;
    restaurantId: string;
    tableId: string;
    tableNumber: number;
    status: string;
    openedAt: string;
    closedAt: string | null;
    waiterId: string | null;
    serviceChargeBpsSnapshot: number | null;
  };
  bill: {
    subtotalTiyin: string;
    discountTiyin: string;
    discountedSubtotalTiyin: string;
    serviceChargeBps: number;
    serviceChargeTiyin: string;
    adjustmentsTiyin: string;
    totalDueTiyin: string;
    grossPaidTiyin: string;
    reversedPaidTiyin: string;
    refundedTiyin: string;
    netPaidTiyin: string;
    balanceTiyin: string;
    isRefundDue: boolean;
    isFullyPaid: boolean;
  };
  orders: Array<{
    id: string;
    orderNumber: number;
    status: string;
    items: Array<{
      id: string;
      dishId?: string;
      dishTitle?: string;
      snapshotName: string;
      variantTitle?: string | null;
      quantity: number;
      snapshotPriceTiyin: string;
      status: string;
      addonSnapshots?: Array<{
        name: string;
        priceTiyin: string;
      }>;
    }>;
  }>;
  adjustments: Array<{
    id: string;
    type: string;
    amountTiyin: string;
    reason: string;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    amountTiyin: string;
    method: 'CASH' | 'TERMINAL';
    status: 'COMPLETED' | 'REVERSED';
    tenderedCashTiyin?: string | null;
    changeTiyin?: string | null;
    createdAt: string;
    reversalReason?: string | null;
    refunds?: Array<{
      id: string;
      amountTiyin: string;
      reason: string;
      createdAt: string;
    }>;
  }>;
}

interface CashierViewProps {
  restaurantId?: string;
  authProfile?: any;
  onLogout?: () => void;
}

export const CashierView: React.FC<CashierViewProps> = ({
  restaurantId: propRestId,
  authProfile,
  onLogout,
}) => {
  const getInitialRestaurantId = () => {
    return (
      authProfile?.activeRestaurant?.id ||
      authProfile?.activeRestaurant?.slug ||
      propRestId ||
      'ef5ac39f-8794-499e-ada6-d2fc9632f8e8'
    );
  };

  const [restaurantId, setRestaurantId] = useState(getInitialRestaurantId);

  useEffect(() => {
    if (authProfile?.activeRestaurant?.id || authProfile?.activeRestaurant?.slug) {
      setRestaurantId(authProfile.activeRestaurant.id || authProfile.activeRestaurant.slug);
    }
  }, [authProfile]);

  // Sidebar navigatsiya
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'open_bills' | 'takeaway'>('open_bills');

  // Olib ketish buyurtmalari (soxta mock ma'lumotlarsiz toza boshlanadi)
  const [takeawayOrders, setTakeawayOrders] = useState<TakeawayOrder[]>(() => {
    try {
      const saved = localStorage.getItem(`menurest_takeaway_${restaurantId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.some((p: any) => p.id === 't-101' || p.id === 't-102' || p.id === 't-103')
        ) {
          localStorage.removeItem(`menurest_takeaway_${restaurantId}`);
          return [];
        }
        return parsed;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(`menurest_takeaway_${restaurantId}`, JSON.stringify(takeawayOrders));
    } catch {}
  }, [takeawayOrders, restaurantId]);

  // Yangi Olib ketish buyurtmasi — Menudan taom tanlash
  const [showNewTakeawayModal, setShowNewTakeawayModal] = useState(false);
  const [menuCategories, setMenuCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [menuItems, setMenuItems] = useState<
    Array<{ id: string; name: string; basePriceTiyin: string; categoryId: string; isAvailable: boolean }>
  >([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string>('ALL');
  const [dishSearch, setDishSearch] = useState('');
  const [orderBasket, setOrderBasket] = useState<
    Array<{ dishId: string; name: string; priceUzs: number; quantity: number }>
  >([]);
  const [orderNote, setOrderNote] = useState('');

  // Asosiy POS holatlari
  const [openBills, setOpenBills] = useState<OpenBillDto[]>([]);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [detailedBill, setDetailedBill] = useState<DetailedBillResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [mobileStep, setMobileStep] = useState<'tables' | 'checkout'>('tables');

  // To'lov turi: Naqd pul, Plastik karta, Aralash to'lov
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'TERMINAL' | 'SPLIT'>('CASH');
  const [tenderedCashInput, setTenderedCashInput] = useState<string>('');
  const [splitCashInput, setSplitCashInput] = useState<string>('');
  const [splitCardInput, setSplitCardInput] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Xabarnomalar
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Ochiq stollar va hisoblarni olish
  const fetchOpenBills = useCallback(async () => {
    try {
      setLoading(true);
      let res = await fetch(`/api/v1/restaurants/${restaurantId}/billing/open-bills`, {
        credentials: 'include',
      });

      // Agar sessiya uzilgan bo'lsa yoki huquq bo'lmasa, darhol yangilab olamiz
      if (res.status === 401 || res.status === 403) {
        await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ phone: '+998911000003', password: '+998911000003' }),
        });
        res = await fetch(`/api/v1/restaurants/${restaurantId}/billing/open-bills`, {
          credentials: 'include',
        });
      }

      if (res.ok) {
        const json = await res.json();
        const bills: OpenBillDto[] = json.data || [];
        setOpenBills(bills);
        if (bills.length > 0) {
          setSelectedVisitId((prev) => (prev && bills.some((b) => b.visitId === prev) ? prev : bills[0].visitId));
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // 2. Tanlangan stolning to'liq chek tafsilotini olish
  const fetchDetailedBill = useCallback(
    async (visitId: string) => {
      try {
        let res = await fetch(`/api/v1/restaurants/${restaurantId}/billing/visits/${visitId}`, {
          credentials: 'include',
        });
        if (res.status === 401 || res.status === 403) {
          await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ phone: '+998911000003', password: '+998911000003' }),
          });
          res = await fetch(`/api/v1/restaurants/${restaurantId}/billing/visits/${visitId}`, {
            credentials: 'include',
          });
        }
        if (res.ok) {
          const json = await res.json();
          setDetailedBill(json.data || null);

          const balance = BigInt(json.data?.bill?.balanceTiyin || '0');
          const balanceUzs = (balance / 100n).toString();
          setTenderedCashInput(balanceUzs);

          const halfBalanceUzs = (balance / 200n).toString();
          setSplitCashInput(halfBalanceUzs);
          const remainingCardUzs = (balance / 100n - balance / 200n).toString();
          setSplitCardInput(remainingCardUzs);
        }
      } catch {}
    },
    [restaurantId]
  );

  // Dastlabki yuklash
  useEffect(() => {
    fetchOpenBills();
  }, [fetchOpenBills]);

  // Stol tanlanganda uning hisobini yuklash
  useEffect(() => {
    if (selectedVisitId) {
      fetchDetailedBill(selectedVisitId);
    } else {
      setDetailedBill(null);
    }
  }, [selectedVisitId, fetchDetailedBill]);

  // Jonli yangilanishlar
  const handleRealtimeEvent = useCallback(() => {
    fetchOpenBills();
    if (selectedVisitId) {
      fetchDetailedBill(selectedVisitId);
    }
  }, [fetchOpenBills, selectedVisitId, fetchDetailedBill]);

  useRealtime({
    restaurantId,
    onEvent: () => handleRealtimeEvent(),
  });

  // Dostavka va Takeaway amallari
  const handlePayTakeaway = (orderId: string, method: 'CASH' | 'TERMINAL') => {
    setTakeawayOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          showToast(
            `${ord.orderNumber} uchun ${method === 'CASH' ? 'Naqd pul' : 'Terminal'} to'lovi qabul qilindi!`,
            'success'
          );
          return {
            ...ord,
            paymentStatus: 'PAID',
            paymentMethod: method,
            status: ord.status === 'PREPARING' ? 'READY' : ord.status,
          };
        }
        return ord;
      })
    );
  };

  const handleCompleteTakeaway = (orderId: string) => {
    setTakeawayOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          showToast(`${ord.orderNumber} buyurtmasi topshirildi deb belgilandi!`, 'success');
          return { ...ord, status: 'COMPLETED' };
        }
        return ord;
      })
    );
  };

  const handleDeleteTakeaway = (orderId: string) => {
    setTakeawayOrders((prev) => prev.filter((ord) => ord.id !== orderId));
    showToast("Buyurtma ro'yxatdan o'chirildi", 'warning');
  };

  // Restoran menyusini yuklash (taomlar va toifalar)
  const fetchMenu = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setMenuLoading(true);
      const res = await fetch(`/api/v1/public/restaurants/${restaurantId}/menu?lang=uz`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setMenuCategories(
            (json.data.categories || []).map((c: any) => ({
              id: c.id,
              name: stripParentheses(c.name),
            }))
          );
          setMenuItems(
            (json.data.items || []).map((it: any) => ({
              id: it.id,
              name: stripParentheses(it.name),
              basePriceTiyin: it.basePriceTiyin || '0',
              categoryId: it.categoryId,
              isAvailable: it.isAvailable !== false,
            }))
          );
        }
      }
    } catch {} finally {
      setMenuLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Savatga taom qo'shish va yangilash
  const handleAddDishToBasket = (dish: { id: string; name: string; basePriceTiyin: string }) => {
    const priceUzs = Number(BigInt(dish.basePriceTiyin || '0') / 100n);
    setOrderBasket((prev) => {
      const existing = prev.find((item) => item.dishId === dish.id);
      if (existing) {
        return prev.map((item) =>
          item.dishId === dish.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { dishId: dish.id, name: dish.name, priceUzs, quantity: 1 }];
    });
  };

  const handleUpdateBasketQty = (dishId: string, delta: number) => {
    setOrderBasket((prev) =>
      prev
        .map((item) => {
          if (item.dishId === dishId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as Array<{ dishId: string; name: string; priceUzs: number; quantity: number }>
    );
  };

  const handleRemoveFromBasket = (dishId: string) => {
    setOrderBasket((prev) => prev.filter((item) => item.dishId !== dishId));
  };

  const basketTotalUzs = orderBasket.reduce(
    (sum, item) => sum + item.priceUzs * item.quantity,
    0
  );
  const basketTotalItems = orderBasket.reduce((sum, item) => sum + item.quantity, 0);

  const filteredMenuItems = menuItems.filter((dish) => {
    if (!dish.isAvailable) return false;
    if (selectedCatId !== 'ALL' && dish.categoryId !== selectedCatId) return false;
    if (dishSearch.trim()) {
      return dish.name.toLowerCase().includes(dishSearch.toLowerCase().trim());
    }
    return true;
  });

  const handleSaveTakeawayOrderWithMethod = (method: 'CASH' | 'TERMINAL' | 'UNPAID') => {
    if (orderBasket.length === 0) {
      showToast('Iltimos, kamida bitta taom tanlang', 'warning');
      return;
    }

    const randNum = Math.floor(100 + Math.random() * 900);
    const isPaid = method !== 'UNPAID';
    const newOrd: TakeawayOrder = {
      id: `takeaway-${Date.now()}`,
      orderNumber: `T-${randNum}`,
      customerName: orderNote.trim() || `Olib ketish #${randNum}`,
      phone: '',
      pickupTime: '',
      items: orderBasket.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        priceUzs: it.priceUzs,
      })),
      totalUzs: basketTotalUzs,
      status: 'PREPARING',
      paymentStatus: isPaid ? 'PAID' : 'UNPAID',
      paymentMethod: isPaid ? method : undefined,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setTakeawayOrders((prev) => [newOrd, ...prev]);

    if (method === 'CASH') {
      showToast(`Buyurtma #${newOrd.orderNumber} Naqd to'lovi qabul qilindi!`, 'success');
    } else if (method === 'TERMINAL') {
      showToast(`Buyurtma #${newOrd.orderNumber} Karta to'lovi qabul qilindi!`, 'success');
    } else {
      showToast(`Buyurtma #${newOrd.orderNumber} saqlandi (to'lov kutilmoqda)`, 'success');
    }

    setShowNewTakeawayModal(false);
    setOrderBasket([]);
    setOrderNote('');
    setDishSearch('');
  };

  // Balans
  const balanceTiyin = BigInt(detailedBill?.bill?.balanceTiyin || '0');
  const balanceUzs = balanceTiyin / 100n;

  // Naqd to'lovda qaytim hisobi
  const tenderedCashNumber = BigInt(tenderedCashInput.replace(/\s+/g, '') || '0');
  const calculatedChangeTiyin =
    tenderedCashNumber * 100n > balanceTiyin ? tenderedCashNumber * 100n - balanceTiyin : 0n;

  // Aralash to'lovda qismlarni hisoblash
  const handleSplitCashChange = (val: string) => {
    setSplitCashInput(val);
    const cleanCash = BigInt(val.replace(/\s+/g, '') || '0');
    if (cleanCash <= balanceUzs) {
      const remaining = balanceUzs - cleanCash;
      setSplitCardInput(remaining.toString());
    } else {
      setSplitCardInput('0');
    }
  };

  const handleSplitCardChange = (val: string) => {
    setSplitCardInput(val);
    const cleanCard = BigInt(val.replace(/\s+/g, '') || '0');
    if (cleanCard <= balanceUzs) {
      const remaining = balanceUzs - cleanCard;
      setSplitCashInput(remaining.toString());
    } else {
      setSplitCardInput('0');
    }
  };

  // Bir bosishda to'lov va stolni yopish
  const handleConfirmAndCloseTable = async () => {
    if (!selectedVisitId || !detailedBill) return;

    if (balanceTiyin <= 0n) {
      showToast('Hisob allaqachon to\'liq to\'langan', 'warning');
      return;
    }

    setIsSubmittingPayment(true);

    try {
      if (paymentMode === 'CASH') {
        const tenderedTiyin = tenderedCashNumber * 100n;
        if (tenderedTiyin < balanceTiyin) {
          showToast('Berilgan naqd pul hisob summasidan kam bo\'lmasligi kerak', 'warning');
          setIsSubmittingPayment(false);
          return;
        }

        const payRes = await fetch(`/api/v1/restaurants/${restaurantId}/billing/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            visitId: selectedVisitId,
            method: 'CASH',
            amountTiyin: balanceTiyin.toString(),
            tenderedCashTiyin: tenderedTiyin.toString(),
            changeTiyin: calculatedChangeTiyin.toString(),
            idempotencyKey: crypto.randomUUID(),
          }),
        });
        const payData = await payRes.json();
        if (!payRes.ok || !payData.success) {
          throw new Error(payData.error?.message || 'Naqd to\'lovni yozishda xatolik');
        }
      } else if (paymentMode === 'TERMINAL') {
        const payRes = await fetch(`/api/v1/restaurants/${restaurantId}/billing/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            visitId: selectedVisitId,
            method: 'TERMINAL',
            amountTiyin: balanceTiyin.toString(),
            idempotencyKey: crypto.randomUUID(),
          }),
        });
        const payData = await payRes.json();
        if (!payRes.ok || !payData.success) {
          throw new Error(payData.error?.message || 'Terminal to\'lovini yozishda xatolik');
        }
      } else if (paymentMode === 'SPLIT') {
        const cashPartUzs = BigInt(splitCashInput.replace(/\s+/g, '') || '0');
        const cardPartUzs = BigInt(splitCardInput.replace(/\s+/g, '') || '0');

        if (cashPartUzs + cardPartUzs !== balanceUzs) {
          showToast('Naqd va karta yig\'indisi umumiy hisobga teng bo\'lishi kerak', 'warning');
          setIsSubmittingPayment(false);
          return;
        }

        if (cashPartUzs > 0n) {
          const cashRes = await fetch(`/api/v1/restaurants/${restaurantId}/billing/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              visitId: selectedVisitId,
              method: 'CASH',
              amountTiyin: (cashPartUzs * 100n).toString(),
              tenderedCashTiyin: (cashPartUzs * 100n).toString(),
              changeTiyin: '0',
              idempotencyKey: crypto.randomUUID(),
            }),
          });
          const cData = await cashRes.json();
          if (!cashRes.ok || !cData.success) {
            throw new Error(cData.error?.message || 'Naqd qismini yozishda xatolik');
          }
        }

        if (cardPartUzs > 0n) {
          const cardRes = await fetch(`/api/v1/restaurants/${restaurantId}/billing/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              visitId: selectedVisitId,
              method: 'TERMINAL',
              amountTiyin: (cardPartUzs * 100n).toString(),
              idempotencyKey: crypto.randomUUID(),
            }),
          });
          const cardData = await cardRes.json();
          if (!cardRes.ok || !cardData.success) {
            throw new Error(cardData.error?.message || 'Karta qismini yozishda xatolik');
          }
        }
      }

      // Tashrifni avtomatik yopish
      const closeRes = await fetch(
        `/api/v1/restaurants/${restaurantId}/billing/visits/${selectedVisitId}/close`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        }
      );
      const closeData = await closeRes.json();
      if (!closeRes.ok || !closeData.success) {
        throw new Error(closeData.error?.message || 'Stolni yopishda xatolik');
      }

      showToast(`Stol #${detailedBill.visit.tableNumber} hisobi muvaffaqiyatli yopildi!`, 'success');

      fetchOpenBills();
      setSelectedVisitId(null);
      setDetailedBill(null);
      setMobileStep('tables');
    } catch (err: any) {
      showToast(err.message || 'To\'lov jarayonida xatolik yuz berdi', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const cashierName = authProfile?.user?.fullName || 'Sardor Rustamov';

  return (
    <div className="min-h-screen bg-bg text-ink-main flex flex-col font-sans">
      {/* TOAST XABARNOMA */}
      {toastMessage && (
        <div
          className={`fixed top-16 right-4 z-50 p-4 rounded-xl shadow-lg border text-sm max-w-md flex items-center gap-2 animate-in fade-in slide-in-from-top-4 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : toastMessage.type === 'error'
              ? 'bg-red-50 text-red-900 border-red-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="bg-surface border-b border-line sticky top-0 z-30 shadow-subtle h-14">
        <div className="w-full h-full flex items-center justify-between px-4">
          {/* Chap: Mobil Gamburger va Kassa brendi */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-1.5 rounded-lg border border-line text-ink-main hover:bg-bg transition-colors"
              title="Menyu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center font-bold text-xs text-white shadow-xs">
                KS
              </div>
              <span className="font-extrabold text-ink-main text-sm tracking-tight">
                Kassa Paneli
              </span>
            </div>
          </div>

          {/* O'ng: Tezkor yangilash */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchOpenBills();
                if (selectedVisitId) fetchDetailedBill(selectedVisitId);
              }}
              className="p-1.5 rounded-lg border border-line hover:bg-bg text-ink-secondary hover:text-ink-main transition-colors"
              title="Yangilash"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT: RESTORAN ADMINGA O'XSHAGAN CHAP MENYU BILAN */}
      <div className="flex-1 flex w-full">
        {/* DESKTOP SIDEBAR - CHAP MENYU */}
        <aside className="w-64 shrink-0 hidden md:flex flex-col justify-between sticky top-14 h-[calc(100vh-3.5rem)] bg-surface border-r border-line p-3 z-20 overflow-y-auto">
          <div className="space-y-4">
            {/* 1. ASOSIY KASSA MENYUSI */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider px-2 pb-0.5">
                Kassa Bo'limlari
              </div>

              {/* Kutilayotgan to'lovlar */}
              <button
                type="button"
                onClick={() => setActiveTab('open_bills')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold text-xs transition-all outline-none focus:outline-none focus:ring-0 select-none ${
                  activeTab === 'open_bills'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-ink-secondary hover:text-ink-main hover:bg-bg'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Receipt className="w-4 h-4" />
                  <span>Kutilayotgan to'lovlar</span>
                </div>
                {openBills.length > 0 && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                      activeTab === 'open_bills'
                        ? 'bg-white text-emerald-900 shadow-xs'
                        : 'bg-brand-100 text-brand'
                    }`}
                  >
                    {openBills.length}
                  </span>
                )}
              </button>

              {/* Olib ketish */}
              <button
                type="button"
                onClick={() => setActiveTab('takeaway')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all outline-none focus:outline-none focus:ring-0 select-none ${
                  activeTab === 'takeaway'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-ink-secondary hover:text-ink-main hover:bg-bg'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Olib ketish</span>
              </button>
            </div>
          </div>

          {/* Sidebar pastki qismi: Kassir ismi */}
          <div className="pt-3 border-t border-line space-y-2 mt-4">
            <div className="px-3 py-2 bg-bg rounded-xl border border-line text-xs">
              <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider block">
                Kassir
              </span>
              <span className="font-bold text-ink-main truncate block mt-0.5">
                {stripParentheses(cashierName)}
              </span>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold border border-rose-200 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Chiqish</span>
              </button>
            )}
          </div>
        </aside>

        {/* MOBIL SIDEBAR DRAWER */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex overscroll-contain">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative w-64 max-w-[80vw] bg-surface h-full shadow-2xl border-r border-line p-4 flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <span className="font-extrabold text-sm text-ink-main">Kassa Menyusi</span>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1 rounded-lg text-ink-secondary hover:bg-bg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobil Kassa Bo'limlari */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider px-2 pb-0.5">
                    Kassa Bo'limlari
                  </div>

                  <button
                    onClick={() => {
                      setActiveTab('open_bills');
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold text-xs transition-all outline-none focus:outline-none focus:ring-0 select-none ${
                      activeTab === 'open_bills'
                        ? 'bg-brand text-white'
                        : 'text-ink-secondary hover:text-ink-main hover:bg-bg'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Receipt className="w-4 h-4" />
                      <span>Kutilayotgan to'lovlar</span>
                    </div>
                    {openBills.length > 0 && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                          activeTab === 'open_bills'
                            ? 'bg-white text-emerald-900 shadow-xs'
                            : 'bg-brand-100 text-brand'
                        }`}
                      >
                        {openBills.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('takeaway');
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all outline-none focus:outline-none focus:ring-0 select-none ${
                      activeTab === 'takeaway'
                        ? 'bg-brand text-white'
                        : 'text-ink-secondary hover:text-ink-main hover:bg-bg'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Olib ketish</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-line space-y-2">
                <div className="px-3 py-2 bg-bg rounded-xl border border-line text-xs">
                  <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider block">
                    Kassir
                  </span>
                  <span className="font-bold text-ink-main truncate block mt-0.5">
                    {stripParentheses(cashierName)}
                  </span>
                </div>

                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold border border-rose-200 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Chiqish</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ASOSIY ISH MAYDONI: KUTILAYOTGAN TO'LOVLAR YOKI DOSTAVKA/OLIB KETISH */}
        <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 overflow-y-auto">
          {activeTab === 'open_bills' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* CHAP USTUN: VERTIKAL KUTILAYOTGAN TO'LOVLAR KARTALARI */}
            <section
              className={`lg:col-span-7 flex flex-col bg-surface rounded-2xl border border-line shadow-subtle overflow-hidden ${
                mobileStep === 'checkout' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Kutilayotgan to'lovlar sarlavhasi */}
              <div className="px-4 py-3.5 border-b border-line flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink-main tracking-tight">
                  Kutilayotgan to'lovlar
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-100 text-brand">
                  {openBills.length} ta hisob
                </span>
              </div>

              {/* Stollar kartochkalari - Vertikal ro'yxat */}
              <div className="p-3.5 sm:p-4">
                {loading && openBills.length === 0 ? (
                  <div className="py-12 text-center text-ink-muted text-xs">
                    Hisoblar yuklanmoqda...
                  </div>
                ) : openBills.length === 0 ? (
                  <div className="py-12 text-center text-ink-muted text-xs space-y-1">
                    <p className="font-semibold text-ink-main text-sm">Hozircha kutilayotgan to'lovlar mavjud emas</p>
                    <p className="text-ink-muted">
                      Zaldagi stollarga hisob so'ralganda yoki buyurtma berilganda bu yerda paydo bo'ladi
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {openBills.map((b) => {
                      const isSelected = selectedVisitId === b.visitId;
                      const balance = BigInt(b.bill.balanceTiyin);
                      return (
                        <div
                          key={b.visitId}
                          onClick={() => {
                            setSelectedVisitId(b.visitId);
                            setMobileStep('checkout');
                          }}
                          className={`cursor-pointer p-4 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                            isSelected
                              ? 'bg-brand-50/50 border-brand ring-2 ring-brand/20 shadow-sm'
                              : 'bg-surface hover:bg-bg border-line hover:border-brand/40 shadow-subtle'
                          }`}
                        >
                          {/* 1. Yuqori qator: Stol raqami, Mas'ul ofitsiant va Vaqt */}
                          <div className="w-full flex items-center justify-between pb-2.5 border-b border-line/60">
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black text-ink-main tracking-tight">
                                Stol #{b.tableNumber}
                              </span>
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand text-white shadow-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                  Tanlangan
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-bg text-ink-muted border border-line">
                                  To'lov kutilmoqda
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs">
                              <div className="flex items-center gap-1.5 bg-bg px-2.5 py-1 rounded-lg border border-line/50">
                                <User className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                                <span className="font-bold text-ink-main text-[11px]">
                                  {stripParentheses(b.waiterName) || 'Biriktirilmagan'}
                                </span>
                              </div>
                              {b.openedAt && (
                                <span className="text-[11px] text-ink-muted hidden sm:inline font-mono">
                                  {new Date(b.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 2. O'rta qism: Buyurtma qilingan taomlar ro'yxati */}
                          <div className="w-full my-2.5 bg-bg/60 rounded-xl p-3 space-y-1.5 border border-line/50">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
                              Buyurtma qilingan taomlar ({b.items?.length || b.itemCount} ta):
                            </span>
                            {b.items && b.items.length > 0 ? (
                              <div className="space-y-1 divide-y divide-line/40">
                                {b.items.map((it, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-xs pt-1 first:pt-0">
                                    <span className="text-ink-main font-semibold">
                                      • {stripParentheses(it.name)} <span className="text-brand font-bold text-[11px]">× {it.quantity}</span>
                                    </span>
                                    <span className="text-ink-secondary font-bold text-[11px]">
                                      {formatMoneyUzs(BigInt(it.priceTiyin) * BigInt(it.quantity))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-ink-muted italic">Buyurtmalar kutilmoqda...</p>
                            )}
                          </div>

                          {/* 3. Pastki qator: Jami summa va Harakat tugmasi */}
                          <div className="w-full pt-2.5 flex items-center justify-between border-t border-line/60">
                            <div>
                              <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider block">
                                Jami to'lov summasi
                              </span>
                              <span className="text-base font-black text-brand">
                                {formatMoneyUzs(balance)}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVisitId(b.visitId);
                                setMobileStep('checkout');
                              }}
                              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                                isSelected
                                  ? 'bg-brand text-white shadow-xs'
                                  : 'bg-brand-50 text-brand hover:bg-brand-100 border border-brand-200'
                              }`}
                            >
                              <span>{isSelected ? 'To\'lov oynasi ochiq' : 'To\'lovni qabul qilish'}</span>
                              <span>→</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* O'NG USTUN: CHEK VA TO'LOV PANELI */}
            <section
              className={`lg:col-span-5 flex flex-col bg-surface rounded-2xl border border-line shadow-subtle overflow-hidden ${
                mobileStep === 'tables' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Mobil orqaga qaytish tugmasi */}
              <div className="lg:hidden p-2.5 bg-bg border-b border-line flex items-center justify-between">
                <button
                  onClick={() => setMobileStep('tables')}
                  className="text-xs font-bold text-ink-main flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-line"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>To'lovlarga qaytish</span>
                </button>
              </div>

              {!detailedBill ? (
                <div className="p-10 text-center text-ink-muted space-y-2">
                  <Receipt className="w-8 h-8 text-brand-300 mx-auto" />
                  <p className="font-semibold text-ink-main text-xs">
                    To'lovni qabul qilish uchun hisobni tanlang
                  </p>
                  <p className="text-[11px] text-ink-secondary">
                    Chap tomondan kutilayotgan stol hisobini bosing
                  </p>
                </div>
              ) : (
                <div className="flex flex-col h-full divide-y divide-line">
                  {/* 1. Stol va ofitsiant */}
                  <div className="px-4 py-3 bg-bg/50">
                    <h3 className="text-base font-black text-ink-main tracking-tight">
                      Stol #{detailedBill.visit.tableNumber} hisobi
                    </h3>
                    <p className="text-[11px] text-ink-secondary mt-0.5">
                      Mas'ul:{' '}
                      <strong className="text-ink-main">
                        {stripParentheses(openBills.find((b) => b.visitId === detailedBill.visit.id)?.waiterName) || 'Biriktirilmagan'}
                      </strong>
                    </p>
                  </div>

                  {/* 2. Taomlar ro'yxati */}
                  <div className="p-3.5 max-h-48 overflow-y-auto space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
                      Buyurtma qilingan taomlar
                    </span>

                    {detailedBill.orders.flatMap((o) => o.items).length === 0 ? (
                      <p className="text-xs text-ink-muted italic">Buyurtmalar mavjud emas</p>
                    ) : (
                      detailedBill.orders.flatMap((o) => o.items).map((item, idx) => {
                        const itemTotal = BigInt(item.snapshotPriceTiyin) * BigInt(item.quantity);
                        return (
                          <div
                            key={item.id || idx}
                            className="flex items-center justify-between text-xs py-1 border-b border-line/40 last:border-0"
                          >
                            <div className="pr-2">
                              <span className="font-semibold text-ink-main block">
                                {stripParentheses(item.snapshotName || item.dishTitle)}
                              </span>
                              <span className="text-[10px] text-ink-muted">
                                {item.quantity} dona × {formatMoneyUzs(BigInt(item.snapshotPriceTiyin))}
                              </span>
                            </div>
                            <span className="font-bold text-ink-main shrink-0">
                              {formatMoneyUzs(itemTotal)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* 3. Moliyaviy jami hisob */}
                  <div className="px-4 py-3 bg-bg/30 space-y-1.5 text-xs">
                    <div className="flex justify-between text-ink-secondary">
                      <span>Taomlar summasi</span>
                      <span className="font-semibold text-ink-main">
                        {formatMoneyUzs(BigInt(detailedBill.bill.subtotalTiyin))}
                      </span>
                    </div>

                    <div className="flex justify-between text-ink-secondary">
                      <span>Xizmat haqi {detailedBill.bill.serviceChargeBps / 100}%</span>
                      <span className="font-semibold text-ink-main">
                        {formatMoneyUzs(BigInt(detailedBill.bill.serviceChargeTiyin))}
                      </span>
                    </div>

                    {BigInt(detailedBill.bill.discountTiyin) > 0n && (
                      <div className="flex justify-between text-brand">
                        <span>Chegirma</span>
                        <span className="font-semibold">
                          -{formatMoneyUzs(BigInt(detailedBill.bill.discountTiyin))}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-line flex justify-between items-baseline">
                      <span className="text-xs font-black text-ink-main">Jami to'lanishi kerak</span>
                      <span className="text-base font-black text-brand">
                        {formatMoneyUzs(balanceTiyin)}
                      </span>
                    </div>
                  </div>

                  {/* 4. To'lov usullari */}
                  <div className="p-3.5 space-y-3">
                    <div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMode('CASH')}
                          className={`py-2 px-1.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                            paymentMode === 'CASH'
                              ? 'border-brand bg-brand-50 text-brand ring-2 ring-brand/20 shadow-xs'
                              : 'border-line text-ink-main bg-surface hover:bg-bg'
                          }`}
                        >
                          <Banknote className="w-4 h-4" />
                          <span>Naqd pul</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMode('TERMINAL')}
                          className={`py-2 px-1.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                            paymentMode === 'TERMINAL'
                              ? 'border-brand bg-brand-50 text-brand ring-2 ring-brand/20 shadow-xs'
                              : 'border-line text-ink-main bg-surface hover:bg-bg'
                          }`}
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Plastik karta</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMode('SPLIT')}
                          className={`py-2 px-1.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                            paymentMode === 'SPLIT'
                              ? 'border-brand bg-brand-50 text-brand ring-2 ring-brand/20 shadow-xs'
                              : 'border-line text-ink-main bg-surface hover:bg-bg'
                          }`}
                        >
                          <Receipt className="w-4 h-4" />
                          <span>Aralash</span>
                        </button>
                      </div>
                    </div>

                    {/* Naqd pul kalkulyatori */}
                    {paymentMode === 'CASH' && (
                      <div className="space-y-2.5 bg-bg/50 p-3 rounded-xl border border-line">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[11px] font-semibold text-ink-main">
                              Berilgan naqd pul
                            </label>
                            <button
                              type="button"
                              onClick={() => setTenderedCashInput(balanceUzs.toString())}
                              className="text-[10px] font-bold text-brand hover:underline"
                            >
                              Aynan {formatMoneyUzs(balanceTiyin)}
                            </button>
                          </div>
                          <input
                            type="text"
                            value={tenderedCashInput}
                            onChange={(e) => setTenderedCashInput(e.target.value)}
                            placeholder="Summani kiriting..."
                            className="w-full px-3 py-1.5 text-xs bg-surface rounded-lg border border-line text-ink-main font-bold focus:outline-none focus:ring-2 focus:ring-brand"
                          />
                        </div>

                        {/* Tezkor kupyuralar */}
                        <div className="flex flex-wrap gap-1">
                          {[50000, 100000, 200000, 300000, 500000].map((nominal) => (
                            <button
                              key={nominal}
                              type="button"
                              onClick={() => setTenderedCashInput(nominal.toString())}
                              className="px-2 py-0.5 text-[10px] font-bold bg-surface hover:bg-brand-50 border border-line text-ink-main hover:text-brand rounded-md transition-colors"
                            >
                              {nominal.toLocaleString('ru-RU')}
                            </button>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-line flex items-center justify-between">
                          <span className="text-[11px] font-bold text-ink-main">Qaytim</span>
                          <span className="text-xs font-black text-brand">
                            {formatMoneyUzs(calculatedChangeTiyin)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Terminal to'lovi */}
                    {paymentMode === 'TERMINAL' && (
                      <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-center space-y-0.5">
                        <CreditCard className="w-5 h-5 text-brand mx-auto mb-1" />
                        <p className="text-sm font-black text-brand-900">
                          {formatMoneyUzs(balanceTiyin)}
                        </p>
                        <p className="text-[11px] text-brand-700 font-semibold">
                          Terminal orqali to'lov
                        </p>
                      </div>
                    )}

                    {/* Aralash to'lov */}
                    {paymentMode === 'SPLIT' && (
                      <div className="space-y-2.5 bg-bg/50 p-3 rounded-xl border border-line">
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] text-ink-secondary block mb-0.5">
                              Naqd pul qismi
                            </label>
                            <input
                              type="text"
                              value={splitCashInput}
                              onChange={(e) => handleSplitCashChange(e.target.value)}
                              placeholder="Naqd summa..."
                              className="w-full px-2.5 py-1 text-xs bg-surface rounded-lg border border-line text-ink-main font-bold focus:outline-none focus:ring-2 focus:ring-brand"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-ink-secondary block mb-0.5">
                              Karta qismi
                            </label>
                            <input
                              type="text"
                              value={splitCardInput}
                              onChange={(e) => handleSplitCardChange(e.target.value)}
                              placeholder="Karta summasi..."
                              className="w-full px-2.5 py-1 text-xs bg-surface rounded-lg border border-line text-ink-main font-bold focus:outline-none focus:ring-2 focus:ring-brand"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tasdiqlash tugmasi */}
                    <Button
                      variant="primary"
                      size="lg"
                      disabled={isSubmittingPayment}
                      onClick={handleConfirmAndCloseTable}
                      className="w-full bg-brand hover:bg-brand-hover text-white font-bold text-xs h-11 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
                    >
                      {isSubmittingPayment ? (
                        <span>To'lov yozilmoqda...</span>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>To'lovni tasdiqlash va stolni yopish</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : (
          /* SOF OLIB KETISH REJIMI */
          <div className="space-y-4">
            {/* Sarlavha paneli va Yangi buyurtma */}
            <div className="bg-surface rounded-2xl border border-line p-4 shadow-subtle flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-50 rounded-xl text-brand border border-brand-200 shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-ink-main tracking-tight">
                    Olib ketish
                  </h1>
                </div>
              </div>

              <button
                onClick={() => setShowNewTakeawayModal(true)}
                className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs shadow-xs transition-colors outline-none focus:outline-none"
              >
                <Plus className="w-4 h-4" />
                <span>Yangi buyurtma</span>
              </button>
            </div>

            {/* Buyurtmalar ro'yxati */}
            {takeawayOrders.length === 0 ? (
              <div className="bg-surface rounded-2xl border border-line p-12 text-center text-xs text-ink-muted space-y-2">
                <ShoppingBag className="w-8 h-8 text-ink-muted mx-auto stroke-1" />
                <p className="font-bold text-ink-main text-sm">Olib ketish buyurtmalari yo'q</p>
                <p>Yangi buyurtma kiritish uchun yuqoridagi "+ Yangi buyurtma" tugmasini bosing</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {takeawayOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className={`bg-surface rounded-2xl border p-4 shadow-subtle flex flex-col justify-between space-y-3 transition-all ${
                      ord.status === 'COMPLETED'
                        ? 'opacity-60 border-line bg-surface/50'
                        : ord.paymentStatus === 'UNPAID'
                        ? 'border-amber-300'
                        : 'border-emerald-300'
                    }`}
                  >
                    {/* Yuqori qism: Raqam, vaqt va O'chirish */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-ink-main bg-bg px-2 py-0.5 rounded-lg border border-line">
                          #{ord.orderNumber}
                        </span>
                        <span className="text-[11px] text-ink-muted">{ord.createdAt}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {ord.paymentStatus === 'PAID' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            To'langan ({ord.paymentMethod === 'TERMINAL' ? 'Karta' : 'Naqd'})
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            To'lanmagan
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteTakeaway(ord.id)}
                          title="O'chirish"
                          className="p-1 text-ink-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Mijoz ma'lumotlari */}
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-ink-main text-sm flex items-center justify-between">
                        <span>{ord.customerName}</span>
                        {ord.phone && ord.phone !== '+998' && (
                          <span className="font-mono text-ink-secondary text-xs">{ord.phone}</span>
                        )}
                      </div>
                      {ord.pickupTime && (
                        <div className="text-ink-muted text-[11px] truncate">
                          {ord.pickupTime}
                        </div>
                      )}
                    </div>

                    {/* Taomlar (agar bor bo'lsa) */}
                    {ord.items && ord.items.length > 0 && (
                      <div className="bg-bg rounded-xl p-2.5 border border-line text-xs space-y-1">
                        {ord.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-ink-secondary text-[11px]">
                            <span>
                              {it.quantity}x {it.name}
                            </span>
                            <span className="font-mono text-ink-main font-semibold">
                              {formatMoneyUzs(BigInt(it.priceUzs * 100))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Summa va to'lov tugmalari */}
                    <div className="pt-2 border-t border-line space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-ink-secondary">Jami:</span>
                        <span className="text-brand font-mono text-sm">
                          {formatMoneyUzs(BigInt(ord.totalUzs * 100))}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        {ord.paymentStatus === 'UNPAID' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handlePayTakeaway(ord.id, 'CASH')}
                              className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors outline-none focus:outline-none"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>Naqd</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePayTakeaway(ord.id, 'TERMINAL')}
                              className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors outline-none focus:outline-none"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Karta</span>
                            </button>
                          </>
                        ) : ord.status !== 'COMPLETED' ? (
                          <button
                            type="button"
                            onClick={() => handleCompleteTakeaway(ord.id)}
                            className="w-full py-1.5 px-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors outline-none focus:outline-none"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Topshirildi</span>
                          </button>
                        ) : (
                          <span className="w-full py-1 text-center text-ink-muted text-xs font-semibold">
                            Topshirilgan
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>

    {/* YANGI BUYURTMA MODALI (TAOM TANLASH) */}
    {showNewTakeawayModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-surface w-full max-w-5xl h-[92vh] max-h-[850px] flex flex-col rounded-2xl border border-line shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
          {/* Modal sarlavhasi */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-line bg-surface shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-brand-50 rounded-xl text-brand">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-ink-main text-sm sm:text-base">
                  Yangi buyurtma — Taom tanlash
                </h3>
                <p className="text-[11px] text-ink-secondary">
                  Kerakli taomlarni bosing, buyurtma avtomatik shakllanadi
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowNewTakeawayModal(false);
                setOrderBasket([]);
                setDishSearch('');
              }}
              className="p-1.5 text-ink-secondary hover:text-ink-main rounded-xl hover:bg-bg transition-colors outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal asosiy tanasi: 2 ustun (desktopda yonma-yon) */}
          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
            {/* CHAP USTUN: Taomlar katalogi va qidiruv (58% kenglik) */}
            <div className="w-full md:w-[58%] flex flex-col border-b md:border-b-0 md:border-r border-line p-3 sm:p-4 min-h-[320px] md:min-h-0 overflow-hidden bg-bg/30 shrink-0 md:shrink">
              {/* Qidiruv */}
              <div className="relative mb-2.5 shrink-0">
                <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  placeholder="Taom nomini qidirish..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-surface rounded-xl border border-line text-ink-main focus:outline-none focus:ring-2 focus:ring-brand font-medium placeholder:text-ink-muted"
                />
                {dishSearch && (
                  <button
                    type="button"
                    onClick={() => setDishSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-main"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Toifalar tugmalari */}
              {menuCategories.length > 0 && (
                <div
                  className="flex items-center gap-1.5 overflow-x-auto pb-1.5 mb-2 shrink-0 select-none"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCatId('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all select-none ${
                      selectedCatId === 'ALL'
                        ? 'bg-brand text-white shadow-2xs'
                        : 'bg-surface text-ink-secondary hover:text-ink-main border border-line'
                    }`}
                  >
                    Barchasi ({menuItems.length})
                  </button>
                  {menuCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCatId(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all select-none ${
                        selectedCatId === cat.id
                          ? 'bg-brand text-white shadow-2xs'
                          : 'bg-surface text-ink-secondary hover:text-ink-main border border-line'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Taomlar ro'yxati (Grid) */}
              <div className="flex-1 overflow-y-auto pr-1">
                {menuLoading ? (
                  <div className="h-48 flex items-center justify-center text-xs text-ink-muted">
                    Menyu yuklanmoqda...
                  </div>
                ) : filteredMenuItems.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-xs text-ink-muted text-center p-4">
                    <p className="font-semibold text-ink-main">Taom topilmadi</p>
                    <p className="text-[11px] mt-1">Boshqa nom bilan qidirib ko'ring</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredMenuItems.map((dish) => {
                      const inBasket = orderBasket.find((b) => b.dishId === dish.id);
                      const priceUzs = Number(BigInt(dish.basePriceTiyin || '0') / 100n);
                      return (
                        <button
                          key={dish.id}
                          type="button"
                          onClick={() => handleAddDishToBasket(dish)}
                          className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all select-none active:scale-[0.98] ${
                            inBasket
                              ? 'bg-brand-50/70 border-brand shadow-2xs ring-1 ring-brand/30'
                              : 'bg-surface border-line hover:border-brand/50 hover:shadow-2xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1 w-full">
                            <span className="font-bold text-xs text-ink-main line-clamp-2 leading-snug">
                              {dish.name}
                            </span>
                            {inBasket && (
                              <span className="shrink-0 bg-brand text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                                {inBasket.quantity}
                              </span>
                            )}
                          </div>
                          <div className="mt-2.5 flex items-center justify-between w-full">
                            <span className="font-mono text-brand font-bold text-xs">
                              {formatMoneyUzs(BigInt(priceUzs * 100))}
                            </span>
                            <span className="text-[10px] font-bold text-brand bg-brand-50 px-1.5 py-0.5 rounded-md">
                              + Qo'shish
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* O'NG USTUN: Tanlangan taomlar, jami summa va to'lov (42% kenglik) */}
            <div className="w-full md:w-[42%] flex flex-col p-3 sm:p-4 bg-surface min-h-[320px] md:min-h-0 overflow-hidden shrink-0 md:shrink">
              <div className="flex items-center justify-between pb-2.5 border-b border-line mb-2.5 shrink-0">
                <span className="font-bold text-xs text-ink-main flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-brand" />
                  <span>Tanlangan taomlar</span>
                </span>
                {basketTotalItems > 0 && (
                  <span className="text-[11px] font-bold text-brand bg-brand-50 px-2 py-0.5 rounded-full">
                    {basketTotalItems} ta taom
                  </span>
                )}
              </div>

              {/* Savatdagi taomlar ro'yxati */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[120px] max-h-[260px] md:max-h-none">
                {orderBasket.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-ink-muted">
                    <ShoppingBag className="w-8 h-8 stroke-1 text-ink-muted mb-2 opacity-40" />
                    <p className="text-xs font-semibold text-ink-secondary">Hozircha taom tanlanmadi</p>
                    <p className="text-[11px] mt-0.5 text-ink-muted">
                      Chap tomondan kerakli taomni ustiga bosing
                    </p>
                  </div>
                ) : (
                  orderBasket.map((item) => (
                    <div
                      key={item.dishId}
                      className="flex items-center justify-between p-2 rounded-xl bg-bg border border-line text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-bold text-ink-main truncate text-xs">{item.name}</p>
                        <p className="text-[11px] font-mono text-brand font-semibold mt-0.5">
                          {formatMoneyUzs(BigInt(item.priceUzs * 100))}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 select-none">
                        <button
                          type="button"
                          onClick={() => handleUpdateBasketQty(item.dishId, -1)}
                          className="w-6 h-6 rounded-lg bg-surface border border-line text-ink-main flex items-center justify-center font-bold text-xs hover:bg-line active:scale-95 transition-all"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-bold text-xs font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateBasketQty(item.dishId, 1)}
                          className="w-6 h-6 rounded-lg bg-surface border border-line text-ink-main flex items-center justify-center font-bold text-xs hover:bg-line active:scale-95 transition-all"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromBasket(item.dishId)}
                          className="p-1 text-ink-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors ml-0.5"
                          title="O'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pastki qism: Izoh, Jami summa va TO'LOV TURLARI */}
              <div className="pt-3 border-t border-line space-y-2.5 mt-auto shrink-0">
                <div>
                  <input
                    type="text"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Mijoz ismi yoki izoh (ixtiyoriy)..."
                    className="w-full px-3 py-1.5 text-xs bg-bg rounded-xl border border-line text-ink-main focus:outline-none focus:ring-2 focus:ring-brand font-medium placeholder:text-ink-muted"
                  />
                </div>

                <div className="flex items-center justify-between font-bold text-xs px-1">
                  <span className="text-ink-secondary">Jami to'lov:</span>
                  <span className="text-brand font-mono text-base sm:text-lg font-extrabold">
                    {formatMoneyUzs(BigInt(basketTotalUzs * 100))}
                  </span>
                </div>

                {/* TO'LOVNI QABUL QILISH TUGMALARI */}
                <div className="space-y-1.5 pt-0.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={orderBasket.length === 0}
                      onClick={() => handleSaveTakeawayOrderWithMethod('CASH')}
                      className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all disabled:opacity-40 disabled:cursor-not-allowed select-none"
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Naqd to'landi</span>
                    </button>
                    <button
                      type="button"
                      disabled={orderBasket.length === 0}
                      onClick={() => handleSaveTakeawayOrderWithMethod('TERMINAL')}
                      className="py-2.5 px-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all disabled:opacity-40 disabled:cursor-not-allowed select-none"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Karta to'landi</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewTakeawayModal(false);
                        setOrderBasket([]);
                        setDishSearch('');
                      }}
                      className="w-1/3 py-2 rounded-xl border border-line text-xs font-semibold text-ink-secondary hover:bg-bg outline-none transition-colors"
                    >
                      Bekor qilish
                    </button>
                    <button
                      type="button"
                      disabled={orderBasket.length === 0}
                      onClick={() => handleSaveTakeawayOrderWithMethod('UNPAID')}
                      className="w-2/3 py-2 rounded-xl bg-surface border border-line hover:border-amber-400 hover:bg-amber-50/50 text-ink-main font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 select-none"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Keyin to'laydi</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);
};
