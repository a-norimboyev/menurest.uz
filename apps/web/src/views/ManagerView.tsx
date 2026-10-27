import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Layers,
  UtensilsCrossed,
  Settings,
  FileText,
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
  Check,
  UserCheck,
  KeyRound,
  LogOut,
  Trash2,
  QrCode,
  Eye,
  Upload,
  Camera,
  Image as ImageIcon,
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
import { MenuPreviewModal } from '../components/menu/MenuPreviewModal.tsx';
import { StaffModal, StaffFormData } from '../components/staff/StaffModal.tsx';
import { TableQrModal } from '../components/tables/TableQrModal.tsx';
import { ChangePasswordModal } from '../components/ChangePasswordModal.tsx';
import { useRealtime } from '../hooks/useRealtime.ts';
import { ConnectionBanner, RealtimeIndicatorPill } from '../components/ui/ConnectionBanner.tsx';
import { Role } from '@menurest/shared';

interface ManagerViewProps {
  initialRole?: 'MANAGER';
  activeRestaurantId?: string;
  authProfile?: any;
  onLogout?: () => void;
  onSwitchRole?: (role: string) => void;
  onOpenRestaurantSelector?: () => void;
}

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp('(^|;\\s*)menurest_csrf=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '';
}

export const parseBannerUrls = (raw?: string | null): string[] => {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .slice(0, 5);
      }
    } catch {}
  }
  return [trimmed];
};

export const serializeBannerUrls = (urls: string[]): string => {
  const clean = urls.filter((u) => typeof u === 'string' && u.trim().length > 0).slice(0, 5);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  return JSON.stringify(clean);
};

export const ManagerView: React.FC<ManagerViewProps> = ({
  initialRole = 'MANAGER',
  activeRestaurantId,
  authProfile,
  onLogout,
  onSwitchRole: _onSwitchRole,
  onOpenRestaurantSelector: _onOpenRestaurantSelector,
}) => {
  const [currentUser, setCurrentUser] = useState<any>(authProfile?.user || null);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [_activeRole] = useState<'MANAGER'>(initialRole);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'operations' | 'map' | 'menu' | 'staff' | 'reports' | 'settings'>('overview');

  // Restoran identifikatori va nomi
  const [restaurantId, setRestaurantId] = useState<string>(activeRestaurantId || authProfile?.activeRestaurant?.id || 'rayhon-chilonzor');
  const [restaurantName, setRestaurantName] = useState<string>(authProfile?.activeRestaurant?.name || 'Rayhon Milliy Taomlar');
  const [, setUserPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (activeRestaurantId) setRestaurantId(activeRestaurantId);
    else if (authProfile?.activeRestaurant?.id) setRestaurantId(authProfile.activeRestaurant.id);
    if (authProfile?.activeRestaurant?.name) setRestaurantName(authProfile.activeRestaurant.name);
  }, [activeRestaurantId, authProfile]);

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
    tables: { total: number; free: number; occupied: number; occupancyRate: number };
    orders: { totalToday: number; activeCount: number; newCount: number; confirmedCount: number; preparingCount: number; readyCount: number; delayedCount: number };
    unansweredCallsCount: number;
    pendingCancellationsCount: number;
  }>({
    tables: { total: 10, free: 7, occupied: 3, occupancyRate: 30 },
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
  const [selectedHallId] = useState<string>('all');
  const [tablesList, setTablesList] = useState<any[]>([
    { id: 't1', number: 1, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 4, status: 'OCCUPIED', assignedWaiter: { fullName: 'Jahongir R.' }, activeMinutes: 45, totalTiyin: 48500000n },
    { id: 't2', number: 2, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 4, status: 'FREE' },
    { id: 't3', number: 3, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 6, status: 'OCCUPIED', assignedWaiter: { fullName: 'Ali V.' }, activeMinutes: 20, totalTiyin: 12000000n },
    { id: 't4', number: 4, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 2, status: 'FREE' },
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
    allowedRoles?: string[];
  }>({
    name: 'Rayhon Milliy Taomlar',
    phone: '+998 71 200 11 22',
    address: 'Toshkent sh., Chilonzor tumani, 9-mavze',
    logoUrl: '',
    bannerUrl: '',
    openingHours: '09:00 - 23:00',
    defaultLanguage: 'uz',
    serviceChargeBps: 1000,
    allowedRoles: ['MANAGER', 'CASHIER', 'WAITER', 'GUEST'],
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<'logo' | 'banner' | null>(null);
  const [bannerUrlInput, setBannerUrlInput] = useState('');
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  const bannerUrls = useMemo(() => {
    return parseBannerUrls(settingsData.bannerUrl);
  }, [settingsData.bannerUrl]);

  // Har 2 soniyada muqova rasmini avtomatik almashtirib turish
  useEffect(() => {
    if (bannerUrls.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % bannerUrls.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [bannerUrls.length]);

  // 8. Hisobotlar (Reports) - 1 oylik tahlil sukut bo'yicha
  const [reportDateFrom, setReportDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [reportDateTo, setReportDateTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
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
  const [editingCategory, setEditingCategory] = useState<{ id?: string; name: string; sortOrder: number; isVisible: boolean } | null>(null);
  const [menuPreviewOpen, setMenuPreviewOpen] = useState(false);

  // Stansiyalar
  const [stations, setStations] = useState<any[]>([
    { id: 'st-kitchen', name: 'Issiq Oshxona' },
    { id: 'st-bar', name: 'Ichimliklar Bari' },
  ]);

  // 11. Stollar Modali (Yakka va 100 tagacha generatsiya)
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableModalMode, setTableModalMode] = useState<'single' | 'batch'>('single');
  const [tableNumber, setTableNumber] = useState<number>(1);
  const [tableCapacity, setTableCapacity] = useState<number>(4);
  const [tableHallId, setTableHallId] = useState<string>('');

  const [batchStartNumber, setBatchStartNumber] = useState<number>(1);
  const [batchCount, setBatchCount] = useState<number>(10);
  const [batchCapacity, setBatchCapacity] = useState<number>(4);
  const [batchHallId, setBatchHallId] = useState<string>('');
  const [isSubmittingTable, setIsSubmittingTable] = useState(false);

  // QR Kod Modali
  const [selectedTableForQr, setSelectedTableForQr] = useState<any | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // Restoran va Foydalanuvchi ma'lumotlarini dastlab aniqlash
  useEffect(() => {
    async function resolveAuth() {
      try {
        const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.user) setCurrentUser(json.data.user);
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
          allowedRoles: json.data.allowedRoles || ['MANAGER', 'CASHIER', 'WAITER', 'GUEST'],
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

  const loadStations = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/kds/stations`, { credentials: 'include' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setStations(json.data);
      }
    } catch (e) {
      console.warn('Stations fetch warning:', e);
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
    loadStations();
  }, [loadDashboardMetrics, loadOperationsSummary, loadTables, loadStaffList, loadSettings, loadMenuItems, loadStations]);

  useEffect(() => {
    if (activeTab === 'reports') loadDetailedReports();
  }, [activeTab, loadDetailedReports]);

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

  // Restoran muqovasi (banner) rasmlarini yuklash (maksimal 5 ta)
  const handleBannerFilesUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    const current = parseBannerUrls(settingsData.bannerUrl);
    const available = 5 - current.length;
    if (available <= 0) {
      alert("Maksimal 5 ta muqova rasm yuklashingiz mumkin.");
      return;
    }
    const toUpload = fileArray.slice(0, available);
    setIsUploadingImage('banner');
    try {
      const newUrls: string[] = [];
      for (const file of toUpload) {
        try {
          const formData = new FormData();
          formData.append('image', file);
          const res = await fetch(`/api/v1/restaurants/${restaurantId}/menu/upload-image`, {
            method: 'POST',
            headers: { 'x-csrf-token': getCsrfToken() },
            credentials: 'include',
            body: formData,
          });
          const json = await res.json();
          if (res.ok && json.success && json.data?.url) {
            newUrls.push(json.data.url);
          } else {
            const dataUrl = await new Promise<string>((resolve) => {
              const r = new FileReader();
              r.onload = (e) => resolve((e.target?.result as string) || '');
              r.onerror = () => resolve('');
              r.readAsDataURL(file);
            });
            if (dataUrl) newUrls.push(dataUrl);
          }
        } catch {
          const dataUrl = await new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onload = (e) => resolve((e.target?.result as string) || '');
            r.onerror = () => resolve('');
            r.readAsDataURL(file);
          });
          if (dataUrl) newUrls.push(dataUrl);
        }
      }
      if (newUrls.length > 0) {
        const updated = [...current, ...newUrls].slice(0, 5);
        setSettingsData((prev) => ({
          ...prev,
          bannerUrl: serializeBannerUrls(updated),
        }));
        setActiveBannerIndex(updated.length - 1);
      }
    } finally {
      setIsUploadingImage(null);
    }
  };

  const handleAddBannerUrl = () => {
    const url = bannerUrlInput.trim();
    if (!url) return;
    const current = parseBannerUrls(settingsData.bannerUrl);
    if (current.length >= 5) {
      alert("Maksimal 5 ta rasm kiritishingiz mumkin.");
      return;
    }
    const updated = [...current, url].slice(0, 5);
    setSettingsData((prev) => ({
      ...prev,
      bannerUrl: serializeBannerUrls(updated),
    }));
    setActiveBannerIndex(updated.length - 1);
    setBannerUrlInput('');
  };

  const handleRemoveBanner = (indexToRemove: number) => {
    const current = parseBannerUrls(settingsData.bannerUrl);
    const updated = current.filter((_, idx) => idx !== indexToRemove);
    setSettingsData((prev) => ({
      ...prev,
      bannerUrl: serializeBannerUrls(updated),
    }));
    if (activeBannerIndex >= updated.length) {
      setActiveBannerIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleClearAllBanners = () => {
    setSettingsData((prev) => ({
      ...prev,
      bannerUrl: '',
    }));
    setActiveBannerIndex(0);
  };

  // Restoran logotipi va muqovasi (banner) rasmini yuklash
  const handleFileUpload = async (file: File, type: 'logo' | 'banner') => {
    if (type === 'banner') {
      await handleBannerFilesUpload([file]);
      return;
    }
    try {
      setIsUploadingImage('logo');
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/menu/upload-image`, {
        method: 'POST',
        headers: { 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: formData,
      });
      const json = await res.json();
      if (res.ok && json.success && json.data?.url) {
        setSettingsData((prev) => ({
          ...prev,
          logoUrl: json.data.url,
        }));
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setSettingsData((prev) => ({
            ...prev,
            logoUrl: result,
          }));
        };
        reader.readAsDataURL(file);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setSettingsData((prev) => ({
          ...prev,
          logoUrl: result,
        }));
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingImage(null);
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
    const isEdit = Boolean(formData.userId || formData.id);
    const staffId = formData.userId || formData.id;
    const url = isEdit
      ? `/api/v1/restaurants/${restaurantId}/staff/${staffId}`
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

  // Taomni saqlash (yangi qo'shish yoki tahrirlash)
  const handleSaveMenuItem = async (formData: MenuItemFormData) => {
    try {
      const isEdit = Boolean(formData.id);
      const url = isEdit
        ? `/api/v1/restaurants/${restaurantId}/menu/items/${formData.id}`
        : `/api/v1/restaurants/${restaurantId}/menu/items`;
      const method = isEdit ? 'PATCH' : 'POST';

      const effectiveCatId = formData.categoryId || categories.find((c) => c.id !== 'all')?.id;
      const effectiveStationId = formData.stationId || stations[0]?.id;

      const payload: any = {
        categoryId: effectiveCatId,
        stationId: effectiveStationId,
        name: formData.nameUz,
        description: formData.descUz,
        basePriceTiyin: String(Math.round(Number(formData.basePriceUzs || 0) * 100)),
        imageUrl: formData.imageUrl || '',
        isAvailable: true,
        allergens: formData.allergens || [],
        translations: [
          { language: 'uz', name: formData.nameUz, description: formData.descUz },
          ...(formData.nameRu ? [{ language: 'ru', name: formData.nameRu, description: formData.descRu }] : []),
        ],
        variants: formData.variants?.map((v) => ({
          name: v.name,
          priceDifferenceTiyin: String(Math.round(Number(v.priceDiffUzs || 0) * 100)),
          isDefault: v.isDefault,
          isAvailable: true,
        })),
        addonGroups: formData.addonGroups?.map((g) => ({
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: g.options?.map((opt) => ({
            name: opt.name,
            priceTiyin: String(Math.round(Number(opt.priceUzs || 0) * 100)),
            isAvailable: true,
          })),
        })),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || "Taomni saqlashda xatolik yuz berdi");
        return;
      }
      setMenuItemModalOpen(false);
      await loadMenuItems();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    }
  };

  // Kategoriyani saqlash
  const handleSaveCategory = async (data: { id?: string; name: string; sortOrder: number; isVisible: boolean }) => {
    try {
      const isEdit = Boolean(data.id);
      const url = isEdit
        ? `/api/v1/restaurants/${restaurantId}/menu/categories/${data.id}`
        : `/api/v1/restaurants/${restaurantId}/menu/categories`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || "Kategoriyani saqlashda xatolik yuz berdi");
        return;
      }
      setCategoryModalOpen(false);
      setEditingCategory(null);
      await loadMenuItems();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    }
  };

  // Kategoriyani o'chirish
  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    const dishesCount = dishes.filter((d) => d.categoryId === categoryId).length;
    let message = `"${categoryName}" kategoriyasini o'chirishni tasdiqlaysizmi?`;
    if (dishesCount > 0) {
      message = `"${categoryName}" kategoriyasida ${dishesCount} ta taom mavjud. Ushbu kategoriyani va unga tegishli barcha taomlarni o'chirishni tasdiqlaysizmi?`;
    }
    if (!window.confirm(message)) return;

    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/menu/categories/${categoryId}?force=true`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || "Kategoriyani o'chirishda xatolik yuz berdi");
        return;
      }
      if (selectedMenuCategory === categoryId) {
        setSelectedMenuCategory('all');
      }
      await loadMenuItems();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    }
  };

  // Navbatdagi erkin stol raqami
  const nextTableNumber = useMemo(() => {
    if (!tablesList || tablesList.length === 0) return 1;
    const maxNum = Math.max(...tablesList.map((t: any) => Number(t.number) || 0));
    return maxNum + 1;
  }, [tablesList]);

  const openSingleTableModal = () => {
    setTableNumber(nextTableNumber);
    setTableHallId(halls.find((h) => h.id !== 'all')?.id || halls[0]?.id || '');
    setTableModalMode('single');
    setTableModalOpen(true);
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingTable(true);
      const effectiveHallId = tableHallId || (halls.find((h) => h.id !== 'all')?.id || halls[0]?.id);
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({
          number: tableNumber,
          capacity: tableCapacity,
          hallId: effectiveHallId,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || 'Stol yaratishda xatolik yuz berdi');
        return;
      }
      setTableModalOpen(false);
      await loadTables();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setIsSubmittingTable(false);
    }
  };

  const handleCreateBatchTables = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingTable(true);
      const effectiveHallId = batchHallId || (halls.find((h) => h.id !== 'all')?.id || halls[0]?.id);
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/tables/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({
          startNumber: batchStartNumber,
          count: batchCount,
          capacity: batchCapacity,
          hallId: effectiveHallId,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || 'Ommaviy stol yaratishda xatolik yuz berdi');
        return;
      }
      alert(`${json.data?.createdCount || batchCount} ta stol muvaffaqiyatli yaratildi!`);
      setTableModalOpen(false);
      await loadTables();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setIsSubmittingTable(false);
    }
  };

  const handleDeleteTable = async (tableId: string, tblNumber: number) => {
    if (!window.confirm(`${tblNumber}-raqamli stolni o'chirishni tasdiqlaysizmi?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/tables/${tableId}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || "Stolni o'chirishda xatolik yuz berdi");
        return;
      }
      await loadTables();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    }
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
      <header className="bg-surface border-b border-line sticky top-0 z-30 shadow-subtle h-16">
        <div className="w-full h-full flex items-center justify-between">
          {/* Brand section - aligned with w-64 desktop sidebar */}
          <div className="h-full flex items-center px-4 md:px-3 md:w-64 md:shrink-0 md:border-r md:border-line">
            {/* Mobile Hamburger Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden mr-2 p-2 rounded-xl border border-line text-ink-main hover:bg-bg min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <MenuIcon className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 md:px-3.5 min-w-0">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {settingsData.logoUrl ? (
                  <img src={settingsData.logoUrl} alt="Logo" className="w-5 h-5 rounded object-cover" />
                ) : (
                  <Store className="w-5 h-5 text-brand" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-ink-main text-sm sm:text-base tracking-tight truncate block">
                    {settingsData.name || restaurantName}
                  </span>
                </div>
                <span className="text-[11px] text-ink-secondary font-medium block leading-none mt-0.5">
                  Boshqaruv paneli
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end space-x-2 sm:space-x-3 px-4 sm:px-6 lg:px-8">
            <RealtimeIndicatorPill status={status} soundEnabled={soundEnabled} onToggleSound={toggleSound} />
          </div>
        </div>
      </header>

      {/* MOBILE SIDEBAR DRAWER */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex overscroll-contain">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] bg-surface h-full shadow-2xl border-r border-line p-4 flex flex-col space-y-3 z-10 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center space-x-2.5 px-1">
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  {settingsData.logoUrl ? (
                    <img src={settingsData.logoUrl} alt="Logo" className="w-5 h-5 rounded object-cover" />
                  ) : (
                    <Store className="w-5 h-5 text-brand" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-sm text-ink-main block truncate max-w-[160px]">
                    {settingsData.name || restaurantName}
                  </span>
                  <span className="text-[10px] text-ink-secondary block">Boshqaruv paneli</span>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-ink-secondary hover:text-ink-main hover:bg-bg transition-colors"
                title="Yopish"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 py-1">
              {[
                { id: 'overview', label: 'Moliya', icon: LayoutDashboard },
                { id: 'operations', label: 'Operatsiyalar', icon: TrendingUp },
                { id: 'map', label: 'Stollar', icon: Layers },
                { id: 'menu', label: 'Menyu', icon: UtensilsCrossed },
                { id: 'staff', label: 'Xodimlar', icon: Users },
                { id: 'reports', label: 'Hisobotlar', icon: FileText },
                { id: 'settings', label: 'Sozlamalar', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                      isActive ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
                    }`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {onLogout && (
              <div className="pt-2 border-t border-line">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold border border-rose-200 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Chiqish</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Container with Docked Left Sidebar */}
      <div className="flex-1 flex w-full">
        {/* DESKTOP SIDEBAR - DOCKED TO HEADER (TEGIB TURGAN) */}
        <aside className="w-64 shrink-0 hidden md:flex flex-col justify-between sticky top-16 h-[calc(100vh-4rem)] bg-surface border-r border-line p-3 z-20">
          <div className="overflow-y-auto space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'overview' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <span>Moliya</span>
            </button>

            <button
              onClick={() => setActiveTab('operations')}
              className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'operations' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span>Operatsiyalar</span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'map' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <span>Stollar</span>
            </button>

            <button
              onClick={() => setActiveTab('menu')}
              className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'menu' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <span>Menyu</span>
            </button>

            <button
              onClick={() => setActiveTab('staff')}
              className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'staff' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <span>Xodimlar</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'reports' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <span>Hisobotlar</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
                activeTab === 'settings' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <Settings className="w-4 h-4" />
              </div>
              <span>Sozlamalar</span>
            </button>
          </div>

          {onLogout && (
            <div className="pt-3 border-t border-line">
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold border border-rose-200 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Chiqish</span>
              </button>
            </div>
          )}
        </aside>

        {/* MAIN VIEW CONTENT */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">

          {/* TAB 1: OVERVIEW (BOSS FINANCIAL KPI) */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Asosiy Moliyaviy Ko'rsatkichlar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Sof Tushum */}
                <div className="bg-surface rounded-2xl border border-brand/30 p-5 shadow-subtle space-y-1 bg-gradient-to-br from-surface to-brand-50/20">
                  <span className="text-xs font-semibold text-brand">Sof Tushum</span>
                  <div className="text-2xl font-black font-mono text-brand">
                    <Money amountTiyin={bossMetrics.todayNetRevenueTiyin} />
                  </div>
                </div>

                {/* 2. Buyurtmalar qiymati */}
                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle space-y-1">
                  <span className="text-xs font-semibold text-ink-secondary">Buyurtmalar Qiymati</span>
                  <div className="text-2xl font-black font-mono text-ink-main">
                    <Money amountTiyin={bossMetrics.todayOrdersTotalTiyin} />
                  </div>
                </div>

                {/* 3. Xizmat narxi */}
                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-secondary">Xizmat narxi</span>
                    <span className="text-[11px] font-bold text-ink-secondary font-mono">{settingsData.serviceChargeBps / 100}%</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-800">
                    <Money amountTiyin={bossMetrics.todayServiceFeeTiyin} />
                  </div>
                </div>

                {/* 4. Kutilayotgan to'lov (Ochiq stollar) */}
                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle space-y-1">
                  <span className="text-xs font-semibold text-ink-secondary">Kutilayotgan To'lov</span>
                  <div className="text-2xl font-black font-mono text-ink-main">
                    <Money amountTiyin={bossMetrics.openDebtTiyin} />
                  </div>
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
                    {operationsSummary.tables.occupied} band • {operationsSummary.tables.free} bo'sh
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
                </div>

                <div className="bg-surface rounded-2xl border border-line p-5 shadow-subtle">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-secondary uppercase">Javobsiz Chaqiruvlar</span>
                    <PhoneCall className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="text-3xl font-black text-red-600 mt-2">
                    {operationsSummary.unansweredCallsCount}
                  </div>
                </div>
              </div>

              {/* Section 1: Kechikkan va Faol Buyurtmalar */}
              <div className="bg-surface rounded-2xl border border-line shadow-subtle p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-ink-main text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-brand" />
                    Faol va Tasdiq Kutayotgan Buyurtmalar ({liveOrders.length})
                  </h3>
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
                  <h3 className="font-bold text-ink-main text-base flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-red-600" />
                    Javobsiz Xizmat Chaqiruvlari ({liveCalls.length})
                  </h3>
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
            </div>
          )}

          {/* TAB 3: LIVE TABLE MAP */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              <div className="flex items-center justify-end pb-1">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={openSingleTableModal}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Stol Qo'shish
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredTables.map((tbl: any) => {
                  const isOccupied = tbl.status === 'OCCUPIED';
                  return (
                    <div
                      key={tbl.id}
                      className={`rounded-2xl border p-4 shadow-subtle flex flex-col justify-between space-y-3 transition-all ${
                        isOccupied
                          ? 'bg-surface border-emerald-400 ring-1 ring-emerald-400/20 shadow-md'
                          : 'bg-surface border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`text-xl font-black block ${isOccupied ? 'text-emerald-950' : 'text-ink-main'}`}>
                            Stol {tbl.number}
                          </span>
                          <span className="text-xs text-ink-secondary">{tbl.capacity} kishilik joy</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Status type="table" value={tbl.status} />
                          <button
                            onClick={() => {
                              setSelectedTableForQr({
                                id: tbl.id,
                                number: tbl.number,
                                hallName: tbl.hall?.name || '',
                                capacity: tbl.capacity,
                                qrToken: tbl.qrToken,
                              });
                              setQrModalOpen(true);
                            }}
                            className="p-1 rounded-lg text-brand hover:bg-brand-50 transition-colors"
                            title={`${tbl.number}-raqamli stol QR kodini ko'rish va chop etish`}
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          {!isOccupied && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTable(tbl.id, tbl.number);
                              }}
                              className="p-1 rounded-lg text-ink-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                              title={`${tbl.number}-raqamli stolni o'chirish`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isOccupied ? (
                        <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1 text-xs font-mono text-emerald-950">
                          <div className="font-semibold text-emerald-900">
                            Ofitsiant: {tbl.assignedWaiter?.fullName || tbl.waiter || 'Biriktirilmagan'}
                          </div>
                          <div className="text-emerald-700">
                            Faol vaqt: {tbl.activeMinutes || 25} daq
                          </div>
                          {tbl.totalTiyin !== undefined && (
                            <div className="text-brand font-black pt-1 border-t border-emerald-200 text-sm">
                              Hisob: <Money amountTiyin={BigInt(tbl.totalTiyin)} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-slate-50 text-slate-500 border border-slate-200 text-xs font-medium">
                          Bo'sh • Mehmon qabul qilishga tayyor
                        </div>
                      )}

                      {/* Table Actions: QR Code & Waiter Assignment */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => {
                          setSelectedTableForQr({
                            id: tbl.id,
                            number: tbl.number,
                            hallName: tbl.hall?.name || '',
                            capacity: tbl.capacity,
                            qrToken: tbl.qrToken,
                          });
                          setQrModalOpen(true);
                        }}
                        className="py-2 px-2.5 rounded-xl border border-brand/30 bg-brand-50/50 hover:bg-brand-50 text-xs font-bold text-brand flex items-center justify-center gap-1.5 transition-colors min-h-[38px]"
                        title="Stol QR kodini ko'rish va chop etish"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>QR Kod</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedTableForWaiter(tbl);
                          setAssignWaiterModalOpen(true);
                        }}
                        className="py-2 px-2.5 rounded-xl border border-line bg-bg hover:bg-surface text-xs font-semibold text-ink-main flex items-center justify-center gap-1 transition-colors min-h-[38px] truncate"
                        title={tbl.assignedWaiter?.fullName ? `Biriktirilgan: ${tbl.assignedWaiter.fullName}` : 'Ofitsiant biriktirish'}
                      >
                        <UserCheck className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span className="truncate">{tbl.assignedWaiter?.fullName ? tbl.assignedWaiter.fullName.split(' ')[0] : 'Ofitsiant'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* TAB 4: MENU & AVAILABILITY */}
          {activeTab === 'menu' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-ink-main">Menyu</h3>
                  <p className="text-xs text-ink-secondary">
                    Taomlar, toifalar va stop-list nazorati.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMenuPreviewOpen(true)}
                    className="border-brand text-brand hover:bg-brand-50 font-bold"
                    title="Mijozlar menyusi qanday ko'rinishini tekshirish"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" /> Menyuni ko'rish
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCategoryModalOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Yangi Kategoriya
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setEditingItem(null);
                      setMenuItemModalOpen(true);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Yangi Taom Qo'shish
                  </Button>
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
                        ? 'bg-brand text-white shadow-sm'
                        : 'bg-surface border border-line text-ink-secondary hover:bg-bg'
                    }`}
                  >
                    Barchasi
                  </button>
                  {categories.map((c) => (
                    <div
                      key={c.id}
                      className={`inline-flex items-center rounded-lg border text-xs font-bold whitespace-nowrap transition-all ${
                        selectedMenuCategory === c.id
                          ? 'bg-brand text-white border-brand shadow-sm'
                          : 'bg-surface border-line text-ink-secondary hover:bg-bg'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedMenuCategory(c.id)}
                        className="pl-3 pr-1.5 py-1.5 min-h-[38px] flex items-center"
                      >
                        {c.name}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(c.id, c.name);
                        }}
                        className={`pr-2.5 pl-1 py-1.5 min-h-[38px] flex items-center transition-colors ${
                          selectedMenuCategory === c.id
                            ? 'text-white/70 hover:text-white'
                            : 'text-ink-secondary/60 hover:text-red-600'
                        }`}
                        title={`"${c.name}" kategoriyasini o'chirish`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(null);
                      setCategoryModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-dashed border-brand/50 text-brand text-xs font-bold hover:bg-brand-50 flex items-center gap-1 min-h-[38px] whitespace-nowrap transition-colors"
                    title="Yangi kategoriya qo'shish"
                  >
                    <Plus className="w-3.5 h-3.5" /> Kategoriya qo'shish
                  </button>
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
                  <h3 className="text-base font-bold text-ink-main">Xodimlar</h3>
                  <p className="text-xs text-ink-secondary">
                    Xodimlarni boshqarish, rollar va stollarni biriktirish.
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
                <h3 className="text-base font-bold text-ink-main">Hisobotlar</h3>

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
                      <span className="text-xs text-brand font-bold">Sof Tushum</span>
                      <div className="text-xl font-black font-mono text-brand">
                        <Money amountTiyin={BigInt(detailedReports.paymentsSummary?.netReceiptsTiyin || 0)} />
                      </div>
                    </div>
                  </div>

                  {/* Mashhur Taomlar Jadvali */}
                  <div className="bg-surface rounded-2xl border border-line shadow-subtle p-5 space-y-4">
                    <h4 className="font-bold text-ink-main text-sm">Eng Ko'p Sotilgan Taomlar</h4>
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
                        {detailedReports.popularDishes && detailedReports.popularDishes.length > 0 ? (
                          detailedReports.popularDishes.map((dish: any) => (
                            <TableRow key={dish.menuItemId}>
                              <TableCell className="font-semibold text-ink-main">{dish.name}</TableCell>
                              <TableCell className="text-xs text-ink-secondary">{dish.categoryName}</TableCell>
                              <TableCell className="text-center font-bold font-mono">{dish.totalQuantity} ta</TableCell>
                              <TableCell className="text-right font-mono font-bold text-brand">
                                <Money amountTiyin={BigInt(dish.totalRevenueTiyin || 0)} />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-6 text-xs text-ink-secondary">
                              Hozircha sotilgan taomlar mavjud emas
                            </TableCell>
                          </TableRow>
                        )}
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
                        {detailedReports.waiterPerformance && detailedReports.waiterPerformance.length > 0 ? (
                          detailedReports.waiterPerformance.map((w: any) => (
                            <TableRow key={w.waiterId}>
                              <TableCell className="font-semibold text-ink-main">{w.waiterName}</TableCell>
                              <TableCell className="text-center font-mono">{w.servedOrdersCount} ta</TableCell>
                              <TableCell className="text-center font-mono">{w.resolvedCallsCount} ta</TableCell>
                              <TableCell className="text-right font-mono font-bold text-ink-main">
                                <Money amountTiyin={BigInt(w.totalOrderValueTiyin || 0)} />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-6 text-xs text-ink-secondary">
                              Hozircha ma'lumot mavjud emas
                            </TableCell>
                          </TableRow>
                        )}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-ink-main">Sozlamalar</h3>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Restoran rekvizitlari va xizmat haqi sozlamalari
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setChangePasswordModalOpen(true)}
                  className="text-xs font-semibold"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1.5 text-brand" />
                  Parol va Telefonni o'zgartirish
                </Button>
              </div>

              {settingsSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  {settingsSuccess}
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl">
                {/* Brending va Rasmlar (Logotip va Muqova) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-line space-y-5">
                  <div className="border-b border-line pb-3">
                    <h4 className="text-sm font-bold text-ink-main flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-brand" />
                      Restoran Brendingi (Logotip va Muqova)
                    </h4>
                    <p className="text-[11px] text-ink-secondary mt-0.5">
                      Ushbu rasmlar mijozlar menyusining yuqori qismida, QR menyuda va tizim boshqaruvida ko'rsatiladi
                    </p>
                  </div>

                  {/* 1. Restoran Muqovasi (Banner) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-ink-main">
                            Restoran Muqovasi (Banner)
                          </label>
                          <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand text-[10px] font-bold border border-brand-100">
                            {bannerUrls.length} / 5 ta rasm
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-secondary mt-0.5">
                          Jami 5 tagacha rasm yuklashingiz mumkin. Rasmlar mijozlar menyusida har 2 soniyada avtomatik almashib turadi.
                        </p>
                      </div>

                      {bannerUrls.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllBanners}
                          className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Barchasini tozalash
                        </button>
                      )}
                    </div>

                    {/* Banner Live Preview Carousel */}
                    <div className="relative w-full h-40 sm:h-52 rounded-2xl border-2 border-dashed border-line overflow-hidden bg-slate-950 flex items-center justify-center shadow-inner">
                      {bannerUrls.length > 0 ? (
                        <>
                          {bannerUrls.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Muqova ${idx + 1}`}
                              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
                                idx === (activeBannerIndex % bannerUrls.length)
                                  ? 'opacity-100 z-10'
                                  : 'opacity-0 z-0 pointer-events-none'
                              }`}
                            />
                          ))}

                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 z-20 pointer-events-none" />

                          {/* Auto-rotation indicator badge */}
                          <div className="absolute top-3 left-3 z-30 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold flex items-center gap-1.5 border border-white/20">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Jonli ko'rinish (har 2 s)
                          </div>

                          {/* Slide counter badge */}
                          <div className="absolute top-3 right-3 z-30 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-bold border border-white/20">
                            {(activeBannerIndex % bannerUrls.length) + 1} / {bannerUrls.length}
                          </div>

                          {/* Carousel dots */}
                          {bannerUrls.length > 1 && (
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
                              {bannerUrls.map((_, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setActiveBannerIndex(idx)}
                                  className={`h-2 rounded-full transition-all ${
                                    idx === (activeBannerIndex % bannerUrls.length)
                                      ? 'w-6 bg-brand-400'
                                      : 'w-2 bg-white/50 hover:bg-white'
                                  }`}
                                  title={`${idx + 1}-rasmga o'tish`}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center p-6 text-white">
                          <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-bold text-white">Muqova rasmlari yuklanmagan</p>
                          <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                            Restoraningiz interyeri, taomlari yoki jozibali muqovasidan 5 tagacha rasm yuklang
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 5 Thumbnail Slots (Gallery Manager) */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-ink-secondary flex items-center justify-between">
                        <span>Yuklangan rasmlar (tanlash va o'chirish):</span>
                        <span>{bannerUrls.length} / 5 ta</span>
                      </div>

                      <div className="grid grid-cols-5 gap-2 sm:gap-3">
                        {[0, 1, 2, 3, 4].map((slotIdx) => {
                          const url = bannerUrls[slotIdx];
                          const isActive = url && slotIdx === (activeBannerIndex % bannerUrls.length);

                          return (
                            <div
                              key={slotIdx}
                              className={`relative aspect-[4/3] rounded-xl border-2 overflow-hidden group transition-all ${
                                isActive
                                  ? 'border-brand ring-2 ring-brand/30 shadow-md'
                                  : url
                                  ? 'border-line hover:border-brand/60 bg-surface'
                                  : 'border-dashed border-line bg-surface/50 hover:bg-surface'
                              }`}
                            >
                              {url ? (
                                <>
                                  <img
                                    src={url}
                                    alt={`Slot ${slotIdx + 1}`}
                                    onClick={() => setActiveBannerIndex(slotIdx)}
                                    className="w-full h-full object-cover cursor-pointer"
                                  />
                                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-bold">
                                    #{slotIdx + 1}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveBanner(slotIdx);
                                    }}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center shadow opacity-90 group-hover:opacity-100 transition-opacity"
                                    title="Rasmni o'chirish"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </>
                              ) : (
                                <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-1 text-ink-secondary hover:text-brand transition-colors">
                                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
                                  <span className="text-[9px] font-semibold">+{slotIdx + 1}</span>
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    disabled={isUploadingImage === 'banner'}
                                    onChange={(e) => {
                                      if (e.target.files) handleBannerFilesUpload(e.target.files);
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Upload Controls: URL Input & File Upload */}
                    <div className="space-y-2 pt-1">
                      {bannerUrls.length < 5 ? (
                        <>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Muqova rasm URL havolasini kiriting (https://...)"
                              value={bannerUrlInput}
                              onChange={(e) => setBannerUrlInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddBannerUrl();
                                }
                              }}
                              className="text-xs h-9 flex-1"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleAddBannerUrl}
                              disabled={!bannerUrlInput.trim()}
                              className="text-xs font-semibold h-9 px-3 shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" /> Qo'shish
                            </Button>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="inline-flex cursor-pointer px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-hover border border-line text-xs font-bold text-ink-main items-center gap-1.5 shadow-sm transition-all">
                              <Upload className="w-3.5 h-3.5 text-brand" />
                              {isUploadingImage === 'banner' ? 'Yuklanmoqda...' : 'Kompyuterdan yuklash'}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                className="hidden"
                                disabled={isUploadingImage === 'banner'}
                                onChange={(e) => {
                                  if (e.target.files) handleBannerFilesUpload(e.target.files);
                                }}
                              />
                            </label>
                            <span className="text-[11px] text-ink-secondary">
                              (Maksimal 5 ta rasm, JPEG/PNG/WEBP)
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          Maksimal 5 ta muqova rasm to'liq yuklangan. Boshqasini qo'shish uchun avval bittasini o'chiring.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Restoran Logotipi (Logo) */}
                  <div className="space-y-2 pt-3 border-t border-line">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-ink-main">
                        Restoran Logotipi (Logo)
                      </label>
                      {settingsData.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setSettingsData({ ...settingsData, logoUrl: '' })}
                          className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Logotipni o'chirish
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Logo Preview */}
                      <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-line bg-bg overflow-hidden flex items-center justify-center shrink-0 relative group">
                        {settingsData.logoUrl ? (
                          <>
                            <img
                              src={settingsData.logoUrl}
                              alt="Logo preview"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <label className="cursor-pointer p-2 rounded-xl bg-white/90 text-ink-main hover:bg-white transition-all shadow-md" title="O'zgartirish">
                                <Camera className="w-4 h-4 text-brand" />
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  disabled={isUploadingImage === 'logo'}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file, 'logo');
                                  }}
                                />
                              </label>
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-2">
                            <Store className="w-6 h-6 text-ink-secondary mx-auto" />
                            <span className="text-[9px] text-ink-secondary block mt-0.5">Logo yo'q</span>
                          </div>
                        )}
                      </div>

                      {/* Logo Upload controls */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="inline-flex cursor-pointer px-3.5 py-1.5 rounded-xl bg-surface hover:bg-surface-hover border border-line text-xs font-bold text-ink-main items-center gap-1.5 shadow-sm transition-all">
                            <Upload className="w-3.5 h-3.5 text-brand" />
                            {isUploadingImage === 'logo' ? 'Yuklanmoqda...' : 'Logotip yuklash'}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              disabled={isUploadingImage === 'logo'}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file, 'logo');
                              }}
                            />
                          </label>
                          <span className="text-[11px] text-ink-secondary">Tavsiya: kvadrat (500x500)</span>
                        </div>
                        <Input
                          placeholder="Yoki logotip URL havolasini kiriting (https://...)"
                          value={settingsData.logoUrl}
                          onChange={(e) => setSettingsData({ ...settingsData, logoUrl: e.target.value })}
                          className="text-xs h-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>

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
                    <label className="block text-xs font-semibold text-ink-main mb-1">Xizmat narxi</label>
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
                    <span className="text-[11px] text-ink-secondary mt-1 block">Hozirgi: {settingsData.serviceChargeBps / 100}%</span>
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
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Sababi (Majburiy)</label>
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

      {/* 5. Stol Qo'shish va 100 tagacha Generatsiya Modali */}
      {tableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overscroll-contain">
          <div className="bg-surface w-full max-w-lg rounded-2xl shadow-xl border border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-bold text-ink-main text-base">
                  {tableModalMode === 'single' ? "Yangi Stol Qo'shish" : "100 tagacha Tezkor Generatsiya"}
                </h3>
                <p className="text-xs text-ink-secondary">
                  Hozirda jami {tablesList.length} ta stol mavjud (maksimal 100 tagacha)
                </p>
              </div>
              <button onClick={() => setTableModalOpen(false)} className="text-ink-secondary hover:text-ink-main">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switch Tabs */}
            <div className="flex border-b border-line gap-2 pb-2">
              <button
                type="button"
                onClick={() => setTableModalMode('single')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  tableModalMode === 'single' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg'
                }`}
              >
                Yakka stol qo'shish
              </button>
              <button
                type="button"
                onClick={() => setTableModalMode('batch')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  tableModalMode === 'batch' ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg'
                }`}
              >
                ⚡ 100 tagacha Tezkor Generatsiya
              </button>
            </div>

            {tableModalMode === 'single' ? (
              <form onSubmit={handleCreateTable} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">Stol Raqami</label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={tableNumber}
                      onChange={(e) => setTableNumber(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">Sig'imi (kishi)</label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={tableCapacity}
                      onChange={(e) => setTableCapacity(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">Zal</label>
                  <select
                    value={tableHallId}
                    onChange={(e) => setTableHallId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink-main text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    {halls.filter((h) => h.id !== 'all').map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-line">
                  <Button size="sm" variant="outline" type="button" onClick={() => setTableModalOpen(false)}>
                    Bekor qilish
                  </Button>
                  <Button size="sm" variant="primary" type="submit" disabled={isSubmittingTable}>
                    {isSubmittingTable ? "Saqlanmoqda..." : "Stolni Yaratish"}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateBatchTables} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">Boshlang'ich raqam</label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={batchStartNumber}
                      onChange={(e) => setBatchStartNumber(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">Nechta stol qo'shilsin?</label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={batchCount}
                      onChange={(e) => setBatchCount(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">Tezkor tanlov:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[5, 10, 20, 50].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setBatchCount(cnt)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                          batchCount === cnt ? 'bg-brand text-white border-brand' : 'bg-bg text-ink-secondary border-line hover:border-brand/40'
                        }`}
                      >
                        +{cnt} ta
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBatchCount(Math.max(1, 100 - tablesList.length))}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 transition-colors"
                    >
                      🎯 100 tagacha to'ldirish (+{Math.max(0, 100 - tablesList.length)} ta)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">Har bir stol sig'imi</label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={batchCapacity}
                      onChange={(e) => setBatchCapacity(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">Zal</label>
                    <select
                      value={batchHallId}
                      onChange={(e) => setBatchHallId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink-main text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      {halls.filter((h) => h.id !== 'all').map((h) => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-bg border border-line text-xs text-ink-secondary space-y-1">
                  <div className="font-semibold text-ink-main">Avtomatik tartiblash:</div>
                  <div>
                    Stollar {batchStartNumber}-raqamdan boshlab ketma-ket generatsiya qilinadi. Mavjud bo'lgan raqamlar avtomatik o'tkazib yuboriladi.
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-line">
                  <Button size="sm" variant="outline" type="button" onClick={() => setTableModalOpen(false)}>
                    Bekor qilish
                  </Button>
                  <Button size="sm" variant="primary" type="submit" disabled={isSubmittingTable}>
                    {isSubmittingTable ? "Generatsiya qilinmoqda..." : `${batchCount} ta Stolni Generatsiya Qilish`}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 6. Standart Menyu va Xodim Modallari */}
      <MenuItemModal
        isOpen={menuItemModalOpen}
        onClose={() => setMenuItemModalOpen(false)}
        onSave={handleSaveMenuItem}
        initialData={editingItem}
        categories={categories.filter((c) => c.id !== 'all')}
        stations={stations}
      />

      <CategoryModal
        isOpen={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSave={handleSaveCategory}
        initialData={editingCategory}
      />

      <StaffModal
        isOpen={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        onSave={handleSaveStaff}
        initialData={editingStaff}
        availableStations={stations}
        availableTables={tablesList.map((t: any) => ({ id: t.id, number: t.number }))}
        actorRoles={currentUser?.isSuperAdmin ? [Role.SUPER_ADMIN] : [Role.MANAGER]}
        allowedRoles={settingsData.allowedRoles}
      />

      <ChangePasswordModal
        isOpen={changePasswordModalOpen}
        onClose={() => setChangePasswordModalOpen(false)}
        initialPhone={currentUser?.phone || ''}
        onSuccess={(updatedUser) => {
          if (updatedUser?.phone) {
            setCurrentUser((prev: any) => ({ ...prev, phone: updatedUser.phone }));
          }
        }}
      />

      <TableQrModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        table={selectedTableForQr}
        restaurantId={restaurantId}
        restaurantName={restaurantName || settingsData.name}
        onQrRegenerated={(tableId, newQrToken) => {
          setTablesList((prev) =>
            prev.map((t) => (t.id === tableId ? { ...t, qrToken: newQrToken } : t))
          );
          if (selectedTableForQr && selectedTableForQr.id === tableId) {
            setSelectedTableForQr({ ...selectedTableForQr, qrToken: newQrToken });
          }
        }}
      />

      <MenuPreviewModal
        isOpen={menuPreviewOpen}
        onClose={() => setMenuPreviewOpen(false)}
        restaurantId={restaurantId}
        restaurantName={restaurantName || settingsData.name}
        tables={tablesList}
        dishesCount={dishes.length}
        categoriesCount={categories.length}
      />
    </div>
  );
};
