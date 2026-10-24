import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Layers,
  UtensilsCrossed,
  Settings,
  ShieldCheck,
  FileText,
  Download,
  AlertTriangle,
  Clock,
  PhoneCall,
  CheckCircle2,
  RefreshCw,
  Store,
  Plus,
  Menu as MenuIcon,
  Search,
  X,
  RotateCcw,
  Check,
  UserCheck,
  Percent,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { Money } from '../components/ui/Money.tsx';
import { Status } from '../components/ui/Status.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Input } from '../components/ui/Input.tsx';
import { ImageFallback } from '../components/ui/ImageFallback.tsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.tsx';
import { MenuItemModal, type MenuItemFormData } from '../components/menu/MenuItemModal.tsx';
import { CategoryModal } from '../components/menu/CategoryModal.tsx';
import { StaffModal, StaffFormData } from '../components/staff/StaffModal.tsx';
import { useRealtime } from '../hooks/useRealtime.ts';
import { ConnectionBanner, RealtimeIndicatorPill } from '../components/ui/ConnectionBanner.tsx';
import { Role } from '@menurest/shared';

interface ManagerViewProps {
  initialRole?: 'BOSS' | 'MANAGER';
  activeRestaurantId?: string;
}

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp('(^|;\\s*)menurest_csrf=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '';
}

export const ManagerView: React.FC<ManagerViewProps> = ({
  initialRole = 'BOSS',
  activeRestaurantId,
}) => {
  const [activeRole, setActiveRole] = useState<'BOSS' | 'MANAGER'>(initialRole);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'operations' | 'map' | 'menu' | 'staff' | 'reports' | 'settings' | 'audit'>('overview');

  // Restoran identifikatori va nomi
  const [restaurantId, setRestaurantId] = useState<string>(activeRestaurantId || 'rayhon-chilonzor');
  const [restaurantName, setRestaurantName] = useState<string>('Rayhon Milliy Taomlar');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  // 1. Boss Dashboard Metrics (Server Aggregations)
  const [bossMetrics, setBossMetrics] = useState<{
    todayOrdersTotalTiyin: bigint;
    todayDiscountsTiyin: bigint;
    todayServiceFeeTiyin: bigint;
    todayPaymentsTiyin: bigint;
    todayRefundsTiyin: bigint;
    todayNetRevenueTiyin: bigint;
    openDebtTiyin: bigint;
    refundDueTiyin: bigint;
    activeVisitsCount: number;
    activeTablesCount: number;
    date: string;
  }>({
    todayOrdersTotalTiyin: 0n,
    todayDiscountsTiyin: 0n,
    todayServiceFeeTiyin: 0n,
    todayPaymentsTiyin: 0n,
    todayRefundsTiyin: 0n,
    todayNetRevenueTiyin: 0n,
    openDebtTiyin: 0n,
    refundDueTiyin: 0n,
    activeVisitsCount: 0,
    activeTablesCount: 0,
    date: new Date().toISOString().slice(0, 10),
  });

  // 2. Manager Operations Summary
  const [operationsSummary, setOperationsSummary] = useState<{
    tables: { total: number; free: number; occupied: number; dirty: number; occupancyRate: number };
    orders: { totalToday: number; activeCount: number; newCount: number; confirmedCount: number; preparingCount: number; readyCount: number; delayedCount: number };
    unansweredCallsCount: number;
    pendingCancellationsCount: number;
  }>({
    tables: { total: 10, free: 6, occupied: 3, dirty: 1, occupancyRate: 30 },
    orders: { totalToday: 0, activeCount: 0, newCount: 0, confirmedCount: 0, preparingCount: 0, readyCount: 0, delayedCount: 0 },
    unansweredCallsCount: 0,
    pendingCancellationsCount: 0,
  });

  // 3. Jonli Zallar va Stollar
  const [halls, setHalls] = useState<{ id: string; name: string }[]>([
    { id: 'all', name: 'Barcha Zallar' },
    { id: 'main', name: 'Asosiy Zal' },
    { id: 'terrace', name: 'Yozgi Terassa' },
  ]);
  const [selectedHallId, setSelectedHallId] = useState<string>('all');
  const [tablesList, setTablesList] = useState<any[]>([
    { id: 't1', number: 1, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 4, status: 'OCCUPIED', assignedWaiter: { fullName: 'Jahongir R.' }, activeMinutes: 45, totalTiyin: 48500000n },
    { id: 't2', number: 2, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 4, status: 'FREE' },
    { id: 't3', number: 3, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 6, status: 'OCCUPIED', assignedWaiter: { fullName: 'Ali V.' }, activeMinutes: 20, totalTiyin: 12000000n },
    { id: 't4', number: 4, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 2, status: 'DIRTY' },
    { id: 't5', number: 5, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 4, status: 'FREE' },
    { id: 't6', number: 6, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 8, status: 'OCCUPIED', assignedWaiter: { fullName: 'Jahongir R.' }, activeMinutes: 75, totalTiyin: 92000000n },
    { id: 't7', number: 7, hall: { id: 'terrace', name: 'Yozgi Terassa' }, capacity: 4, status: 'FREE' },
    { id: 't8', number: 8, hall: { id: 'terrace', name: 'Yozgi Terassa' }, capacity: 4, status: 'FREE' },
    { id: 't9', number: 9, hall: { id: 'terrace', name: 'Yozgi Terassa' }, capacity: 6, status: 'FREE' },
    { id: 't10', number: 10, hall: { id: 'terrace', name: 'Yozgi Terassa' }, capacity: 2, status: 'FREE' },
  ]);
  const [assignWaiterModalOpen, setAssignWaiterModalOpen] = useState(false);
  const [selectedTableForWaiter, setSelectedTableForWaiter] = useState<any | null>(null);

  // 4. Operatsiyalar: Kechikkan buyurtmalar, javobsiz chaqiruvlar va bekor qilishlar
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [liveCalls, setLiveCalls] = useState<any[]>([]);
  const [reassignCallModalOpen, setReassignCallModalOpen] = useState(false);
  const [selectedCallForReassign, setSelectedCallForReassign] = useState<any | null>(null);

  // 5. Menejer Vakolatidagi Tasdiqlar (Approvals)
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountForm, setDiscountForm] = useState<{ visitId: string; amountUzs: number; percent: number; isPercent: boolean; reason: string }>({
    visitId: '',
    amountUzs: 10000,
    percent: 10,
    isPercent: true,
    reason: 'Menejer maxsus chegirmasi',
  });
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundForm, setRefundForm] = useState<{ paymentId: string; amountUzs: number; reason: string }>({
    paymentId: '',
    amountUzs: 20000,
    reason: 'Mijoz shikoyati bo\'yicha qaytarish',
  });

  // 6. Xodimlar Ro'yxati
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffFormData | null>(null);

  // 7. Restoran Sozlamalari
  const [settingsData, setSettingsData] = useState<{
    name: string;
    phone: string;
    address: string;
    logoUrl: string;
    bannerUrl: string;
    openingHours: string;
    defaultLanguage: string;
    serviceChargeBps: number;
  }>({
    name: 'Rayhon Milliy Taomlar',
    phone: '+998 71 200 11 22',
    address: 'Toshkent sh., Chilonzor tumani, 9-mavze',
    logoUrl: '',
    bannerUrl: '',
    openingHours: '09:00 - 23:00',
    defaultLanguage: 'uz',
    serviceChargeBps: 1000,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // 8. Hisobotlar (Reports)
  const [reportDateFrom, setReportDateFrom] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reportDateTo, setReportDateTo] = useState<string>(new Date().toISOString().slice(0, 10));
  const [detailedReports, setDetailedReports] = useState<any | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);

  // 9. Menyu va Availability
  const [categories, setCategories] = useState<any[]>([
    { id: 'cat-milliy', name: 'Milliy Taomlar', sortOrder: 1, isVisible: true },
    { id: 'cat-kabob', name: 'Kabob va Gril', sortOrder: 2, isVisible: true },
    { id: 'cat-shorva', name: 'Sho\'rvalar', sortOrder: 3, isVisible: true },
    { id: 'cat-salat', name: 'Salatlar va Gazaklar', sortOrder: 4, isVisible: true },
    { id: 'cat-ichimlik', name: 'Ichimliklar', sortOrder: 5, isVisible: true },
  ]);
  const [dishes, setDishes] = useState<any[]>([
    {
      id: 'd1',
      name: "To'y Oshi",
      nameRu: 'Свадебный плов',
      desc: "Devzira guruch, barra go'sht, noxat va mayiz",
      categoryId: 'cat-milliy',
      stationId: 'st-kitchen',
      priceTiyin: 4200000n,
      imageUrl: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      version: 1,
    },
    {
      id: 'd2',
      name: 'Qozon Kabob',
      nameRu: 'Казан-кабоб',
      desc: "Qozonda qizargan barra qo'y go'shti va kartoshka",
      categoryId: 'cat-milliy',
      stationId: 'st-kitchen',
      priceTiyin: 6500000n,
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      version: 1,
    },
    {
      id: 'd3',
      name: 'Mastava',
      nameRu: 'Мастава',
      desc: "Qatiq va ko'katlar bilan klassik mastava",
      categoryId: 'cat-shorva',
      stationId: 'st-kitchen',
      priceTiyin: 3200000n,
      isAvailable: true,
      version: 1,
    },
    {
      id: 'd4',
      name: 'Ko\'k Choy',
      nameRu: 'Зеленый чай',
      desc: "Chinnigul va limon bilan damlangan ko'k choy",
      categoryId: 'cat-ichimlik',
      stationId: 'st-bar',
      priceTiyin: 800000n,
      isAvailable: true,
      version: 1,
    },
  ]);
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedMenuCategory, setSelectedMenuCategory] = useState('all');
  const [menuItemModalOpen, setMenuItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemFormData | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  // 10. Audit Jurnali
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [loadingAudit, setLoadingAudit] = useState(false);

  const stations = [
    { id: 'st-kitchen', name: 'Issiq Oshxona' },
    { id: 'st-bar', name: 'Ichimliklar Bari' },
  ];

  // Restoran va Foydalanuvchi ma'lumotlarini dastlab aniqlash
  useEffect(() => {
    async function resolveAuth() {
      try {
        const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.permissions) setUserPermissions(json.data.permissions);
          if (json.data.activeRestaurant?.id) {
            setRestaurantId(json.data.activeRestaurant.id);
            if (json.data.activeRestaurant.name) setRestaurantName(json.data.activeRestaurant.name);
          }
        }
      } catch (e) {
        console.warn('Auth resolve notice:', e);
      }
    }
    resolveAuth();
  }, [activeRestaurantId]);

  // REST orqali ma'lumotlarni yuklash
  const loadDashboardMetrics = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/reports/dashboard`, { credentials: 'include' });
      const json = await res.json();
      if (json.success && json.data) {
        setBossMetrics({
          todayOrdersTotalTiyin: BigInt(json.data.todayOrdersTotalTiyin || 0),
          todayDiscountsTiyin: BigInt(json.data.todayDiscountsTiyin || 0),
          todayServiceFeeTiyin: BigInt(json.data.todayServiceFeeTiyin || json.data.todayServiceChargeTiyin || 0),
          todayPaymentsTiyin: BigInt(json.data.todayPaymentsTiyin || 0),
          todayRefundsTiyin: BigInt(json.data.todayRefundsTiyin || 0),
          todayNetRevenueTiyin: BigInt(json.data.todayNetRevenueTiyin || 0),
          openDebtTiyin: BigInt(json.data.openDebtTiyin || 0),
          refundDueTiyin: BigInt(json.data.refundDueTiyin || 0),
          activeVisitsCount: json.data.activeVisitsCount || 0,
          activeTablesCount: json.data.activeTablesCount || 0,
          date: json.data.date,
        });
      }
    } catch (e) {
      console.warn('Dashboard metrics fetch warning:', e);
    }
  }, [restaurantId]);

  const loadOperationsSummary = useCallback(async () => {
    try {
      const [resOps, resWaiter] = await Promise.all([
        fetch(`/api/v1/restaurants/${restaurantId}/reports/operations`, { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        fetch(`/api/v1/restaurants/${restaurantId}/waiter/dashboard`, { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      ]);

      if (resOps?.success && resOps.data) {
        setOperationsSummary(resOps.data);
      }
      if (resWaiter?.success && resWaiter.data) {
        if (Array.isArray(resWaiter.data.pendingOrders)) setLiveOrders(resWaiter.data.pendingOrders);
        if (Array.isArray(resWaiter.data.openCalls)) setLiveCalls(resWaiter.data.openCalls);
      }
    } catch (e) {
      console.warn('Operations summary fetch warning:', e);
    }
  }, [restaurantId]);

  const loadTables = useCallback(async () => {
    try {
      const [resTables, resHalls] = await Promise.all([
        fetch(`/api/v1/restaurants/${restaurantId}/tables`, { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        fetch(`/api/v1/restaurants/${restaurantId}/halls`, { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      ]);

      if (resHalls?.success && Array.isArray(resHalls.data) && resHalls.data.length > 0) {
        setHalls([{ id: 'all', name: 'Barcha Zallar' }, ...resHalls.data]);
      }
      if (resTables?.success && Array.isArray(resTables.data) && resTables.data.length > 0) {
        setTablesList(resTables.data);
      }
    } catch (e) {
      console.warn('Tables fetch warning:', e);
    }
  }, [restaurantId]);

  const loadStaffList = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/staff`, { credentials: 'include' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setStaffList(json.data);
      }
    } catch (e) {
      console.warn('Staff fetch warning:', e);
    }
  }, [restaurantId]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/settings`, { credentials: 'include' });
      const json = await res.json();
      if (json.success && json.data) {
        setSettingsData({
          name: json.data.name || 'Rayhon Milliy Taomlar',
          phone: json.data.phone || '+998 71 200 11 22',
          address: json.data.address || '',
          logoUrl: json.data.logoUrl || '',
          bannerUrl: json.data.bannerUrl || '',
          openingHours: json.data.openingHours || '09:00 - 23:00',
          defaultLanguage: json.data.defaultLanguage || 'uz',
          serviceChargeBps: json.data.serviceChargeBps || 1000,
        });
      }
    } catch (e) {
      console.warn('Settings fetch warning:', e);
    }
  }, [restaurantId]);

  const loadMenuItems = useCallback(async () => {
    try {
      const [resCats, resItems] = await Promise.all([
        fetch(`/api/v1/restaurants/${restaurantId}/menu/categories`, { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        fetch(`/api/v1/restaurants/${restaurantId}/menu/items`, { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      ]);
      if (resCats?.success && Array.isArray(resCats.data)) {
        setCategories(resCats.data);
      }
      if (resItems?.success && Array.isArray(resItems.data) && resItems.data.length > 0) {
        setDishes(
          resItems.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            nameRu: item.translations?.find((t: any) => t.language === 'ru')?.name || '',
            desc: item.description,
            categoryId: item.categoryId,
            stationId: item.stationId,
            priceTiyin: BigInt(item.basePriceTiyin || 0),
            imageUrl: item.imageUrl,
            isAvailable: item.isAvailable,
            version: item.version,
            allergens: item.allergens || [],
          }))
        );
      }
    } catch (e) {
      console.warn('Menu fetch warning:', e);
    }
  }, [restaurantId]);

  const loadDetailedReports = useCallback(async (from?: string, to?: string) => {
    try {
      setLoadingReports(true);
      const url = `/api/v1/restaurants/${restaurantId}/reports/detailed?from=${from || reportDateFrom}&to=${to || reportDateTo}`;
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      if (json.success && json.data) {
        setDetailedReports(json.data);
      }
    } catch (e) {
      console.warn('Detailed reports fetch warning:', e);
    } finally {
      setLoadingReports(false);
    }
  }, [restaurantId, reportDateFrom, reportDateTo]);

  const loadAuditLogs = useCallback(async (page: number, action?: string) => {
    try {
      setLoadingAudit(true);
      const url = `/api/v1/restaurants/${restaurantId}/audit?page=${page}&limit=15${action ? `&action=${action}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      if (json.success && json.data) {
        setAuditLogs(json.data.logs || []);
        setAuditPage(json.data.page || 1);
        setAuditTotalPages(json.data.totalPages || 1);
      }
    } catch (e) {
      console.warn('Audit logs fetch warning:', e);
    } finally {
      setLoadingAudit(false);
    }
  }, [restaurantId]);

  // Realtime hodisalarni qabul qilish
  const handleRealtimeEvent = useCallback((event: any) => {
    if (
      event.type.startsWith('order.') ||
      event.type.startsWith('call.') ||
      event.type.startsWith('payment.') ||
      event.type.startsWith('bill.') ||
      event.type.startsWith('table.')
    ) {
      loadDashboardMetrics();
      loadOperationsSummary();
      loadTables();
    }
  }, [loadDashboardMetrics, loadOperationsSummary, loadTables]);

  const { status, soundEnabled, toggleSound } = useRealtime({
    restaurantId,
    onEvent: handleRealtimeEvent,
  });

  // Initial Data Load
  useEffect(() => {
    loadDashboardMetrics();
    loadOperationsSummary();
    loadTables();
    loadStaffList();
    loadSettings();
    loadMenuItems();
  }, [loadDashboardMetrics, loadOperationsSummary, loadTables, loadStaffList, loadSettings, loadMenuItems]);

  useEffect(() => {
    if (activeTab === 'reports') loadDetailedReports();
    if (activeTab === 'audit') loadAuditLogs(1, auditActionFilter);
  }, [activeTab, loadDetailedReports, loadAuditLogs, auditActionFilter]);

  // Restoran sozlamalarini saqlash
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setSettingsSuccess(null);
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify(settingsData),
      });
      const json = await res.json();
      if (json.success) {
        setSettingsSuccess("Restoran sozlamalari muvaffaqiyatli saqlandi! Ochiq tashriflar xizmat haqi snapshotiga daxl qilinmadi.");
        setTimeout(() => setSettingsSuccess(null), 5000);
      } else {
        alert(json.error?.message || 'Xatolik yuz berdi');
      }
    } catch (err: any) {
      alert('Sozlamalarni saqlashda xatolik: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Stolga ofitsiant biriktirish
  const handleAssignWaiter = async (tableId: string, waiterId: string | null) => {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/tables/${tableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ assignedWaiterId: waiterId }),
      });
      const json = await res.json();
      if (json.success) {
        setAssignWaiterModalOpen(false);
        loadTables();
      } else {
        alert(json.error?.message || 'Ofitsiantni biriktirishda xatolik');
      }
    } catch (e: any) {
      alert('Aloqa xatosi: ' + e.message);
    }
  };

  // Taom mavjudligini o'zgartirish (Stop-List)
  const handleToggleDishAvailability = async (dishId: string, currentVal: boolean) => {
    try {
      setDishes((prev) => prev.map((d) => (d.id === dishId ? { ...d, isAvailable: !currentVal } : d)));
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/menu/items/${dishId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ isAvailable: !currentVal }),
      });
      const json = await res.json();
      if (!json.success) {
        // Rollback if server rejected
        setDishes((prev) => prev.map((d) => (d.id === dishId ? { ...d, isAvailable: currentVal } : d)));
        alert(json.error?.message || 'Mavjudlikni o\'zgartirish rad etildi');
      }
    } catch (e: any) {
      setDishes((prev) => prev.map((d) => (d.id === dishId ? { ...d, isAvailable: currentVal } : d)));
      alert('Aloqa xatosi: ' + e.message);
    }
  };

  // Buyurtmani tasdiqlash
  const handleConfirmOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/waiter/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        loadOperationsSummary();
      } else {
        alert(json.error?.message || 'Buyurtmani tasdiqlashda xatolik');
      }
    } catch (e: any) {
      alert('Aloqa xatosi: ' + e.message);
    }
  };

  // Buyurtmani sabab bilan rad etish
  const handleRejectOrder = async (orderId: string) => {
    const reason = prompt('Buyurtmani bekor qilish sababini kiriting (majburiy):');
    if (!reason || !reason.trim()) return;
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/waiter/orders/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        loadOperationsSummary();
      } else {
        alert(json.error?.message || 'Bekor qilishda xatolik');
      }
    } catch (e: any) {
      alert('Aloqa xatosi: ' + e.message);
    }
  };

  // Xizmat chaqiruvini qayta biriktirish
  const handleReassignCall = async (callId: string, newWaiterId: string) => {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/waiter/service-calls/${callId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ newWaiterId }),
      });
      const json = await res.json();
      if (json.success) {
        setReassignCallModalOpen(false);
        loadOperationsSummary();
      } else {
        alert(json.error?.message || 'Qayta biriktirishda xatolik');
      }
    } catch (e: any) {
      alert('Aloqa xatosi: ' + e.message);
    }
  };

  // Xizmat chaqiruvini hal qilish (Resolve)
  const handleResolveCall = async (callId: string) => {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/waiter/service-calls/${callId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        loadOperationsSummary();
      } else {
        alert(json.error?.message || 'Chaqiruvni hal qilishda xatolik');
      }
    } catch (e: any) {
      alert('Aloqa xatosi: ' + e.message);
    }
  };

  // Chegirma kiritish (Discounts approve)
  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amountTiyin = discountForm.isPercent
        ? undefined
        : BigInt(discountForm.amountUzs * 100);
      const percentageBps = discountForm.isPercent ? discountForm.percent * 100 : undefined;

      const res = await fetch(`/api/v1/restaurants/${restaurantId}/billing/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({
          visitId: discountForm.visitId,
          type: 'DISCOUNT',
          amountTiyin: amountTiyin !== undefined ? amountTiyin.toString() : '0',
          percentageBps,
          reason: discountForm.reason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert('Chegirma muvaffaqiyatli kiritildi!');
        setDiscountModalOpen(false);
        loadDashboardMetrics();
      } else {
        alert(json.error?.message || 'Chegirma kiritish rad etildi (vakolat yetarli emas)');
      }
    } catch (e: any) {
      alert('Aloqa xatosi: ' + e.message);
    }
  };

  // Refund tasdiqlash (Refunds approve)
  const handleApproveRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/billing/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({
          paymentId: refundForm.paymentId,
          amountTiyin: (BigInt(refundForm.amountUzs) * 100n).toString(),
          reason: refundForm.reason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert('Pul qaytarish muvaffaqiyatli amalga oshirildi!');
        setRefundModalOpen(false);
        loadDashboardMetrics();
      } else {
        alert(json.error?.message || 'Refund qilish rad etildi (vakolat yetarli emas)');
      }
    } catch (e: any) {
      alert('Aloqa xatosi: ' + e.message);
    }
  };

  // Xodimni saqlash
  const handleSaveStaff = async (formData: StaffFormData) => {
    const isEdit = Boolean(formData.userId);
    const url = isEdit
      ? `/api/v1/restaurants/${restaurantId}/staff/${formData.userId}`
      : `/api/v1/restaurants/${restaurantId}/staff`;
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
      credentials: 'include',
      body: JSON.stringify(formData),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || 'Xodimni saqlashda xatolik');
    }
    loadStaffList();
  };

  // CSV Audit Eksport
  const handleExportAuditCsv = () => {
    window.open(`/api/v1/restaurants/${restaurantId}/audit/export${auditActionFilter ? `?action=${auditActionFilter}` : ''}`, '_blank');
  };

  const filteredTables = useMemo(() => {
    if (selectedHallId === 'all') return tablesList;
    return tablesList.filter((t) => t.hall?.id === selectedHallId || t.hall === selectedHallId);
  }, [tablesList, selectedHallId]);

  const activeWaiters = useMemo(() => {
    return staffList.filter((s) => s.roles.includes(Role.WAITER) && s.isActive);
  }, [staffList]);

  const filteredDishes = useMemo(() => {
    return dishes.filter((d) => {
      const matchCat = selectedMenuCategory === 'all' || d.categoryId === selectedMenuCategory;
      const matchSearch = !menuSearch || d.name.toLowerCase().includes(menuSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [dishes, selectedMenuCategory, menuSearch]);

  return (
    <div className="min-h-screen bg-bg text-ink-main flex flex-col font-sans">
      <ConnectionBanner status={status} onManualRefresh={loadDashboardMetrics} />

      {/* HEADER */}
      <header className="bg-surface border-b border-line sticky top-10 z-30 shadow-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-xl border border-line text-ink-main hover:bg-bg min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                <Store className="w-5 h-5 text-brand" />
              </div>
              <div>
                <span className="font-extrabold text-ink-main text-lg tracking-tight block">
                  {restaurantName || settingsData.name}
                </span>
                <span className="text-xs text-ink-secondary flex items-center gap-1.5 font-medium">
                  {activeRole === 'BOSS' ? 'Boss Moliyaviy Boshqaruvi' : 'Menejer Operatsion Nazorati'} • {bossMetrics.date}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <RealtimeIndicatorPill status={status} soundEnabled={soundEnabled} onToggleSound={toggleSound} />

            {/* Role Switcher Pill */}
            <div className="bg-bg border border-line rounded-xl p-0.5 flex items-center">
              <button
                onClick={() => { setActiveRole('BOSS'); setActiveTab('overview'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                  activeRole === 'BOSS' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:text-ink-main'
                }`}
              >
                Boss
              </button>
              <button
                onClick={() => { setActiveRole('MANAGER'); setActiveTab('operations'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                  activeRole === 'MANAGER' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:text-ink-main'
                }`}
              >
                Menejer
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        {/* DESKTOP SIDEBAR */}
        <aside className="w-64 shrink-0 hidden lg:block space-y-1">
          <div className="bg-surface rounded-2xl border border-line p-3 shadow-subtle space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'overview' ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Moliyaviy KPI (Boss)</span>
            </button>

            <button
              onClick={() => setActiveTab('operations')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'operations' ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Operatsiyalar (Manager)</span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'map' ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Zal & Stollar Xaritasi</span>
            </button>

            <button
              onClick={() => setActiveTab('menu')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'menu' ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Menyu & Availability</span>
            </button>

            <button
              onClick={() => setActiveTab('staff')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'staff' ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Xodimlar Boshqaruvi</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'reports' ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Hisobotlar & Tahlil</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'settings' ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Restoran Sozlamalari</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'audit' ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Audit Jurnali</span>
            </button>
          </div>
        </aside>

        {/* MAIN VIEW CONTENT */}
        <main className="flex-1 min-w-0 space-y-6">

          {/* TAB 1: OVERVIEW (BOSS FINANCIAL KPI) */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Alert: No fake profit note */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start space-x-3">
                <ShieldCheck className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950 leading-relaxed">
                  <span className="font-bold block text-sm mb-0.5">Haqiqiy Server Aggregatsiyasi (Asia/Tashkent kun chegarasi)</span>
                  Barcha raqamlar serverda PostgreSQL ACID tranzaksiyalari asosida minor unit (tiyin) da hisoblangan.
                  Xarajat va tannarx moduli kiritilmaguncha “sof foyda” raqami ataylab yasalmagan.
                </div>
              </div>

              {/* 8 ta Asosiy Moliyaviy Ko'rsatkich Kartochkalari */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Bugungi buyurtmalar qiymati */}
                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary">
                    <span>Buyurtmalar Qiymati</span>
                    <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700 font-mono text-[10px]">Gross</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-ink-main">
                    <Money amountTiyin={bossMetrics.todayOrdersTotalTiyin} />
                  </div>
                  <p className="text-[11px] text-ink-secondary">Bugungi tasdiqlangan taomlar jami</p>
                </div>

                {/* 2. Yozilgan Chegirmalar */}
                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary">
                    <span>Yozilgan Chegirmalar</span>
                    <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 font-mono text-[10px]">Discount</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-700">
                    <Money amountTiyin={bossMetrics.todayDiscountsTiyin} />
                  </div>
                  <p className="text-[11px] text-ink-secondary">Faqat food subtotaldan chegirilgan</p>
                </div>

                {/* 3. Yozilgan Xizmat Haqi */}
                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary">
                    <span>Xizmat Haqi (Servis)</span>
                    <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 font-mono text-[10px]">{settingsData.serviceChargeBps / 100}%</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-800">
                    <Money amountTiyin={bossMetrics.todayServiceFeeTiyin} />
                  </div>
                  <p className="text-[11px] text-ink-secondary">Chegirmadan keyingi subtotaldan</p>
                </div>

                {/* 4. Qabul Qilingan To'lov */}
                <div className="bg-surface rounded-2xl border border-brand/30 p-5 shadow-subtle space-y-2 bg-gradient-to-br from-surface to-brand-50/20">
                  <div className="flex items-center justify-between text-xs font-semibold text-brand">
                    <span>Qabul Qilingan To'lov</span>
                    <span className="p-1.5 rounded-lg bg-brand text-white font-mono text-[10px]">Posted</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-brand">
                    <Money amountTiyin={bossMetrics.todayPaymentsTiyin} />
                  </div>
                  <p className="text-[11px] text-ink-secondary">Kassaga tushgan yalpi to'lovlar</p>
                </div>

                {/* 5. Qaytarilgan Summalar (Refunds) */}
                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary">
                    <span>Qaytarishlar (Refunds)</span>
                    <span className="p-1.5 rounded-lg bg-red-50 text-red-700 font-mono text-[10px]">Refund</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-red-700">
                    <Money amountTiyin={bossMetrics.todayRefundsTiyin} />
                  </div>
                  <p className="text-[11px] text-ink-secondary">Tasdiqlangan qaytarishlar</p>
                </div>

                {/* 6. Sof Tushum (Net Receipts) */}
                <div className="bg-surface rounded-2xl border border-brand/20 p-5 shadow-subtle space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-brand">
                    <span>Sof Tushum</span>
                    <span className="p-1.5 rounded-lg bg-emerald-100 text-brand font-mono text-[10px]">Net</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-brand">
                    <Money amountTiyin={bossMetrics.todayNetRevenueTiyin} />
                  </div>
                  <p className="text-[11px] text-ink-secondary">To'lovlar - Qaytarishlar</p>
                </div>

                {/* 7. Ochiq Qarzdorlik (Open Debt) */}
                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary">
                    <span>Ochiq Qarzdorlik</span>
                    <span className="p-1.5 rounded-lg bg-amber-50 text-amber-800 font-mono text-[10px]">Active Balance</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-ink-main">
                    <Money amountTiyin={bossMetrics.openDebtTiyin} />
                  </div>
                  <p className="text-[11px] text-ink-secondary">Faol stollardagi to'lanmagan qoldiq</p>
                </div>

                {/* 8. Qaytarish Kerak Bo'lgan Qoldiq (Refund Due) */}
                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary">
                    <span>Qaytarish Kerak Qoldiq</span>
                    <span className="p-1.5 rounded-lg bg-red-50 text-red-700 font-mono text-[10px]">Refund Due</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-red-600">
                    <Money amountTiyin={bossMetrics.refundDueTiyin} />
                  </div>
                  <p className="text-[11px] text-ink-secondary">Faol tashriflar: {bossMetrics.activeVisitsCount} ta</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OPERATIONS (MANAGER REAL-TIME CONTROL) */}
          {activeTab === 'operations' && (
            <div className="space-y-6">
              {/* Operations Overview Widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-secondary uppercase">Stollar Bandligi</span>
                    <Layers className="w-4 h-4 text-brand" />
                  </div>
                  <div className="text-3xl font-black text-ink-main mt-2">
                    {operationsSummary.tables.occupancyRate}%
                  </div>
                  <div className="text-xs text-ink-secondary mt-1">
                    {operationsSummary.tables.occupied} band • {operationsSummary.tables.free} bo'sh • {operationsSummary.tables.dirty} kirlangan
                  </div>
                </div>

                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-secondary uppercase">Faol Buyurtmalar</span>
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-3xl font-black text-ink-main mt-2">
                    {operationsSummary.orders.activeCount}
                  </div>
                  <div className="text-xs text-ink-secondary mt-1">
                    {operationsSummary.orders.newCount} yangi • {operationsSummary.orders.preparingCount} pishirilmoqda • {operationsSummary.orders.readyCount} tayyor
                  </div>
                </div>

                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-secondary uppercase">Kechikkan Taomlar</span>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-3xl font-black text-amber-700 mt-2">
                    {operationsSummary.orders.delayedCount}
                  </div>
                  <div className="text-xs text-ink-secondary mt-1">
                    Normativdan oshgan (&gt; 20 min)
                  </div>
                </div>

                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-secondary uppercase">Javobsiz Chaqiruvlar</span>
                    <PhoneCall className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="text-3xl font-black text-red-600 mt-2">
                    {operationsSummary.unansweredCallsCount}
                  </div>
                  <div className="text-xs text-ink-secondary mt-1">
                    Mehmonlar kutayotgan chaqiruvlar
                  </div>
                </div>
              </div>

              {/* Section 1: Kechikkan va Faol Buyurtmalar */}
              <div className="bg-surface rounded-2xl border border-line shadow-subtle p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-ink-main text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-brand" />
                      Faol va Tasdiq Kutayotgan Buyurtmalar ({liveOrders.length})
                    </h3>
                    <p className="text-xs text-ink-secondary">
                      20 daqiqadan oshgan taomlar shoshilinch kechikkan deb belgilangan
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={loadOperationsSummary}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Yangilash
                  </Button>
                </div>

                {liveOrders.length > 0 ? (
                  <div className="space-y-2.5">
                    {liveOrders.map((ord: any) => {
                      const elapsedMin = Math.floor((Date.now() - new Date(ord.createdAt).getTime()) / 60000);
                      const isDelayed = elapsedMin >= 20;

                      return (
                        <div
                          key={ord.id}
                          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isDelayed ? 'bg-amber-50/60 border-amber-300' : 'bg-bg border-line'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-ink-main">
                                Buyurtma #{ord.orderNumber || ord.id.slice(0, 6)}
                              </span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-surface border border-line text-ink-secondary">
                                Stol {ord.visit?.table?.number || '—'} ({ord.visit?.table?.hall?.name || 'Zal'})
                              </span>
                              {isDelayed && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-200">
                                  Kechikkan ({elapsedMin} daqiqa)
                                </span>
                              )}
                              {!isDelayed && (
                                <span className="text-xs text-ink-secondary font-mono">
                                  {elapsedMin} daqiqa avval
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-ink-secondary">
                              Taomlar: {ord.items?.map((it: any) => `${it.quantity}x ${it.snapshotName || it.name}`).join(', ') || '—'}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Button size="sm" variant="primary" onClick={() => handleConfirmOrder(ord.id)}>
                              <Check className="w-3.5 h-3.5 mr-1" /> Tasdiqlash
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => handleRejectOrder(ord.id)}>
                              <X className="w-3.5 h-3.5 mr-1" /> Rad etish
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-ink-secondary border border-dashed border-line rounded-xl">
                    Hozirda tasdiq kutayotgan yoki kechikkan buyurtmalar mavjud emas.
                  </div>
                )}
              </div>

              {/* Section 2: Javobsiz Xizmat Chaqiruvlari */}
              <div className="bg-surface rounded-2xl border border-line shadow-subtle p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-ink-main text-base flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-red-600" />
                      Javobsiz Xizmat Chaqiruvlari ({liveCalls.length})
                    </h3>
                    <p className="text-xs text-ink-secondary">
                      Mehmonlar tomonidan yuborilgan ofitsiant va hisob so'rovlari
                    </p>
                  </div>
                </div>

                {liveCalls.length > 0 ? (
                  <div className="space-y-2.5">
                    {liveCalls.map((call: any) => {
                      const elapsedMin = Math.floor((Date.now() - new Date(call.createdAt).getTime()) / 60000);

                      return (
                        <div
                          key={call.id}
                          className="p-3.5 rounded-xl border border-red-200 bg-red-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-ink-main">
                                Stol #{call.table?.number || '—'}
                              </span>
                              <Badge variant="danger" size="sm">
                                {call.type === 'BILL' ? 'Hisob So\'rash' : call.type === 'WAITER' ? 'Ofitsiant Chaqirish' : 'Maxsus Chaqiruv'}
                              </Badge>
                              <span className="text-xs font-mono text-red-700 font-semibold">
                                {elapsedMin} daqiqa kutilmoqda
                              </span>
                            </div>
                            <div className="text-xs text-ink-secondary">
                              Zal: {call.table?.hall?.name || 'Asosiy'} • Biriktirilgan: {call.table?.assignedWaiterId ? 'Ha' : 'Yo\'q'}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCallForReassign(call);
                                setReassignCallModalOpen(true);
                              }}
                            >
                              <UserCheck className="w-3.5 h-3.5 mr-1" /> Ofitsiantga Biriktirish
                            </Button>
                            <Button size="sm" variant="primary" onClick={() => handleResolveCall(call.id)}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Hal qilish
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-ink-secondary border border-dashed border-line rounded-xl">
                    Barcha chaqiruvlarga o'z vaqtida javob berilgan.
                  </div>
                )}
              </div>

              {/* Section 3: Menejer Vakolatidagi Tasdiqlar (Approvals) */}
              <div className="p-6 bg-surface rounded-2xl border border-line shadow-subtle space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-ink-main text-base">Menejer Moliyaviy va Operatsion Vakolatlari</h3>
                    <div className="text-xs text-ink-secondary flex flex-wrap items-center gap-2 mt-1">
                      <span>Boss permission sozlamasi:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${userPermissions.includes('discounts.approve') ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                        discounts.approve: {userPermissions.includes('discounts.approve') ? 'Mavjud' : 'Cheklangan'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${userPermissions.includes('refunds.approve') ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                        refunds.approve: {userPermissions.includes('refunds.approve') ? 'Mavjud' : 'Cheklangan'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDiscountModalOpen(true)}
                    >
                      <Percent className="w-3.5 h-3.5 mr-1" /> Chegirma Berish
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRefundModalOpen(true)}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Pul Qaytarish (Refund)
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LIVE TABLE MAP */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                  {halls.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setSelectedHallId(h.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap min-h-[44px] ${
                        selectedHallId === h.id
                          ? 'bg-brand text-white shadow-sm'
                          : 'bg-surface text-ink-secondary border border-line hover:bg-bg'
                      }`}
                    >
                      {h.name}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-ink-secondary hidden sm:block">
                  Yashil: Bo'sh • To'q: Band • Qizil: Tozalash
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredTables.map((tbl: any) => (
                  <div
                    key={tbl.id}
                    className="bg-surface rounded-2xl border border-line p-4 shadow-subtle flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xl font-black text-ink-main block">Stol {tbl.number}</span>
                        <span className="text-xs text-ink-secondary">{tbl.capacity} kishilik joy</span>
                      </div>
                      <Status type="table" value={tbl.status} />
                    </div>

                    {tbl.status === 'OCCUPIED' ? (
                      <div className="p-2.5 rounded-xl bg-bg border border-line space-y-1 text-xs font-mono">
                        <div className="text-ink-secondary">
                          Ofitsiant: {tbl.assignedWaiter?.fullName || tbl.waiter || 'Biriktirilmagan'}
                        </div>
                        <div className="text-ink-secondary">
                          Faol vaqt: {tbl.activeMinutes || 25} daq
                        </div>
                        {tbl.totalTiyin !== undefined && (
                          <div className="text-brand font-bold pt-1 border-t border-line">
                            Hisob: <Money amountTiyin={BigInt(tbl.totalTiyin)} />
                          </div>
                        )}
                      </div>
                    ) : tbl.status === 'DIRTY' ? (
                      <div className="p-2.5 rounded-xl bg-red-50 text-red-900 border border-red-200 text-xs font-semibold">
                        Tozalash va tayyorlash kutilmoqda
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-semibold">
                        Mehmon qabul qilishga tayyor
                      </div>
                    )}

                    {/* Waiter assignment action */}
                    <button
                      onClick={() => {
                        setSelectedTableForWaiter(tbl);
                        setAssignWaiterModalOpen(true);
                      }}
                      className="w-full py-2 px-3 rounded-xl border border-line bg-bg hover:bg-surface text-xs font-semibold text-ink-main flex items-center justify-center gap-1.5 transition-colors min-h-[38px]"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-brand" />
                      <span>{tbl.assignedWaiter?.fullName ? `${tbl.assignedWaiter.fullName} (O'zgartirish)` : 'Ofitsiant biriktirish'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: MENU & AVAILABILITY */}
          {activeTab === 'menu' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-ink-main">Menyu va Stop-List Boshqaruvi</h3>
                  <p className="text-xs text-ink-secondary">
                    Taomlarni o'chirish o'rniga mavjudligini (Availability) boshqaring. Narxga tegmasdan Stop-list qilish xavfsiz.
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-ink-secondary" />
                  <Input
                    placeholder="Taom nomi bo'yicha qidirish..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setSelectedMenuCategory('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap min-h-[38px] ${
                      selectedMenuCategory === 'all'
                        ? 'bg-brand text-white'
                        : 'bg-surface border border-line text-ink-secondary hover:bg-bg'
                    }`}
                  >
                    Barchasi
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedMenuCategory(c.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap min-h-[38px] ${
                        selectedMenuCategory === c.id
                          ? 'bg-brand text-white'
                          : 'bg-surface border border-line text-ink-secondary hover:bg-bg'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Taom</TableHead>
                    <TableHead>Kategoriya</TableHead>
                    <TableHead>Narx</TableHead>
                    <TableHead>Mavjudlik (Stop-List)</TableHead>
                    <TableHead className="text-right">Amal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDishes.map((dish) => (
                    <TableRow key={dish.id}>
                      <TableCell className="font-semibold text-ink-main">
                        <div className="flex items-center space-x-3">
                          <ImageFallback src={dish.imageUrl} alt={dish.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                          <div>
                            <div>{dish.name}</div>
                            <span className="text-[11px] text-ink-secondary block font-normal">{dish.desc}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-ink-secondary">
                        {categories.find((c) => c.id === dish.categoryId)?.name || 'Milliy Taomlar'}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-sm">
                        <Money amountTiyin={dish.priceTiyin} />
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleDishAvailability(dish.id, dish.isAvailable)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors min-h-[32px] ${
                            dish.isAvailable ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
                          }`}
                        >
                          {dish.isAvailable ? 'Mavjud' : 'Stop-List (Tugagan)'}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingItem({
                              id: dish.id,
                              nameUz: dish.name,
                              nameRu: dish.nameRu || '',
                              descUz: dish.desc || '',
                              descRu: '',
                              categoryId: dish.categoryId,
                              stationId: dish.stationId,
                              basePriceUzs: Number(dish.priceTiyin / 100n),
                              imageUrl: dish.imageUrl,
                              allergens: dish.allergens || [],
                              variants: [],
                              addonGroups: [],
                            });
                            setMenuItemModalOpen(true);
                          }}
                        >
                          Tahrirlash
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* TAB 5: STAFF MANAGEMENT */}
          {activeTab === 'staff' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-ink-main">Restoran Xodimlari</h3>
                  <p className="text-xs text-ink-secondary">
                    Xodimlarni yaratish, rollar berish, stansiya va stollarga biriktirish. Manager o'zidan yuqori rol bera olmaydi.
                  </p>
                </div>
                <Button
                  size="md"
                  variant="primary"
                  onClick={() => { setEditingStaff(null); setStaffModalOpen(true); }}
                  className="text-xs"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Yangi Xodim Qo'shish
                </Button>
              </div>

              {/* Jamoa moslashuvchanligi bo'yicha ko'rsatma */}
              <div className="p-3 bg-brand-50/70 border border-brand-200 rounded-xl text-xs text-brand-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="font-bold flex items-center gap-1.5">
                    💡 O'zbekiston kafelari uchun moslashuvchan jamoa (1–5+ xodim):
                  </span>
                  <p className="text-[11px] text-brand-800">
                    Kichik jamoalarda bitta xodimga bir nechta rolni (masalan: Ofitsiant-Kassir yoki 3 in 1 Universal Operator) biriktirishingiz mumkin.
                  </p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>F.I.SH.</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Rollar</TableHead>
                    <TableHead>Biriktirilgan Stansiya / Stollar</TableHead>
                    <TableHead>Holati</TableHead>
                    <TableHead className="text-right">Amal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffList.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-semibold text-ink-main">{member.fullName}</TableCell>
                      <TableCell className="font-mono text-xs">{member.phone}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {member.roles.map((r: string) => (
                              <Badge key={r} variant="neutral" size="sm">
                                {r}
                              </Badge>
                            ))}
                          </div>
                          {member.roles.length >= 3 && (
                            <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200">
                              ⚡ Universal ({member.roles.length} in 1)
                            </span>
                          )}
                          {member.roles.length === 2 && member.roles.includes('WAITER') && member.roles.includes('CASHIER') && (
                            <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                              🤝 Ofitsiant-Kassir
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-ink-secondary">
                        <div className="space-y-0.5">
                          {member.assignedStations?.length > 0 && (
                            <div>Stansiya: {member.assignedStations.map((s: any) => s.name).join(', ')}</div>
                          )}
                          {member.assignedTables?.length > 0 && (
                            <div>Stollar: {member.assignedTables.map((t: any) => `Stol ${t.number}`).join(', ')}</div>
                          )}
                          {!member.assignedStations?.length && !member.assignedTables?.length && <span>—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.isActive ? 'success' : 'danger'} size="sm">
                          {member.isActive ? 'Faol' : 'Faolsiz'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingStaff({
                              id: member.id,
                              userId: member.userId,
                              fullName: member.fullName,
                              phone: member.phone,
                              roles: member.roles,
                              customPermissions: Array.isArray(member.customPermissions) ? member.customPermissions : [],
                              isActive: member.isActive,
                              stationIds: member.assignedStations?.map((s: any) => s.id) || [],
                              tableIds: member.assignedTables?.map((t: any) => t.id) || [],
                            });
                            setStaffModalOpen(true);
                          }}
                        >
                          Tahrirlash
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* TAB 6: REPORTS & ANALYTICS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-surface rounded-2xl border border-line shadow-subtle">
                <div>
                  <h3 className="text-base font-bold text-ink-main">Batafsil Hisobotlar va Ko'rsatkichlar</h3>
                  <p className="text-xs text-ink-secondary">
                    Asia/Tashkent kun chegarasi bo'yicha to'liq tenant agregatsiyalari
                  </p>
                </div>

                {/* Date range filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    value={reportDateFrom}
                    onChange={(e) => setReportDateFrom(e.target.value)}
                    className="w-36 text-xs"
                  />
                  <span className="text-xs text-ink-secondary font-bold">—</span>
                  <Input
                    type="date"
                    value={reportDateTo}
                    onChange={(e) => setReportDateTo(e.target.value)}
                    className="w-36 text-xs"
                  />
                  <Button size="sm" variant="primary" onClick={() => loadDetailedReports(reportDateFrom, reportDateTo)} disabled={loadingReports}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingReports ? 'animate-spin' : ''}`} /> Tahlil
                  </Button>
                </div>
              </div>

              {/* Timestamp separation explainer */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start space-x-3 text-xs text-blue-950 leading-relaxed">
                <Clock className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">Hisob-kitob va Vaqt Standarti Hujjati:</span>
                  • Buyurtmalar va taomlar yig'indisi: <code>order.createdAt</code> bo'yicha hisoblanadi.<br />
                  • To'lovlar va kassa tushumi: <code>payment.createdAt</code> bo'yicha hisoblanadi.<br />
                  • Barcha hisobotlar Toshkent vaqti (UTC+5, 00:00:00 — 23:59:59.999) chegaralariga qat'iy amal qiladi.
                </div>
              </div>

              {detailedReports ? (
                <div className="space-y-6">
                  {/* To'lovlar Taqsimoti */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-surface rounded-2xl border border-line shadow-subtle space-y-1">
                      <span className="text-xs text-ink-secondary font-semibold">Naqd To'lovlar</span>
                      <div className="text-xl font-bold font-mono text-ink-main">
                        <Money amountTiyin={BigInt(detailedReports.paymentsSummary?.cashPaymentsTiyin || 0)} />
                      </div>
                    </div>
                    <div className="p-4 bg-surface rounded-2xl border border-line shadow-subtle space-y-1">
                      <span className="text-xs text-ink-secondary font-semibold">Terminal To'lovlar</span>
                      <div className="text-xl font-bold font-mono text-ink-main">
                        <Money amountTiyin={BigInt(detailedReports.paymentsSummary?.terminalPaymentsTiyin || 0)} />
                      </div>
                    </div>
                    <div className="p-4 bg-surface rounded-2xl border border-brand/40 shadow-subtle space-y-1 bg-brand-50/20">
                      <span className="text-xs text-brand font-bold">Sof Tushum (Net Receipts)</span>
                      <div className="text-xl font-black font-mono text-brand">
                        <Money amountTiyin={BigInt(detailedReports.paymentsSummary?.netReceiptsTiyin || 0)} />
                      </div>
                    </div>
                  </div>

                  {/* Mashhur Taomlar Jadvali */}
                  <div className="bg-surface rounded-2xl border border-line shadow-subtle p-5 space-y-4">
                    <h4 className="font-bold text-ink-main text-sm">Eng Ko'p Sotilgan Taomlar (Top Dishes)</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Taom Nomi</TableHead>
                          <TableHead>Kategoriya</TableHead>
                          <TableHead className="text-center">Sotilgan Soni</TableHead>
                          <TableHead className="text-right">Jami Tushum</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailedReports.popularDishes?.map((dish: any) => (
                          <TableRow key={dish.menuItemId}>
                            <TableCell className="font-semibold text-ink-main">{dish.name}</TableCell>
                            <TableCell className="text-xs text-ink-secondary">{dish.categoryName}</TableCell>
                            <TableCell className="text-center font-bold font-mono">{dish.totalQuantity} ta</TableCell>
                            <TableCell className="text-right font-mono font-bold text-brand">
                              <Money amountTiyin={BigInt(dish.totalRevenueTiyin || 0)} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Ofitsiantlar Ko'rsatkichi */}
                  <div className="bg-surface rounded-2xl border border-line shadow-subtle p-5 space-y-4">
                    <h4 className="font-bold text-ink-main text-sm">Ofitsiantlar Xizmat Ko'rsatkichi</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ofitsiant</TableHead>
                          <TableHead className="text-center">Yetkazilgan Buyurtmalar</TableHead>
                          <TableHead className="text-center">Yechilgan Chaqiruvlar</TableHead>
                          <TableHead className="text-right">Jami Buyurtma Summasi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailedReports.waiterPerformance?.map((w: any) => (
                          <TableRow key={w.waiterId}>
                            <TableCell className="font-semibold text-ink-main">{w.waiterName}</TableCell>
                            <TableCell className="text-center font-mono">{w.servedOrdersCount} ta</TableCell>
                            <TableCell className="text-center font-mono">{w.resolvedCallsCount} ta</TableCell>
                            <TableCell className="text-right font-mono font-bold text-ink-main">
                              <Money amountTiyin={BigInt(w.totalOrderValueTiyin || 0)} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-ink-secondary text-sm">Hisobotlar yuklanmoqda...</div>
              )}
            </div>
          )}

          {/* TAB 7: RESTAURANT SETTINGS */}
          {activeTab === 'settings' && (
            <div className="bg-surface rounded-2xl border border-line shadow-subtle p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-ink-main">Restoran Umumiy Sozlamalari</h3>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Rekvizitlar va xizmat haqi. Muhim: O'zgartirish mavjud ochiq va yopiq tashriflar xizmat haqi snapshotiga aslo ta'sir qilmaydi!
                </p>
              </div>

              {settingsSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  {settingsSuccess}
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-xs font-semibold text-ink-main mb-1">Restoran Nomi</label>
                  <Input
                    value={settingsData.name}
                    onChange={(e) => setSettingsData({ ...settingsData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink-main mb-1">Aloqa Telefoni</label>
                    <Input
                      value={settingsData.phone}
                      onChange={(e) => setSettingsData({ ...settingsData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-main mb-1">Ish Vaqti (Opening Hours)</label>
                    <Input
                      value={settingsData.openingHours}
                      placeholder="09:00 - 23:00"
                      onChange={(e) => setSettingsData({ ...settingsData, openingHours: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-main mb-1">Manzil</label>
                  <Input
                    value={settingsData.address}
                    onChange={(e) => setSettingsData({ ...settingsData, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink-main mb-1">Xizmat Haqi (Servis Foizi)</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="50"
                        step="1"
                        value={settingsData.serviceChargeBps / 100}
                        onChange={(e) => setSettingsData({ ...settingsData, serviceChargeBps: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-ink-secondary font-bold">%</span>
                    </div>
                    <span className="text-[11px] text-ink-secondary mt-1 block">Hozirgi: {settingsData.serviceChargeBps / 100}% ({settingsData.serviceChargeBps} bps)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-main mb-1">Asosiy Til</label>
                    <select
                      value={settingsData.defaultLanguage}
                      onChange={(e) => setSettingsData({ ...settingsData, defaultLanguage: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-line bg-bg text-sm font-medium focus:ring-1 focus:ring-brand focus:border-brand min-h-[44px]"
                    >
                      <option value="uz">O'zbekcha (UZ)</option>
                      <option value="ru">Русский (RU)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-line flex justify-end">
                  <Button type="submit" disabled={savingSettings}>
                    {savingSettings ? 'Saqlanmoqda...' : 'Sozlamalarni Saqlash'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 8: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 bg-surface rounded-2xl border border-line shadow-subtle">
                <div>
                  <h3 className="text-base font-bold text-ink-main">Tizim Audit Jurnali</h3>
                  <p className="text-xs text-ink-secondary">
                    Kim, qachon, qaysi amalni bajardi. Barcha token va parollar [REDACTED] bilan himoyalangan.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleExportAuditCsv}>
                    <Download className="w-3.5 h-3.5 mr-1" /> CSV Eksport (Xavfsiz)
                  </Button>
                </div>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Amal bo'yicha qidirish (masalan: AUTH_LOGIN, STAFF_CREATED)..."
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="max-w-xs"
                />
                <Button size="sm" variant="outline" onClick={() => loadAuditLogs(1, auditActionFilter)}>
                  Filtrlash
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vaqt (Asia/Tashkent)</TableHead>
                    <TableHead>Foydalanuvchi</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Amal</TableHead>
                    <TableHead>Resurs</TableHead>
                    <TableHead>Sabab</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs text-ink-secondary">
                        {new Date(log.createdAt).toLocaleString('uz-UZ')}
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-ink-main">
                        {log.actorName || log.actorId || 'Tizim'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" size="sm">
                          {log.actorRole || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-brand">
                        {log.action}
                      </TableCell>
                      <TableCell className="text-xs text-ink-secondary">
                        {log.entityName} {log.entityId ? `(#${log.entityId.substring(0, 6)})` : ''}
                      </TableCell>
                      <TableCell className="text-xs text-ink-secondary max-w-xs truncate">
                        {log.reason || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {auditLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-ink-secondary text-xs">
                        Audit yozuvlari topilmadi.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {auditTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-ink-secondary">
                    Sahifa {auditPage} / {auditTotalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={auditPage <= 1 || loadingAudit}
                      onClick={() => loadAuditLogs(auditPage - 1, auditActionFilter)}
                    >
                      Oldingi
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={auditPage >= auditTotalPages || loadingAudit}
                      onClick={() => loadAuditLogs(auditPage + 1, auditActionFilter)}
                    >
                      Keyingi
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* MODALS */}

      {/* 1. Ofitsiant Biriktirish Modali */}
      {assignWaiterModalOpen && selectedTableForWaiter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-xl border border-line p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-ink-main text-base">
                Stol {selectedTableForWaiter.number} ga Ofitsiant Biriktirish
              </h3>
              <button onClick={() => setAssignWaiterModalOpen(false)} className="text-ink-secondary hover:text-ink-main">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink-secondary block">Mavjud Ofitsiantlar:</label>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                <button
                  onClick={() => handleAssignWaiter(selectedTableForWaiter.id, null)}
                  className="w-full text-left p-2.5 rounded-xl border border-line hover:bg-bg text-xs font-medium text-red-600 transition-colors"
                >
                  — Biriktirmaslik (Bo'shatish)
                </button>
                {activeWaiters.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => handleAssignWaiter(selectedTableForWaiter.id, w.userId)}
                    className="w-full text-left p-2.5 rounded-xl border border-line hover:bg-brand-50 hover:border-brand/40 text-xs font-semibold text-ink-main flex items-center justify-between transition-colors"
                  >
                    <span>{w.fullName}</span>
                    <span className="font-mono text-[11px] text-ink-secondary">{w.phone}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Chaqiruvni Qayta Biriktirish Modali */}
      {reassignCallModalOpen && selectedCallForReassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-xl border border-line p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-ink-main text-base">
                Chaqiruvni Ofitsiantga Biriktirish
              </h3>
              <button onClick={() => setReassignCallModalOpen(false)} className="text-ink-secondary hover:text-ink-main">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink-secondary block">Qaysi ofitsiantga yo'naltirish:</label>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {activeWaiters.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => handleReassignCall(selectedCallForReassign.id, w.userId)}
                    className="w-full text-left p-2.5 rounded-xl border border-line hover:bg-brand-50 text-xs font-semibold text-ink-main flex items-center justify-between transition-colors"
                  >
                    <span>{w.fullName}</span>
                    <span className="font-mono text-[11px] text-ink-secondary">{w.phone}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Chegirma Kiritish Modali */}
      {discountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl border border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-ink-main text-base">Menejer Chegirmasi Kiritish</h3>
              <button onClick={() => setDiscountModalOpen(false)} className="text-ink-secondary hover:text-ink-main">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyDiscount} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Tashrif IDsi (Visit ID)</label>
                <Input
                  value={discountForm.visitId}
                  onChange={(e) => setDiscountForm({ ...discountForm, visitId: e.target.value })}
                  placeholder="Faol tashrif IDsi..."
                  required
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-ink-secondary">Turi:</label>
                <button
                  type="button"
                  onClick={() => setDiscountForm({ ...discountForm, isPercent: true })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${discountForm.isPercent ? 'bg-brand text-white' : 'bg-bg text-ink-secondary border border-line'}`}
                >
                  Foiz (%)
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountForm({ ...discountForm, isPercent: false })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${!discountForm.isPercent ? 'bg-brand text-white' : 'bg-bg text-ink-secondary border border-line'}`}
                >
                  Qat'iy Summa (UZS)
                </button>
              </div>

              {discountForm.isPercent ? (
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">Chegirma Foizi (%)</label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={discountForm.percent}
                    onChange={(e) => setDiscountForm({ ...discountForm, percent: Number(e.target.value) })}
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">Chegirma Summasi (so'm)</label>
                  <Input
                    type="number"
                    min="1000"
                    step="1000"
                    value={discountForm.amountUzs}
                    onChange={(e) => setDiscountForm({ ...discountForm, amountUzs: Number(e.target.value) })}
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Sababi (Audit uchun majburiy)</label>
                <Input
                  value={discountForm.reason}
                  onChange={(e) => setDiscountForm({ ...discountForm, reason: e.target.value })}
                  placeholder="Doimiy mijoz, shikoyat kompensatsiyasi..."
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button size="sm" variant="outline" type="button" onClick={() => setDiscountModalOpen(false)}>
                  Bekor qilish
                </Button>
                <Button size="sm" variant="primary" type="submit">
                  Chegirmani Qo'llash
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Pul Qaytarish (Refund) Modali */}
      {refundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl border border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-ink-main text-base">Pul Qaytarishni Tasdiqlash (Refund)</h3>
              <button onClick={() => setRefundModalOpen(false)} className="text-ink-secondary hover:text-ink-main">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApproveRefund} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">To'lov IDsi (Payment ID)</label>
                <Input
                  value={refundForm.paymentId}
                  onChange={(e) => setRefundForm({ ...refundForm, paymentId: e.target.value })}
                  placeholder="Asl to'lov yozuvi IDsi..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Qaytariladigan Summa (so'm)</label>
                <Input
                  type="number"
                  min="1000"
                  step="1000"
                  value={refundForm.amountUzs}
                  onChange={(e) => setRefundForm({ ...refundForm, amountUzs: Number(e.target.value) })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Qaytarish Sababi (majburiy)</label>
                <Input
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                  placeholder="Mijoz e'tirozi, bekor qilingan taom..."
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button size="sm" variant="outline" type="button" onClick={() => setRefundModalOpen(false)}>
                  Bekor qilish
                </Button>
                <Button size="sm" variant="danger" type="submit">
                  Refundni Tasdiqlash
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Standart Menyu va Xodim Modallari */}
      <MenuItemModal
        isOpen={menuItemModalOpen}
        onClose={() => setMenuItemModalOpen(false)}
        onSave={() => {
          setMenuItemModalOpen(false);
          loadMenuItems();
        }}
        initialData={editingItem}
        categories={categories}
        stations={stations}
      />

      <CategoryModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onSave={() => setCategoryModalOpen(false)}
        initialData={null}
      />

      <StaffModal
        isOpen={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        onSave={handleSaveStaff}
        initialData={editingStaff}
        availableStations={stations}
        availableTables={tablesList.map((t: any) => ({ id: t.id, number: t.number }))}
        actorRoles={activeRole === 'BOSS' ? [Role.BOSS] : [Role.MANAGER]}
      />
    </div>
  );
};
