import React, { useState, useEffect, useCallback } from 'react';
import {
  ChefHat,
  Clock,
  AlertCircle,
  CheckCircle2,
  Flame,
  Wine,
  Filter,
  RefreshCw,
  XCircle,
  CheckSquare,
  Square,
  AlertTriangle,
  ArrowUpDown,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { useRealtime } from '../hooks/useRealtime.ts';
import { ConnectionBanner, RealtimeIndicatorPill } from '../components/ui/ConnectionBanner.tsx';

interface KitchenItem {
  id: string;
  menuItemId: string;
  name: string;
  variantName?: string | null;
  quantity: number;
  status: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  notes?: string | null;
  version: number;
  stationId: string;
  stationName: string;
  stationType: string;
  addons: string[];
  preparedAt?: string | null;
  readyAt?: string | null;
  elapsedMinutes: number;
}

interface KitchenTicket {
  orderId: string;
  orderNumber: number;
  tableId: string;
  tableNumber: number;
  hallName: string;
  orderStatus: string;
  orderNotes?: string | null;
  orderCreatedAt: string;
  elapsedMinutes: number;
  items: KitchenItem[];
}

interface StationOption {
  id: string;
  name: string;
  type: string;
}

export const KitchenView: React.FC = () => {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACCEPTED' | 'PREPARING' | 'READY'>('ALL');
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('oldest');
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem('menurest_token'));
  const [restaurantId, setRestaurantId] = useState<string>(
    localStorage.getItem('menurest_restaurant_id') || 'rayhon-chilonzor'
  );

  // Selected items for bulk action
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // "Tayyorlab bo'lmaydi" Modal state
  const [cannotPrepareItem, setCannotPrepareItem] = useState<{ id: string; name: string } | null>(null);
  const [cannotPrepareReason, setCannotPrepareReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Demo Login
  const handleDemoLogin = async (phone: string) => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password: 'Demo12345!' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('menurest_token', data.data.token);
        if (data.data.user.memberships?.[0]?.restaurant?.id) {
          localStorage.setItem('menurest_restaurant_id', data.data.user.memberships[0].restaurant.id);
          setRestaurantId(data.data.user.memberships[0].restaurant.id);
        }
        setToken(data.data.token);
        setSuccessMessage(`${data.data.user.fullName} sifatida kirdingiz`);
      } else {
        setErrorMessage(data.error?.message || 'Login xatosi');
      }
    } catch {
      setErrorMessage('Server bilan aloqa uzildi');
    } finally {
      setLoading(false);
    }
  };

  // Stansiyalarni yuklash
  const fetchStations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/kds/stations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStations(data.data.stations || []);
      }
    } catch {
      // Offline fallback
    }
  }, [restaurantId, token]);

  // Chiptalarni yuklash
  const fetchTickets = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setIsRefreshing(true);
      const queryParams = new URLSearchParams();
      if (selectedStation !== 'all') queryParams.set('stationId', selectedStation);
      if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
      queryParams.set('sort', sortOrder);

      const res = await fetch(
        `/api/v1/restaurants/${restaurantId}/kds/tickets?${queryParams.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setTickets(data.data.tickets || []);
      } else if (res.status === 403) {
        setErrorMessage('Ushbu stansiyaga kirish huquqingiz yo\'q');
      }
    } catch {
      // Xato
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [restaurantId, selectedStation, statusFilter, sortOrder, token]);

  // Jonli yangilanish (SSE) va ulanish nazorati
  const { status, soundEnabled, toggleSound } = useRealtime({
    restaurantId,
    enabled: !!token,
    onReconnect: fetchTickets,
    onEvent: () => {
      fetchTickets();
    },
  });

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Taom holatini o'zgartirish (Prepare yoki Ready)
  const handleItemAction = async (itemId: string, action: 'prepare' | 'ready') => {
    if (!token) return;
    try {
      setActionLoading(true);
      setErrorMessage(null);

      const res = await fetch(`/api/v1/restaurants/${restaurantId}/kds/items/${itemId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(
          action === 'prepare' ? 'Taom pishirilishga olindi' : 'Taom tayyor deb belgilandi'
        );
        fetchTickets();
      } else {
        setErrorMessage(data.error?.message || 'Amalni bajarib bo\'lmadi');
      }
    } catch {
      setErrorMessage('Server bilan aloqa uzildi');
    } finally {
      setActionLoading(false);
    }
  };

  // "Tayyorlab bo'lmaydi" yuborish
  const handleCannotPrepareSubmit = async () => {
    if (!cannotPrepareItem || !cannotPrepareReason.trim() || !token) return;
    try {
      setActionLoading(true);
      setErrorMessage(null);

      const res = await fetch(
        `/api/v1/restaurants/${restaurantId}/kds/items/${cannotPrepareItem.id}/cannot-prepare`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: cannotPrepareReason.trim() }),
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage('Xabar ofitsiant va menejerga yetkazildi');
        setCannotPrepareItem(null);
        setCannotPrepareReason('');
        fetchTickets();
      } else {
        setErrorMessage(data.error?.message || 'Xatolik yuz berdi');
      }
    } catch {
      setErrorMessage('Server bilan aloqa uzildi');
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk status update
  const handleBulkUpdate = async (targetStatus: 'PREPARING' | 'READY') => {
    if (selectedItemIds.size === 0 || !token) return;
    try {
      setActionLoading(true);
      setErrorMessage(null);

      const res = await fetch(`/api/v1/restaurants/${restaurantId}/kds/items/bulk-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itemIds: Array.from(selectedItemIds),
          targetStatus,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`${data.data.updatedCount} ta taom holati yangilandi`);
        setSelectedItemIds(new Set());
        fetchTickets();
      } else {
        setErrorMessage(data.error?.message || 'Bulk amalda xatolik');
      }
    } catch {
      setErrorMessage('Server bilan aloqa uzildi');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleItemSelect = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col font-sans">
      {/* Offline Ogohlantirish Paneli */}
      <ConnectionBanner
        status={status}
        onManualRefresh={fetchTickets}
      />

      {/* KDS Header */}
      <header className="bg-brand-900 text-white px-4 sm:px-6 py-3.5 shadow-md border-b border-brand-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-800 flex items-center justify-center border border-brand-700">
              <ChefHat className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">KDS Oshxona & Bar Displeyi</h1>
                <RealtimeIndicatorPill
                  status={status}
                  soundEnabled={soundEnabled}
                  onToggleSound={toggleSound}
                />
              </div>
              <p className="text-xs text-brand-200">Katta ekran/planshet rejimi • Masofadan aniq o'qiladigan chiptalar</p>
            </div>
          </div>

          {/* Quick Refresh & Station Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchTickets}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-brand-800 hover:bg-brand-700 text-brand-100 border border-brand-700 flex items-center gap-1.5 text-xs font-semibold transition-all min-h-[44px]"
              title="Yangilash"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Yangilash</span>
            </button>

            {/* Station Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedStation('all')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[44px] ${
                  selectedStation === 'all'
                    ? 'bg-emerald-500 text-brand-950 shadow-md font-extrabold'
                    : 'bg-brand-800 text-brand-100 hover:bg-brand-700 border border-brand-700'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Barchasi</span>
              </button>

              {stations.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedStation(st.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[44px] ${
                    selectedStation === st.id
                      ? 'bg-emerald-500 text-brand-950 shadow-md font-extrabold'
                      : 'bg-brand-800 text-brand-100 hover:bg-brand-700 border border-brand-700'
                  }`}
                >
                  {st.type === 'BAR' ? (
                    <Wine className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                  )}
                  <span>{st.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Subheader: Status filter tabs & Sort */}
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-brand-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1 bg-brand-950/60 p-1 rounded-xl border border-brand-800">
            {(
              [
                { id: 'ALL', label: 'Barchasi' },
                { id: 'ACCEPTED', label: 'Tasdiqlangan' },
                { id: 'PREPARING', label: 'Pishmoqda' },
                { id: 'READY', label: 'Tayyor' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all min-h-[36px] ${
                  statusFilter === tab.id
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'text-brand-300 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortOrder((prev) => (prev === 'oldest' ? 'newest' : 'oldest'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-800 hover:bg-brand-700 text-brand-200 border border-brand-700 min-h-[36px] font-semibold"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortOrder === 'oldest' ? 'Shoshilinch (eng qadimiy)' : 'Yangi tushganlar'}</span>
            </button>

            {/* Bulk actions if items selected */}
            {selectedItemIds.size > 0 && (
              <div className="flex items-center gap-1.5 bg-emerald-950/80 px-2 py-1 rounded-xl border border-emerald-700/60">
                <span className="font-bold text-emerald-300 px-1">{selectedItemIds.size} ta</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkUpdate('PREPARING')}
                  disabled={actionLoading}
                  className="text-xs h-8 text-blue-200 border-blue-500 hover:bg-blue-900/50"
                >
                  Pishirish
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleBulkUpdate('READY')}
                  disabled={actionLoading}
                  className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500"
                >
                  ✓ Tayyor
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* Banner Messages */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Demo Login Banner if not authenticated */}
        {!token && (
          <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-amber-900">KDS Displeyi Sinovi Uchun Kirish</h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Stansiyalar izolyatsiyasi va real-vaqt buyurtmalarni tekshirish uchun xodim hisobiga kiring:
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleDemoLogin('+998906666666')}
                className="bg-brand hover:bg-brand-hover text-xs"
              >
                Oshpaz (Cook) sifatida kirish
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDemoLogin('+998902222222')}
                className="text-xs"
              >
                Menejer sifatida kirish
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 text-brand animate-spin mx-auto mb-3" />
            <p className="text-sm text-ink-secondary">Oshxona chiptalari yuklanmoqda...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 bg-surface rounded-2xl border border-line p-8 shadow-subtle">
            <CheckCircle2 className="w-12 h-12 text-brand mx-auto mb-3" />
            <h3 className="text-lg font-bold text-ink-main">Barcha buyurtmalar tayyor!</h3>
            <p className="text-sm text-ink-secondary mt-1">
              Hozirda tanlangan stansiyada kutilayotgan yoki pishirilayotgan taomlar mavjud emas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tickets.map((ticket) => {
              const isUrgent = ticket.elapsedMinutes >= 20;
              const isWarning = ticket.elapsedMinutes >= 10 && ticket.elapsedMinutes < 20;
              const allReady = ticket.items.every((i) => i.status === 'READY');

              return (
                <div
                  key={ticket.orderId}
                  className={`flex flex-col bg-surface rounded-2xl border-2 shadow-subtle overflow-hidden transition-all ${
                    allReady
                      ? 'border-emerald-300 opacity-80'
                      : isUrgent
                      ? 'border-red-400 ring-2 ring-red-200'
                      : isWarning
                      ? 'border-amber-400'
                      : 'border-line'
                  }`}
                >
                  {/* Ticket Header */}
                  <div
                    className={`px-4 py-3 border-b flex items-center justify-between ${
                      isUrgent
                        ? 'bg-red-50/80 border-red-200'
                        : isWarning
                        ? 'bg-amber-50/80 border-amber-200'
                        : 'bg-bg border-line'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-ink-main">Stol {ticket.tableNumber}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-surface border border-line text-ink-secondary">
                          {ticket.hallName}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-ink-secondary font-medium">
                        Buyurtma #{ticket.orderNumber}
                      </span>
                    </div>

                    <div className="text-right">
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-mono text-xs font-bold ${
                          isUrgent
                            ? 'bg-red-600 text-white animate-pulse'
                            : isWarning
                            ? 'bg-amber-600 text-white'
                            : 'bg-surface text-ink-main border border-line'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{ticket.elapsedMinutes} daq</span>
                      </div>
                      <span className="text-[10px] text-ink-secondary mt-0.5 block">
                        {new Date(ticket.orderCreatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Order level note if present */}
                  {ticket.orderNotes && (
                    <div className="px-4 py-1.5 bg-blue-50/70 border-b border-blue-100 text-xs text-blue-900 flex items-center gap-1.5">
                      <UtensilsCrossed className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                      <span className="font-semibold">Buyurtma izohi:</span>
                      <span className="italic">{ticket.orderNotes}</span>
                    </div>
                  )}

                  {/* Items List */}
                  <div className="p-4 flex-1 space-y-3.5 divide-y divide-line/60">
                    {ticket.items.map((item, idx) => {
                      const itemReady = item.status === 'READY';
                      const itemPreparing = item.status === 'PREPARING';
                      const isSelected = selectedItemIds.has(item.id);

                      return (
                        <div key={item.id} className={`${idx > 0 ? 'pt-3' : ''} flex flex-col gap-2`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              {/* Selection checkbox for bulk */}
                              {!itemReady && (
                                <button
                                  onClick={() => toggleItemSelect(item.id)}
                                  className="mt-1 text-ink-secondary hover:text-brand"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-brand" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              )}

                              <span
                                className={`text-base font-black px-2.5 py-1 rounded-xl shrink-0 ${
                                  itemReady
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : itemPreparing
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {item.quantity}x
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4
                                    className={`text-base font-extrabold leading-snug ${
                                      itemReady ? 'line-through text-ink-secondary' : 'text-ink-main'
                                    }`}
                                  >
                                    {item.name}
                                  </h4>
                                  {item.variantName && (
                                    <span className="text-xs px-2 py-0.5 rounded-md bg-bg font-bold border border-line text-brand">
                                      {item.variantName}
                                    </span>
                                  )}
                                </div>

                                {item.addons && item.addons.length > 0 && (
                                  <p className="text-xs font-semibold text-brand mt-0.5">
                                    + {item.addons.join(', ')}
                                  </p>
                                )}

                                {/* Isolated Dish Notes */}
                                {item.notes && (
                                  <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-900 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                    <span>
                                      <strong>Izoh:</strong> {item.notes}
                                    </span>
                                  </div>
                                )}

                                <span className="text-[10px] text-ink-secondary mt-1 block font-mono">
                                  Stansiya: {item.stationName}
                                </span>
                              </div>
                            </div>

                            {/* Item Status Badge */}
                            <Badge
                              variant={itemReady ? 'success' : itemPreparing ? 'info' : 'warning'}
                              size="sm"
                            >
                              {itemReady ? 'Tayyor' : itemPreparing ? 'Pishmoqda' : 'Kutmoqda'}
                            </Badge>
                          </div>

                          {/* Item Action Buttons */}
                          <div className="flex items-center gap-2 justify-end pt-1 flex-wrap">
                            {/* "Tayyorlab bo'lmaydi" Button */}
                            {!itemReady && (
                              <button
                                onClick={() =>
                                  setCannotPrepareItem({ id: item.id, name: item.name })
                                }
                                className="text-xs text-red-600 hover:text-red-800 font-bold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                Tayyorlab bo'lmaydi
                              </button>
                            )}

                            {/* Pishirish (Prepare) Button */}
                            {item.status === 'ACCEPTED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionLoading}
                                onClick={() => handleItemAction(item.id, 'prepare')}
                                className="text-xs h-9 min-h-[36px]"
                              >
                                Pishirish
                              </Button>
                            )}

                            {/* Tayyor (Ready) Button */}
                            {item.status !== 'READY' && (
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={actionLoading}
                                onClick={() => handleItemAction(item.id, 'ready')}
                                className="text-xs h-9 min-h-[36px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                              >
                                ✓ Tayyor
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ticket Footer Action */}
                  <div className="p-3 bg-bg/50 border-t border-line flex items-center justify-between gap-2">
                    <span className="text-xs text-ink-secondary font-medium">
                      Jami: {ticket.items.length} ta taom
                    </span>
                    {!allReady && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          const readyIds = ticket.items
                            .filter((i) => i.status !== 'READY')
                            .map((i) => i.id);
                          readyIds.forEach((id) => handleItemAction(id, 'ready'));
                        }}
                        className="text-xs py-2 bg-brand hover:bg-brand-hover text-white shadow-sm"
                      >
                        Barchasini Tayyorlash
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* "Tayyorlab bo'lmaydi" Modal */}
      <Dialog
        isOpen={Boolean(cannotPrepareItem)}
        onClose={() => setCannotPrepareItem(null)}
        title="Taomni Tayyorlab Bo'lmaydi"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            <strong>{cannotPrepareItem?.name}</strong> taomini nima sababdan tayyorlab bo'lmayotganini
            ko'rsating. Ushbu xabar darhol ofitsiant va menejer paneliga yetkaziladi:
          </p>

          <div>
            <label className="block text-xs font-bold text-ink-main mb-1.5">
              Rad etish sababi (majburiy)
            </label>
            <textarea
              value={cannotPrepareReason}
              onChange={(e) => setCannotPrepareReason(e.target.value)}
              placeholder="Masalan: Masalliq tugagan, go'sht qolmagan, gaz o'chgan..."
              className="w-full px-3 py-2 border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand min-h-[90px]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCannotPrepareItem(null)}
              disabled={actionLoading}
            >
              Bekor qilish
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleCannotPrepareSubmit}
              disabled={actionLoading || !cannotPrepareReason.trim()}
            >
              Xabar Yuborish
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
