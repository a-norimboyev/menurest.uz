import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard,
  Banknote,
  Receipt,
  User,
  Clock,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  AlertTriangle,
  Printer,
  RefreshCw,
  Search,
  BadgeAlert,
  ArrowDownCircle,
  ArrowUpCircle,
  Coins,
  QrCode,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { Money } from '../components/ui/Money.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { Input } from '../components/ui/Input.tsx';
import { useRealtime } from '../hooks/useRealtime.ts';
import { ConnectionBanner, RealtimeIndicatorPill } from '../components/ui/ConnectionBanner.tsx';
import { UzPaymentQr } from '../components/payment/UzPaymentQr.tsx';
import { formatMoneyUzs } from '@menurest/shared';

interface OpenBillDto {
  visitId: string;
  tableId: string;
  tableNumber: number;
  waiterName: string | null;
  openedAt: string;
  itemCount: number;
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
      dishId: string;
      dishTitle: string;
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

interface ShiftSummaryDto {
  shift: {
    id: string;
    restaurantId: string;
    userId: string;
    status: 'OPEN' | 'CLOSED';
    openedAt: string;
    closedAt?: string | null;
    startingCashTiyin: string;
    countedCashTiyin?: string | null;
    differenceTiyin?: string | null;
    expectedCashTiyin?: string | null;
  };
  metrics: {
    cashReceiptsTiyin: string;
    terminalReceiptsTiyin: string;
    cashRefundsTiyin: string;
    terminalRefundsTiyin: string;
    cashReversalsTiyin: string;
    cashInTiyin: string;
    cashOutTiyin: string;
    expectedCashTiyin: string;
  };
}

interface CashierViewProps {
  restaurantId?: string;
  authProfile?: any;
}

export const CashierView: React.FC<CashierViewProps> = ({
  restaurantId: propRestId,
  authProfile,
}) => {
  const [restaurantId, setRestaurantId] = useState(
    authProfile?.activeRestaurant?.slug || authProfile?.activeRestaurant?.id || propRestId || 'rayhon-chilonzor'
  );

  useEffect(() => {
    if (authProfile?.activeRestaurant?.slug || authProfile?.activeRestaurant?.id) {
      setRestaurantId(authProfile.activeRestaurant.slug || authProfile.activeRestaurant.id);
    }
  }, [authProfile]);

  // State
  const [openBills, setOpenBills] = useState<OpenBillDto[]>([]);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [detailedBill, setDetailedBill] = useState<DetailedBillResponse | null>(null);
  const [currentShift, setCurrentShift] = useState<ShiftSummaryDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileStep, setMobileStep] = useState<'list' | 'detail' | 'pay'>('list');

  // Payment Form State
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TERMINAL' | 'QR'>('CASH');
  const [customAmountUzs, setCustomAmountUzs] = useState<string>('');
  const [tenderedCashUzs, setTenderedCashUzs] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Modals
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [closeShiftModal, setCloseShiftModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [cashMovementModal, setCashMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN');
  const [movementAmountInput, setMovementAmountInput] = useState('');
  const [movementReasonInput, setMovementReasonInput] = useState('');
  const [preCheckModal, setPreCheckModal] = useState(false);
  const [reversePaymentModal, setReversePaymentModal] = useState(false);
  const [paymentToReverse, setPaymentToReverse] = useState<string | null>(null);
  const [reverseReasonInput, setReverseReasonInput] = useState('');
  const [refundModal, setRefundModal] = useState(false);
  const [paymentToRefund, setPaymentToRefund] = useState<{ id: string; maxAmountTiyin: string } | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundReasonInput, setRefundReasonInput] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Show Toast
  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch Current Shift
  const fetchCurrentShift = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/shifts/current`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setCurrentShift(json.data || null);
      }
    } catch {
      // Tarmoq xatosi
    }
  }, [restaurantId]);

  // 2. Fetch Open Bills
  const fetchOpenBills = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/billing/open-bills`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        const bills: OpenBillDto[] = json.data || [];
        setOpenBills(bills);
        if (bills.length > 0 && !selectedVisitId) {
          setSelectedVisitId(bills[0].visitId);
        }
      }
    } catch {
      // Tarmoq xatosi
    } finally {
      setLoading(false);
    }
  }, [restaurantId, selectedVisitId]);

  // 3. Fetch Selected Visit Detail
  const fetchDetailedBill = useCallback(
    async (visitId: string) => {
      try {
        const res = await fetch(`/api/v1/restaurants/${restaurantId}/billing/visits/${visitId}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          setDetailedBill(json.data);
          // Set default custom amount to balance (or 0 if negative)
          const balance = BigInt(json.data.bill.balanceTiyin);
          if (balance > 0n) {
            setCustomAmountUzs((balance / 100n).toString());
            setTenderedCashUzs((balance / 100n).toString());
          } else {
            setCustomAmountUzs('0');
            setTenderedCashUzs('0');
          }
        }
      } catch {
        // Tarmoq xatosi
      }
    },
    [restaurantId]
  );

  // Initial load
  useEffect(() => {
    fetchCurrentShift();
    fetchOpenBills();
  }, [fetchCurrentShift, fetchOpenBills]);

  // When selected visit changes, fetch detailed bill
  useEffect(() => {
    if (selectedVisitId) {
      fetchDetailedBill(selectedVisitId);
    } else {
      setDetailedBill(null);
    }
  }, [selectedVisitId, fetchDetailedBill]);

  // Realtime updates (SSE)
  const { status, soundEnabled, toggleSound } = useRealtime({
    restaurantId,
    onReconnect: () => {
      fetchCurrentShift();
      fetchOpenBills();
      if (selectedVisitId) fetchDetailedBill(selectedVisitId);
    },
    onEvent: () => {
      fetchCurrentShift();
      fetchOpenBills();
      if (selectedVisitId) fetchDetailedBill(selectedVisitId);
    },
  });

  // Filtered bills
  const filteredBills = useMemo(() => {
    if (!searchQuery.trim()) return openBills;
    const q = searchQuery.toLowerCase().trim();
    return openBills.filter(
      (b) =>
        b.tableNumber.toString().includes(q) ||
        (b.waiterName && b.waiterName.toLowerCase().includes(q))
    );
  }, [openBills, searchQuery]);

  // Amount parsing helper
  const parsedCustomAmountTiyin = useMemo(() => {
    try {
      const clean = customAmountUzs.replace(/\s+/g, '');
      const num = BigInt(clean || '0');
      return num * 100n;
    } catch {
      return 0n;
    }
  }, [customAmountUzs]);

  const parsedTenderedCashTiyin = useMemo(() => {
    try {
      const clean = tenderedCashUzs.replace(/\s+/g, '');
      const num = BigInt(clean || '0');
      return num * 100n;
    } catch {
      return 0n;
    }
  }, [tenderedCashUzs]);

  // Change (Qaytim) calculation
  const calculatedChangeTiyin = useMemo(() => {
    if (paymentMethod !== 'CASH') return 0n;
    if (parsedTenderedCashTiyin > parsedCustomAmountTiyin) {
      return parsedTenderedCashTiyin - parsedCustomAmountTiyin;
    }
    return 0n;
  }, [paymentMethod, parsedTenderedCashTiyin, parsedCustomAmountTiyin]);

  // Action: Open Shift
  const handleOpenShift = async () => {
    try {
      const startingCash = BigInt(openingCashInput.replace(/\s+/g, '') || '0') * 100n;
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/shifts/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ startingCashTiyin: startingCash.toString() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Kassa smenasi muvaffaqiyatli ochildi!', 'success');
        setOpenShiftModal(false);
        setOpeningCashInput('');
        fetchCurrentShift();
      } else {
        showToast(data.error?.message || 'Smenani ochishda xatolik', 'error');
      }
    } catch {
      showToast('Tarmoq xatosi', 'error');
    }
  };

  // Action: Close Shift
  const handleCloseShift = async () => {
    if (!currentShift) return;
    try {
      const countedCash = BigInt(countedCashInput.replace(/\s+/g, '') || '0') * 100n;
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/shifts/${currentShift.shift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ countedCashTiyin: countedCash.toString() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Kassa smenasi muvaffaqiyatli yopildi va hisobot saqlandi!', 'success');
        setCloseShiftModal(false);
        setCountedCashInput('');
        fetchCurrentShift();
      } else {
        showToast(data.error?.message || 'Smenani yopishda xatolik', 'error');
      }
    } catch {
      showToast('Tarmoq xatosi', 'error');
    }
  };

  // Action: Cash Movement (In / Out)
  const handleCashMovement = async () => {
    if (!currentShift) return;
    try {
      const amountTiyin = BigInt(movementAmountInput.replace(/\s+/g, '') || '0') * 100n;
      if (amountTiyin <= 0n) {
        showToast('Summa 0 dan katta bo\'lishi shart', 'warning');
        return;
      }
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/shifts/cash-movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          shiftId: currentShift.shift.id,
          type: movementType,
          amountTiyin: amountTiyin.toString(),
          reason: movementReasonInput || 'Kassa harakati',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Kassa harakati muvaffaqiyatli qayd etildi', 'success');
        setCashMovementModal(false);
        setMovementAmountInput('');
        setMovementReasonInput('');
        fetchCurrentShift();
      } else {
        showToast(data.error?.message || 'Kassa harakatini yozishda xatolik', 'error');
      }
    } catch {
      showToast('Tarmoq xatosi', 'error');
    }
  };

  // Action: Process Payment
  const handleProcessPayment = async () => {
    if (!selectedVisitId || !detailedBill) return;
    if (!currentShift) {
      showToast('To\'lov qabul qilish uchun avval kassa smenasini oching!', 'warning');
      setOpenShiftModal(true);
      return;
    }

    const balance = BigInt(detailedBill.bill.balanceTiyin);
    if (parsedCustomAmountTiyin <= 0n) {
      showToast('To\'lov summasi 0 dan katta bo\'lishi kerak', 'warning');
      return;
    }
    if (parsedCustomAmountTiyin > balance) {
      showToast(`To'lov summasi qoldiqdan (${formatMoneyUzs(balance)}) oshmasligi kerak!`, 'error');
      return;
    }
    if (paymentMethod === 'CASH' && parsedTenderedCashTiyin < parsedCustomAmountTiyin) {
      showToast('Berilgan naqd pul to\'lov summasidan kam bo\'lmasligi kerak', 'warning');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/billing/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId: selectedVisitId,
          method: paymentMethod === 'CASH' ? 'CASH' : 'TERMINAL',
          amountTiyin: parsedCustomAmountTiyin.toString(),
          tenderedCashTiyin:
            paymentMethod === 'CASH' ? parsedTenderedCashTiyin.toString() : undefined,
          changeTiyin:
            paymentMethod === 'CASH' ? calculatedChangeTiyin.toString() : undefined,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`To'lov muvaffaqiyatli qabul qilindi: ${formatMoneyUzs(parsedCustomAmountTiyin)}`, 'success');
        fetchCurrentShift();
        fetchOpenBills();
        fetchDetailedBill(selectedVisitId);
        setMobileStep('detail');
      } else {
        if (data.error?.code === 'OVERPAYMENT_REJECTED') {
          showToast('Boshqa kassir to\'lov kiritgan, hisob balansi yangilandi!', 'warning');
          fetchDetailedBill(selectedVisitId);
        } else {
          showToast(data.error?.message || 'To\'lovni qayd etishda xatolik', 'error');
        }
      }
    } catch {
      showToast('Tarmoq xatosi yuz berdi', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Action: Reverse Payment
  const handleReversePayment = async () => {
    if (!paymentToReverse) return;
    try {
      const res = await fetch(
        `/api/v1/restaurants/${restaurantId}/billing/payments/${paymentToReverse}/reverse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason: reverseReasonInput || 'Xato kiritilgan to\'lov' }),
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('To\'lov bekor qilindi (Reversed)', 'success');
        setReversePaymentModal(false);
        setPaymentToReverse(null);
        setReverseReasonInput('');
        fetchCurrentShift();
        if (selectedVisitId) fetchDetailedBill(selectedVisitId);
      } else {
        showToast(data.error?.message || 'Bekor qilishda xatolik', 'error');
      }
    } catch {
      showToast('Tarmoq xatosi', 'error');
    }
  };

  // Action: Refund Payment
  const handleRefundPayment = async () => {
    if (!paymentToRefund) return;
    try {
      const amountTiyin = BigInt(refundAmountInput.replace(/\s+/g, '') || '0') * 100n;
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/billing/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          paymentId: paymentToRefund.id,
          amountTiyin: amountTiyin.toString(),
          reason: refundReasonInput || 'Mijozga pul qaytarildi',
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Pul muvaffaqiyatli qaytarildi (Refund)', 'success');
        setRefundModal(false);
        setPaymentToRefund(null);
        setRefundAmountInput('');
        setRefundReasonInput('');
        fetchCurrentShift();
        if (selectedVisitId) fetchDetailedBill(selectedVisitId);
      } else {
        showToast(data.error?.message || 'Qaytarishda xatolik', 'error');
      }
    } catch {
      showToast('Tarmoq xatosi', 'error');
    }
  };

  // Action: Close Visit
  const handleCloseVisit = async () => {
    if (!selectedVisitId || !detailedBill) return;
    const balance = BigInt(detailedBill.bill.balanceTiyin);
    if (balance > 0n) {
      showToast(`Tashrifda to'lanmagan qoldiq mavjud: ${formatMoneyUzs(balance)}`, 'warning');
      return;
    }
    if (balance < 0n) {
      showToast(`Mijozga ortiqcha to'lov qaytarilishi kerak: ${formatMoneyUzs(-balance)}`, 'error');
      return;
    }

    try {
      const res = await fetch(
        `/api/v1/restaurants/${restaurantId}/billing/visits/${selectedVisitId}/close`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Stol ${detailedBill.visit.tableNumber} tashrifi rasman yopildi (Stol bo'shatildi)`, 'success');
        setSelectedVisitId(null);
        setDetailedBill(null);
        fetchOpenBills();
        setMobileStep('list');
      } else {
        showToast(data.error?.message || 'Tashrifni yopishda xatolik', 'error');
      }
    } catch {
      showToast('Tarmoq xatosi', 'error');
    }
  };

  // Helper: Can close visit?
  const canCloseVisit = useMemo(() => {
    if (!detailedBill) return false;
    const balance = BigInt(detailedBill.bill.balanceTiyin);
    if (balance !== 0n) return false;
    const allItems = detailedBill.orders.flatMap((o) => o.items);
    const unserved = allItems.filter(
      (i) => i.status !== 'SERVED' && i.status !== 'CANCELLED'
    );
    return unserved.length === 0;
  }, [detailedBill]);

  return (
    <div className="min-h-screen bg-bg flex flex-col font-sans">
      {/* Offline Ogohlantirish Paneli */}
      <ConnectionBanner status={status} />

      {/* Top Header */}
      <header className="bg-brand-900 text-white px-4 sm:px-6 lg:px-8 py-3.5 shadow-md border-b border-brand-800 sticky top-0 z-30">
        <div className="w-full flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-800 flex items-center justify-center border border-brand-700">
              <Receipt className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Kassa</h1>
              <p className="text-xs text-brand-200">
                Ochiq hisoblar: {openBills.length} ta
              </p>
            </div>
          </div>

          {/* Smena pill, Kassa harakati va Realtime pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <RealtimeIndicatorPill
              status={status}
              soundEnabled={soundEnabled}
              onToggleSound={toggleSound}
            />

            {currentShift ? (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCashMovementModal(true)}
                  className="bg-brand-800/80 text-white border-brand-700 hover:bg-brand-700 text-xs py-1 px-2.5 h-8"
                >
                  <Coins className="w-3.5 h-3.5 mr-1 text-amber-300" />
                  Kirim / Chiqim
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCloseShiftModal(true)}
                  className="bg-emerald-950/80 text-emerald-200 border-emerald-700 hover:bg-emerald-900 text-xs py-1 px-2.5 h-8 flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Smena Ochiq #{currentShift.shift.id.slice(0, 6)}</span>
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setOpenShiftModal(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs py-1 px-3 h-8 shadow-sm flex items-center gap-1"
              >
                <BadgeAlert className="w-4 h-4 text-white" />
                <span>Smena Ochish</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                fetchCurrentShift();
                fetchOpenBills();
                if (selectedVisitId) fetchDetailedBill(selectedVisitId);
              }}
              className="text-brand-200 hover:text-white p-1.5 h-8 w-8"
              title="Yangilash"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
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

      {/* Main Multi-Column or Sequential Layout */}
      <main className="flex-1 w-full p-4 sm:p-6 lg:p-8">
        {/* Mobile Navigation Header */}
        <div className="lg:hidden mb-4 flex items-center justify-between bg-surface p-2 rounded-2xl border border-line shadow-subtle">
          <div className="flex items-center gap-1 w-full">
            <button
              onClick={() => setMobileStep('list')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                mobileStep === 'list'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-ink-secondary hover:bg-bg'
              }`}
            >
              1. Hisoblar ({openBills.length})
            </button>
            <button
              onClick={() => setMobileStep('detail')}
              disabled={!detailedBill}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                mobileStep === 'detail'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-ink-secondary hover:bg-bg'
              }`}
            >
              2. Tafsilot {detailedBill ? `(Stol ${detailedBill.visit.tableNumber})` : ''}
            </button>
            <button
              onClick={() => setMobileStep('pay')}
              disabled={!detailedBill}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                mobileStep === 'pay'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-ink-secondary hover:bg-bg'
              }`}
            >
              3. To'lov
            </button>
          </div>
        </div>

        {/* 3 Columns Desktop Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUMN 1: Ochiq Hisoblar Ro'yxati */}
          <section
            className={`lg:col-span-4 flex flex-col bg-surface rounded-2xl border border-line shadow-subtle overflow-hidden ${
              mobileStep !== 'list' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="p-4 border-b border-line bg-bg/50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-ink-main">Ochiq Hisoblar</h2>
                  <p className="text-xs text-ink-secondary">Stol bo'yicha faol tashriflar</p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand">
                  {openBills.length} ta
                </span>
              </div>
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary" />
                <input
                  type="text"
                  placeholder="Stol yoki ofitsiant bo'yicha qidirish..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface border border-line rounded-xl text-ink-main placeholder:text-ink-secondary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            <div className="divide-y divide-line overflow-y-auto max-h-[calc(100vh-250px)]">
              {filteredBills.length === 0 ? (
                <div className="p-8 text-center text-ink-secondary text-sm">
                  {searchQuery ? 'Qidiruv bo\'yicha hisob topilmadi' : 'Hozircha ochiq hisoblar mavjud emas'}
                </div>
              ) : (
                filteredBills.map((b) => {
                  const isSelected = b.visitId === selectedVisitId;
                  const isRefundDue = b.bill.isRefundDue;
                  const isFullyPaid = b.bill.isFullyPaid;

                  return (
                    <div
                      key={b.visitId}
                      onClick={() => {
                        setSelectedVisitId(b.visitId);
                        setMobileStep('detail');
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedVisitId(b.visitId);
                          setMobileStep('detail');
                        }
                      }}
                      className={`p-4 cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-brand-50/70 border-l-4 border-brand font-medium'
                          : 'hover:bg-bg/60 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-ink-main">
                            Stol {b.tableNumber}
                          </span>
                          {isRefundDue ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 animate-pulse">
                              Qaytarish kerak
                            </span>
                          ) : isFullyPaid ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                              To'langan
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Qoldiq bor
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-ink-secondary flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>{b.waiterName || 'Biriktirilmagan'}</span>
                          <span>•</span>
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {new Date(b.openedAt).toLocaleTimeString('uz-UZ', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`font-mono text-sm font-black ${
                            isRefundDue ? 'text-red-600' : isFullyPaid ? 'text-emerald-700' : 'text-brand'
                          }`}
                        >
                          <Money amountTiyin={b.bill.totalDueTiyin} />
                        </div>
                        <span className="text-[10px] text-ink-secondary block">
                          Qoldiq: <Money amountTiyin={b.bill.balanceTiyin} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* COLUMN 2: Hisob Tafsiloti (Selected Visit) */}
          <section
            className={`lg:col-span-5 flex flex-col bg-surface rounded-2xl border border-line shadow-subtle overflow-hidden ${
              mobileStep !== 'detail' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {detailedBill ? (
              <>
                <div className="p-4 border-b border-line bg-bg/50 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-ink-main">
                        Stol {detailedBill.visit.tableNumber} Hisobi
                      </h2>
                      <span className="text-xs text-ink-secondary">
                        (Tashrif #{detailedBill.visit.id.slice(0, 8)})
                      </span>
                    </div>
                    <p className="text-xs text-ink-secondary">
                      Ochilgan:{' '}
                      {new Date(detailedBill.visit.openedAt).toLocaleTimeString('uz-UZ', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {detailedBill.visit.serviceChargeBpsSnapshot !== null && (
                        <span> • Xizmat stavkasi: {detailedBill.visit.serviceChargeBpsSnapshot / 100}%</span>
                      )}
                    </p>
                  </div>
                  {/* Action buttons in header */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs py-1.5 h-8 flex items-center gap-1"
                      onClick={() => setPreCheckModal(true)}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Pre-check</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="lg:hidden text-xs py-1.5 h-8"
                      onClick={() => setMobileStep('pay')}
                    >
                      To'lov <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                  </div>
                </div>

                {/* Refund Due Alert Banner */}
                {detailedBill.bill.isRefundDue && (
                  <div className="p-3 bg-red-50 border-b border-red-200 flex items-center gap-2 text-xs text-red-900 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>
                      Diqqat: Hisobda ortiqcha to'lov mavjud ({formatMoneyUzs(-BigInt(detailedBill.bill.balanceTiyin))}).
                      Mijozga pul qaytarilmaguncha tashrifni yopib bo'lmaydi!
                    </span>
                  </div>
                )}

                {/* Items List */}
                <div className="p-4 divide-y divide-line/60 overflow-y-auto max-h-[300px]">
                  {detailedBill.orders.flatMap((o) => o.items).length === 0 ? (
                    <div className="py-6 text-center text-xs text-ink-secondary">
                      Hozircha buyurtma qilingan taomlar yo'q
                    </div>
                  ) : (
                    detailedBill.orders
                      .flatMap((o) => o.items)
                      .map((item) => {
                        const isCancelled = item.status === 'CANCELLED';
                        const itemTotalTiyin =
                          (BigInt(item.snapshotPriceTiyin) +
                            (item.addonSnapshots?.reduce(
                              (sum, a) => sum + BigInt(a.priceTiyin),
                              0n
                            ) || 0n)) *
                          BigInt(item.quantity);

                        return (
                          <div
                            key={item.id}
                            className={`py-2 flex items-center justify-between text-xs ${
                              isCancelled ? 'opacity-40 line-through' : ''
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-ink-main px-1.5 py-0.5 rounded bg-bg border border-line text-[11px]">
                                  {item.quantity}x
                                </span>
                                <span className="font-semibold text-ink-main">{item.dishTitle}</span>
                                {item.variantTitle && (
                                  <span className="text-[10px] text-ink-secondary">
                                    ({item.variantTitle})
                                  </span>
                                )}
                                <span
                                  className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                                    item.status === 'SERVED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : item.status === 'READY'
                                      ? 'bg-blue-100 text-blue-800'
                                      : item.status === 'CANCELLED'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {item.status}
                                </span>
                              </div>
                              {item.addonSnapshots && item.addonSnapshots.length > 0 && (
                                <p className="text-[10px] text-ink-secondary pl-6">
                                  + {item.addonSnapshots.map((a) => a.name).join(', ')}
                                </p>
                              )}
                            </div>
                            <div className="font-mono text-xs font-semibold text-ink-main">
                              <Money amountTiyin={itemTotalTiyin} />
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>

                {/* Calculation Breakdown (Step 11 Invariants) */}
                <div className="p-4 bg-bg/40 border-t border-line space-y-1.5 text-xs">
                  <div className="flex justify-between text-ink-secondary">
                    <span>Oraliq summa (Subtotal):</span>
                    <span className="font-mono font-medium">
                      <Money amountTiyin={detailedBill.bill.subtotalTiyin} />
                    </span>
                  </div>

                  {BigInt(detailedBill.bill.discountTiyin) > 0n && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Chegirma (Capped at subtotal):</span>
                      <span className="font-mono">
                        - <Money amountTiyin={detailedBill.bill.discountTiyin} />
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-ink-secondary">
                    <span>
                      Xizmat haqi ({detailedBill.bill.serviceChargeBps / 100}% chegirmadan keyin):
                    </span>
                    <span className="font-mono font-medium">
                      <Money amountTiyin={detailedBill.bill.serviceChargeTiyin} />
                    </span>
                  </div>

                  {BigInt(detailedBill.bill.adjustmentsTiyin) !== 0n && (
                    <div className="flex justify-between text-ink-secondary">
                      <span>Tuzatishlar (Adjustments):</span>
                      <span className="font-mono font-medium">
                        <Money amountTiyin={detailedBill.bill.adjustmentsTiyin} />
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-line flex justify-between text-sm font-extrabold text-ink-main">
                    <span>Jami to'lanishi kerak:</span>
                    <span className="font-mono text-brand text-base">
                      <Money amountTiyin={detailedBill.bill.totalDueTiyin} />
                    </span>
                  </div>

                  <div className="flex justify-between text-ink-secondary text-xs">
                    <span>To'langan (Net Paid):</span>
                    <span className="font-mono font-semibold text-emerald-800">
                      <Money amountTiyin={detailedBill.bill.netPaidTiyin} />
                    </span>
                  </div>

                  <div
                    className={`pt-1 flex justify-between text-sm font-black ${
                      detailedBill.bill.isRefundDue
                        ? 'text-red-600'
                        : detailedBill.bill.isFullyPaid
                        ? 'text-emerald-700'
                        : 'text-amber-800'
                    }`}
                  >
                    <span>
                      {detailedBill.bill.isRefundDue
                        ? 'Qaytarilishi kerak:'
                        : detailedBill.bill.isFullyPaid
                        ? 'To\'liq to\'langan (Qoldiq 0)'
                        : 'Qoldiq:'}
                    </span>
                    <span className="font-mono text-base">
                      {detailedBill.bill.isRefundDue ? (
                        <span>- {formatMoneyUzs(-BigInt(detailedBill.bill.balanceTiyin))}</span>
                      ) : (
                        <Money amountTiyin={detailedBill.bill.balanceTiyin} />
                      )}
                    </span>
                  </div>
                </div>

                {/* Payments History List & Actions */}
                {detailedBill.payments.length > 0 && (
                  <div className="p-3 border-t border-line bg-surface space-y-2">
                    <span className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider block">
                      Kiritilgan To'lovlar ({detailedBill.payments.length})
                    </span>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                      {detailedBill.payments.map((p) => {
                        const isReversed = p.status === 'REVERSED';
                        const alreadyRefundedTiyin =
                          p.refunds?.reduce((sum, r) => sum + BigInt(r.amountTiyin), 0n) || 0n;
                        const availableRefundTiyin = BigInt(p.amountTiyin) - alreadyRefundedTiyin;

                        return (
                          <div
                            key={p.id}
                            className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                              isReversed
                                ? 'bg-gray-100 border-gray-200 text-gray-500'
                                : 'bg-bg border-line text-ink-main'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5 font-semibold">
                                <span>{p.method === 'CASH' ? 'Naqd' : 'Terminal'}</span>
                                <span className="font-mono">
                                  <Money amountTiyin={p.amountTiyin} />
                                </span>
                                {isReversed ? (
                                  <Badge variant="danger" size="sm">
                                    Bekor qilingan
                                  </Badge>
                                ) : alreadyRefundedTiyin > 0n ? (
                                  <Badge variant="warning" size="sm">
                                    Qaytarilgan: {formatMoneyUzs(alreadyRefundedTiyin)}
                                  </Badge>
                                ) : (
                                  <Badge variant="success" size="sm">
                                    Muvaffaqiyatli
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-ink-secondary">
                                {new Date(p.createdAt).toLocaleTimeString('uz-UZ')}
                              </span>
                            </div>

                            {/* Actions on payment */}
                            {!isReversed && (
                              <div className="flex items-center gap-1">
                                {availableRefundTiyin > 0n && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-[10px] py-1 px-1.5 h-6 text-amber-700 hover:bg-amber-50"
                                    onClick={() => {
                                      setPaymentToRefund({
                                        id: p.id,
                                        maxAmountTiyin: availableRefundTiyin.toString(),
                                      });
                                      setRefundAmountInput((availableRefundTiyin / 100n).toString());
                                      setRefundModal(true);
                                    }}
                                  >
                                    Qaytarish
                                  </Button>
                                )}
                                {alreadyRefundedTiyin === 0n && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-[10px] py-1 px-1.5 h-6 text-red-600 hover:bg-red-50"
                                    onClick={() => {
                                      setPaymentToReverse(p.id);
                                      setReversePaymentModal(true);
                                    }}
                                  >
                                    Reversal
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Close Visit Action Footer */}
                <div className="p-4 border-t border-line bg-bg/50">
                  <Button
                    variant="outline"
                    size="md"
                    disabled={!canCloseVisit}
                    className={`w-full font-bold text-xs h-10 ${
                      canCloseVisit
                        ? 'border-emerald-600 text-emerald-800 hover:bg-emerald-50'
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                    onClick={handleCloseVisit}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Tashrifni Yopish & Stolni Bo'shatish
                  </Button>
                  {!canCloseVisit && (
                    <p className="text-[10px] text-ink-secondary text-center mt-1.5">
                      Tashrifni yopish uchun qoldiq 0 bo'lishi va barcha taomlar yetkazilgan (SERVED) bo'lishi shart.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-ink-secondary text-sm">
                Hisobni ko'rish uchun chap tomondan stolni tanlang
              </div>
            )}
          </section>

          {/* COLUMN 3: To'lovni Qabul Qilish (Payment Actions) */}
          <section
            className={`lg:col-span-3 flex flex-col bg-surface rounded-2xl border border-line shadow-subtle p-5 space-y-4 ${
              mobileStep !== 'pay' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="border-b border-line pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-ink-main">To'lov Qabul Qilish</h3>
                <p className="text-xs text-ink-secondary">Smena va kassa nazorati</p>
              </div>
            </div>

            {/* Check Active Shift */}
            {!currentShift ? (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Faol kassa smenasi yo'q!</p>
                    <p className="text-[11px] text-amber-800">
                      To'lov qabul qilish va chek chiqarish uchun avval smena ochilishi shart.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold h-9"
                  onClick={() => setOpenShiftModal(true)}
                >
                  Smenani Ochish
                </Button>
              </div>
            ) : !detailedBill ? (
              <div className="p-8 text-center text-ink-secondary text-xs">
                To'lov kiritish uchun hisobni tanlang
              </div>
            ) : (
              <div className="space-y-4">
                {/* Payment Methods */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider block">
                    To'lov usuli
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold min-h-[50px] transition-all ${
                        paymentMethod === 'CASH'
                          ? 'border-brand bg-brand-50 text-brand ring-2 ring-brand/20'
                          : 'border-line text-ink-main hover:bg-bg'
                      }`}
                    >
                      <Banknote className="w-4 h-4 mb-1" />
                      <span>Naqd Pul</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('TERMINAL')}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold min-h-[50px] transition-all ${
                        paymentMethod === 'TERMINAL'
                          ? 'border-brand bg-brand-50 text-brand ring-2 ring-brand/20'
                          : 'border-line text-ink-main hover:bg-bg'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 mb-1" />
                      <span>Terminal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('QR')}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold min-h-[50px] transition-all ${
                        paymentMethod === 'QR'
                          ? 'border-[#00aaff] bg-sky-50 text-[#0088cc] ring-2 ring-sky-200'
                          : 'border-line text-ink-main hover:bg-bg'
                      }`}
                    >
                      <QrCode className="w-4 h-4 mb-1" />
                      <span>Click/Payme</span>
                    </button>
                  </div>
                </div>

                {/* Amount to Pay (Partial allowed) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-ink-main">To'lov summasi (UZS)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const bal = BigInt(detailedBill.bill.balanceTiyin);
                        if (bal > 0n) {
                          setCustomAmountUzs((bal / 100n).toString());
                          setTenderedCashUzs((bal / 100n).toString());
                        }
                      }}
                      className="text-[11px] text-brand hover:underline font-semibold"
                    >
                      To'liq qoldiq
                    </button>
                  </div>
                  <Input
                    type="number"
                    value={customAmountUzs}
                    onChange={(e) => {
                      setCustomAmountUzs(e.target.value);
                      if (paymentMethod === 'CASH') {
                        setTenderedCashUzs(e.target.value);
                      }
                    }}
                    placeholder="Masalan: 50000"
                    className="font-mono text-base font-bold"
                  />
                </div>

                {/* If CASH: Tendered Cash & Change Calculation */}
                {paymentMethod === 'CASH' && (
                  <div className="p-3 bg-bg rounded-xl border border-line space-y-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-ink-secondary block">
                        Berilgan naqd pul (UZS)
                      </label>
                      <Input
                        type="number"
                        value={tenderedCashUzs}
                        onChange={(e) => setTenderedCashUzs(e.target.value)}
                        placeholder="Mijoz bergan naqd summa"
                        className="font-mono text-sm font-semibold"
                      />
                    </div>

                    {/* Quick Tender Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[10000n, 50000n, 100000n, 200000n].map((quick) => (
                        <button
                          key={quick.toString()}
                          type="button"
                          onClick={() => {
                            const current = BigInt(tenderedCashUzs.replace(/\s+/g, '') || '0');
                            const updated = current + quick;
                            setTenderedCashUzs(updated.toString());
                          }}
                          className="px-2 py-1 text-[10px] font-mono font-bold rounded-lg bg-surface border border-line text-ink-main hover:bg-brand-50 hover:text-brand"
                        >
                          +{quick.toLocaleString()}
                        </button>
                      ))}
                    </div>

                    {/* Realtime Change (Qaytim) Display */}
                    <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink-secondary">Mijozga Qaytim:</span>
                      <span className="font-mono font-black text-emerald-700 text-sm">
                        <Money amountTiyin={calculatedChangeTiyin} />
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-secondary italic">
                      Qaytim daromadga kiritilmaydi. Faqat to'lov summasi ({formatMoneyUzs(parsedCustomAmountTiyin)}) kassa tushumiga yoziladi.
                    </p>
                  </div>
                )}

                {/* If TERMINAL Notice */}
                {paymentMethod === 'TERMINAL' && (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-1">
                    <p className="font-bold">Terminal Tasdig'i</p>
                    <p className="text-[11px] text-blue-800">
                      Bank terminali orqali to'lov muvaffaqiyatli o'tgach, 'To'lovni Saqlash' tugmasini bosing.
                    </p>
                  </div>
                )}

                {/* If QR Notice & Interactive QR Code */}
                {paymentMethod === 'QR' && detailedBill && (
                  <UzPaymentQr
                    amountTiyin={
                      parsedCustomAmountTiyin > 0n
                        ? parsedCustomAmountTiyin
                        : BigInt(detailedBill.bill.balanceTiyin)
                    }
                    tableNumber={detailedBill.visit.tableNumber}
                    visitId={detailedBill.visit.id}
                    onPaymentConfirmed={handleProcessPayment}
                  />
                )}

                {/* Actions */}
                <div className="space-y-2 pt-1">
                  <Button
                    variant="primary"
                    size="lg"
                    disabled={isSubmittingPayment || parsedCustomAmountTiyin <= 0n}
                    className="w-full bg-brand hover:bg-brand-hover text-white text-sm font-bold min-h-[46px] shadow-sm"
                    onClick={handleProcessPayment}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {isSubmittingPayment ? 'Qayd etilmoqda...' : 'To\'lovni Saqlash'}
                  </Button>

                  {mobileStep === 'pay' && (
                    <Button
                      variant="ghost"
                      size="md"
                      className="w-full text-xs text-ink-secondary lg:hidden"
                      onClick={() => setMobileStep('detail')}
                    >
                      <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Orqaga
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* DIALOG 1: Open Shift Modal */}
      <Dialog
        isOpen={openShiftModal}
        onClose={() => setOpenShiftModal(false)}
        title="Yangi Kassa Smenasini Ochish"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-ink-secondary">
            Kassir sifatida to'lovlarni qabul qilishni boshlash uchun boshlang'ich naqd pul qoldig'ini kiriting.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-main">
              Kassadagi Boshlang'ich Naqd Pul (UZS)
            </label>
            <Input
              type="number"
              value={openingCashInput}
              onChange={(e) => setOpeningCashInput(e.target.value)}
              placeholder="Masalan: 500000"
              className="font-mono text-base font-bold"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpenShiftModal(false)}>
              Bekor qilish
            </Button>
            <Button variant="primary" onClick={handleOpenShift}>
              Smenani Ochish
            </Button>
          </div>
        </div>
      </Dialog>

      {/* DIALOG 2: Close Shift & Reconciliation Modal */}
      <Dialog
        isOpen={closeShiftModal}
        onClose={() => setCloseShiftModal(false)}
        title={`Smenani Yopish & Kassa Reconcile (#${currentShift?.shift.id.slice(0, 6)})`}
      >
        {currentShift && (
          <div className="space-y-4 pt-2 text-xs">
            {/* Shift Metrics Breakdown */}
            <div className="p-3 bg-bg rounded-xl border border-line space-y-1.5 font-mono">
              <div className="flex justify-between text-ink-secondary">
                <span>Boshlang'ich kassa:</span>
                <span><Money amountTiyin={currentShift.shift.startingCashTiyin} /></span>
              </div>
              <div className="flex justify-between text-ink-secondary">
                <span>Naqd tushum (+):</span>
                <span className="text-emerald-700 font-bold">
                  + <Money amountTiyin={currentShift.metrics.cashReceiptsTiyin} />
                </span>
              </div>
              <div className="flex justify-between text-ink-secondary">
                <span>Terminal tushum:</span>
                <span><Money amountTiyin={currentShift.metrics.terminalReceiptsTiyin} /></span>
              </div>
              <div className="flex justify-between text-ink-secondary">
                <span>Naqd qaytarishlar (-):</span>
                <span className="text-red-600 font-bold">
                  - <Money amountTiyin={currentShift.metrics.cashRefundsTiyin} />
                </span>
              </div>
              <div className="flex justify-between text-ink-secondary">
                <span>Naqd bekor qilinganlar (-):</span>
                <span className="text-red-600 font-bold">
                  - <Money amountTiyin={currentShift.metrics.cashReversalsTiyin} />
                </span>
              </div>
              <div className="flex justify-between text-ink-secondary">
                <span>Kassa kirimlari (+):</span>
                <span>+ <Money amountTiyin={currentShift.metrics.cashInTiyin} /></span>
              </div>
              <div className="flex justify-between text-ink-secondary">
                <span>Kassa chiqimlari (-):</span>
                <span>- <Money amountTiyin={currentShift.metrics.cashOutTiyin} /></span>
              </div>
              <div className="pt-2 border-t border-line flex justify-between text-sm font-black text-brand">
                <span>Kutilayotgan Naqd Pul:</span>
                <span><Money amountTiyin={currentShift.metrics.expectedCashTiyin} /></span>
              </div>
            </div>

            {/* Counted Cash Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-main">
                Haqiqiy Sanalgan Naqd Pul (UZS)
              </label>
              <Input
                type="number"
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(e.target.value)}
                placeholder="Kassadagi naqd summani sanab kiriting"
                className="font-mono text-base font-bold"
              />
            </div>

            {/* Calculated Difference Display */}
            {countedCashInput && (
              <div className="p-3 bg-surface rounded-xl border border-line flex items-center justify-between font-mono">
                <span className="font-semibold text-ink-secondary">Farq (Difference):</span>
                {(() => {
                  const counted = BigInt(countedCashInput.replace(/\s+/g, '') || '0') * 100n;
                  const exp = BigInt(currentShift.metrics.expectedCashTiyin);
                  const diff = counted - exp;
                  return (
                    <span
                      className={`font-black text-sm ${
                        diff === 0n ? 'text-emerald-700' : diff > 0n ? 'text-blue-700' : 'text-red-600'
                      }`}
                    >
                      {diff > 0n ? '+' : ''}
                      {formatMoneyUzs(diff)}
                    </span>
                  );
                })()}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setCloseShiftModal(false)}>
                Bekor qilish
              </Button>
              <Button variant="primary" onClick={handleCloseShift}>
                Smenani Yopish
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* DIALOG 3: Cash Movement (In / Out) Modal */}
      <Dialog
        isOpen={cashMovementModal}
        onClose={() => setCashMovementModal(false)}
        title="Kassa Harakatini Qayd Etish"
      >
        <div className="space-y-4 pt-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMovementType('CASH_IN')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1 font-bold transition-all ${
                movementType === 'CASH_IN'
                  ? 'border-brand bg-brand-50 text-brand ring-1 ring-brand'
                  : 'border-line text-ink-main'
              }`}
            >
              <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
              <span>Kassa Kirimi (CASH_IN)</span>
            </button>
            <button
              type="button"
              onClick={() => setMovementType('CASH_OUT')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1 font-bold transition-all ${
                movementType === 'CASH_OUT'
                  ? 'border-red-600 bg-red-50 text-red-700 ring-1 ring-red-600'
                  : 'border-line text-ink-main'
              }`}
            >
              <ArrowUpCircle className="w-5 h-5 text-red-600" />
              <span>Kassa Chiqimi (CASH_OUT)</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-main">Summa (UZS)</label>
            <Input
              type="number"
              value={movementAmountInput}
              onChange={(e) => setMovementAmountInput(e.target.value)}
              placeholder="Masalan: 100000"
              className="font-mono text-base font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-main">Sabab / Izoh</label>
            <Input
              type="text"
              value={movementReasonInput}
              onChange={(e) => setMovementReasonInput(e.target.value)}
              placeholder="Masalan: Mayda pul qo'shildi / Inkassatsiya"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCashMovementModal(false)}>
              Bekor qilish
            </Button>
            <Button variant="primary" onClick={handleCashMovement}>
              Harakatni Saqlash
            </Button>
          </div>
        </div>
      </Dialog>

      {/* DIALOG 4: Pre-Check Receipt Modal */}
      <Dialog
        isOpen={preCheckModal}
        onClose={() => setPreCheckModal(false)}
        title="Pre-Check / Hisob Varaqasi"
      >
        {detailedBill && (
          <div className="space-y-4 pt-1 font-mono text-xs">
            <div className="p-4 bg-white border border-line rounded-xl shadow-inner text-ink-main space-y-3">
              <div className="text-center border-b border-dashed border-gray-400 pb-3 space-y-0.5">
                <h4 className="font-bold text-sm tracking-widest uppercase">MENUREST RESTORANI</h4>
                <p className="text-[10px] text-ink-secondary">Pre-Check / Hisob Varaqasi</p>
                <p className="text-[9px] text-ink-muted">Mazkur hujjat fiskal chek hisoblanmaydi</p>
              </div>

              <div className="text-[11px] space-y-0.5 border-b border-dashed border-gray-400 pb-2">
                <div className="flex justify-between">
                  <span>Stol:</span>
                  <span className="font-bold">№ {detailedBill.visit.tableNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sana va vaqt:</span>
                  <span>{new Date().toLocaleString('uz-UZ')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tashrif ID:</span>
                  <span>#{detailedBill.visit.id.slice(0, 8)}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border-b border-dashed border-gray-400 pb-2 space-y-1">
                {detailedBill.orders
                  .flatMap((o) => o.items)
                  .filter((i) => i.status !== 'CANCELLED')
                  .map((it) => (
                    <div key={it.id} className="flex justify-between text-[11px]">
                      <div className="truncate max-w-[200px]">
                        {it.dishTitle} {it.quantity > 1 ? `(${it.quantity}x)` : ''}
                      </div>
                      <div className="font-semibold">
                        <Money
                          amountTiyin={
                            (BigInt(it.snapshotPriceTiyin) +
                              (it.addonSnapshots?.reduce(
                                (sum, a) => sum + BigInt(a.priceTiyin),
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
                  <span><Money amountTiyin={detailedBill.bill.subtotalTiyin} /></span>
                </div>
                {BigInt(detailedBill.bill.discountTiyin) > 0n && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Chegirma:</span>
                    <span>- <Money amountTiyin={detailedBill.bill.discountTiyin} /></span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Xizmat ({detailedBill.bill.serviceChargeBps / 100}%):</span>
                  <span><Money amountTiyin={detailedBill.bill.serviceChargeTiyin} /></span>
                </div>
                <div className="pt-2 border-t border-dashed border-gray-400 flex justify-between font-bold text-sm">
                  <span>JAMI TO'LANISHI KERAK:</span>
                  <span><Money amountTiyin={detailedBill.bill.totalDueTiyin} /></span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>To'langan:</span>
                  <span><Money amountTiyin={detailedBill.bill.netPaidTiyin} /></span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1">
                  <span>QOLDIQ:</span>
                  <span><Money amountTiyin={detailedBill.bill.balanceTiyin} /></span>
                </div>
              </div>

              <div className="pt-3 border-t border-dashed border-gray-400 text-center space-y-1.5">
                <div className="flex items-center justify-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#00aaff]/10 text-[#0088cc] font-black text-[9px] border border-[#00aaff]/30">
                    CLICK
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#00cccc]/10 text-[#00a896] font-black text-[9px] border border-[#00cccc]/30">
                    PAYME
                  </span>
                </div>
                <div className="text-[10px] text-ink-secondary">Click va Payme orqali to'lov qabul qilinadi</div>
                <div className="text-[9px] text-ink-muted">Tashrifingiz uchun rahmat!</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 font-sans">
              <Button variant="ghost" onClick={() => setPreCheckModal(false)}>
                Yopish
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  window.print();
                }}
                className="flex items-center gap-1"
              >
                <Printer className="w-4 h-4" />
                <span>Chop Etish</span>
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* DIALOG 5: Payment Reversal Modal */}
      <Dialog
        isOpen={reversePaymentModal}
        onClose={() => setReversePaymentModal(false)}
        title="To'lovni Bekor Qilish (Payment Reversal)"
      >
        <div className="space-y-4 pt-2 text-xs">
          <p className="text-ink-secondary">
            Diqqat: Xato kiritilgan to'lovni bekor qilish uning statusini 'REVERSED' holatiga o'tkazadi
            va hisob qoldig'ini tiklaydi. Smena hisobotida naqd pul kamaytiriladi.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-main">Bekor qilish sababi</label>
            <Input
              type="text"
              value={reverseReasonInput}
              onChange={(e) => setReverseReasonInput(e.target.value)}
              placeholder="Masalan: Kassir tomonidan xato summa kiritilgan"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setReversePaymentModal(false)}>
              Bekor qilish
            </Button>
            <Button
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={handleReversePayment}
            >
              Reversallash
            </Button>
          </div>
        </div>
      </Dialog>

      {/* DIALOG 6: Refund Modal */}
      <Dialog
        isOpen={refundModal}
        onClose={() => setRefundModal(false)}
        title="Pulni Qaytarish (Refund)"
      >
        <div className="space-y-4 pt-2 text-xs">
          <p className="text-ink-secondary">
            To'lovdan mijozga qaytariladigan summani kiriting. Maksimal qaytarish mumkin:{' '}
            <span className="font-bold text-ink-main font-mono">
              {paymentToRefund && formatMoneyUzs(BigInt(paymentToRefund.maxAmountTiyin))}
            </span>
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-main">Qaytarish summasi (UZS)</label>
            <Input
              type="number"
              value={refundAmountInput}
              onChange={(e) => setRefundAmountInput(e.target.value)}
              placeholder="Masalan: 20000"
              className="font-mono text-base font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-main">Qaytarish sababi</label>
            <Input
              type="text"
              value={refundReasonInput}
              onChange={(e) => setRefundReasonInput(e.target.value)}
              placeholder="Masalan: Mijoz buyurtmani bekor qildi"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRefundModal(false)}>
              Bekor qilish
            </Button>
            <Button variant="primary" onClick={handleRefundPayment}>
              Qaytarishni Tasdiqlash
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
