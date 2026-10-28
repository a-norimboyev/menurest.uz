import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Layers,
  UtensilsCrossed,
  Settings,
  FileText,
  CheckCircle2,
  RefreshCw,
  Plus,
  Menu as MenuIcon,
  X,
  LogOut,
  Trash2,
  Edit2,
  QrCode,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Calendar,
  BarChart3,
  PieChart,
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
import { useRealtime } from '../hooks/useRealtime.ts';
import { ConnectionBanner } from '../components/ui/ConnectionBanner.tsx';
import { formatMoneyUzs, Role } from '@menurest/shared';

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

const ROLE_BADGE_CONFIG: Record<string, { label: string; variant: 'info' | 'success' | 'warning' | 'danger' | 'neutral' }> = {
  MANAGER: { label: 'Menejer', variant: 'info' },
  CASHIER: { label: 'Kassir', variant: 'success' },
  WAITER: { label: 'Ofitsiant', variant: 'warning' },
  SUPER_ADMIN: { label: 'Super Admin', variant: 'neutral' },
  BOSS: { label: 'Rahbar', variant: 'neutral' },
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
  const [_activeRole] = useState<'MANAGER'>(initialRole);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'menu' | 'staff' | 'reports' | 'settings'>('map');

  // Menejer profilingiz: Ism va Telefon
  const [profileName, setProfileName] = useState<string>(
    currentUser?.fullName || authProfile?.user?.fullName || 'Davron Aliyev'
  );
  const [profilePhone, setProfilePhone] = useState<string>(
    currentUser?.phone || authProfile?.user?.phone || '+998911000002'
  );

  useEffect(() => {
    if (currentUser?.fullName || authProfile?.user?.fullName) {
      setProfileName(currentUser?.fullName || authProfile?.user?.fullName || '');
    }
    if (currentUser?.phone || authProfile?.user?.phone) {
      setProfilePhone(currentUser?.phone || authProfile?.user?.phone || '');
    }
  }, [currentUser, authProfile]);

  // Restoran identifikatori va nomi
  const [restaurantId, setRestaurantId] = useState<string>(activeRestaurantId || authProfile?.activeRestaurant?.id || 'ef5ac39f-8794-499e-ada6-d2fc9632f8e8');
  const [restaurantName, setRestaurantName] = useState<string>(authProfile?.activeRestaurant?.name || '');
  const [, setUserPermissions] = useState<string[]>([]);

  const managerName = (currentUser?.fullName || authProfile?.user?.fullName || 'Davron Aliyev')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
  const roleTitle = currentUser?.isSuperAdmin ? 'ADMIN' : 'MENEJER';

  useEffect(() => {
    if (activeRestaurantId) setRestaurantId(activeRestaurantId);
    else if (authProfile?.activeRestaurant?.id) setRestaurantId(authProfile.activeRestaurant.id);
    if (authProfile?.activeRestaurant?.name) setRestaurantName(authProfile.activeRestaurant.name);
  }, [activeRestaurantId, authProfile]);

  // 1. Boss Dashboard Metrics (Server Aggregations)
  const [_bossMetrics, setBossMetrics] = useState<{
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

  // 2. Jonli Zallar va Stollar
  const [halls, setHalls] = useState<{ id: string; name: string }[]>([
    { id: 'all', name: 'Barcha Zallar' },
    { id: 'main', name: 'Asosiy Zal' },
    { id: 'terrace', name: 'Yozgi Terassa' },
  ]);
  const [tableStatusFilter, setTableStatusFilter] = useState<'all' | 'occupied' | 'free'>('all');
  const [tablesList, setTablesList] = useState<any[]>([
    { id: 't1', number: 1, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 4, status: 'OCCUPIED', activeMinutes: 45, totalTiyin: 48500000n },
    { id: 't2', number: 2, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 4, status: 'FREE' },
    { id: 't3', number: 3, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 6, status: 'OCCUPIED', activeMinutes: 20, totalTiyin: 12000000n },
    { id: 't4', number: 4, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 2, status: 'FREE' },
    { id: 't5', number: 5, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 4, status: 'FREE' },
    { id: 't6', number: 6, hall: { id: 'main', name: 'Asosiy Zal' }, capacity: 8, status: 'OCCUPIED', activeMinutes: 75, totalTiyin: 92000000n },
    { id: 't7', number: 7, hall: { id: 'terrace', name: 'Yozgi Terassa' }, capacity: 4, status: 'FREE' },
    { id: 't8', number: 8, hall: { id: 'terrace', name: 'Yozgi Terassa' }, capacity: 4, status: 'FREE' },
    { id: 't9', number: 9, hall: { id: 'terrace', name: 'Yozgi Terassa' }, capacity: 6, status: 'FREE' },
    { id: 't10', number: 10, hall: { id: 'terrace', name: 'Yozgi Terassa' }, capacity: 2, status: 'FREE' },
  ]);

  // 3. Menejer Vakolatidagi Tasdiqlar (Approvals)
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
    name: authProfile?.activeRestaurant?.name || '',
    phone: '',
    address: '',
    logoUrl: '',
    bannerUrl: '',
    openingHours: '09:00 - 23:00',
    defaultLanguage: 'uz',
    serviceChargeBps: 1000,
    allowedRoles: ['MANAGER', 'CASHIER', 'WAITER', 'GUEST'],
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // 8. Hisobotlar (Reports) - sukut bo'yicha har doim "Bugun" kunda turadi
  const [reportDateFrom, setReportDateFrom] = useState<string>(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
  });
  const [reportDateTo, setReportDateTo] = useState<string>(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
  });
  const [reportPreset, setReportPreset] = useState<'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom'>('today');
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');
  const [hoveredDay, setHoveredDay] = useState<any | null>(null);
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

  // 11. Stol Qo'shish Modali
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState<number>(1);
  const tableCapacity = 4;
  const [tableHallId, setTableHallId] = useState<string>('');
  const [isSubmittingTable, setIsSubmittingTable] = useState(false);

  // QR Kod Modali
  const [selectedTableForQr, setSelectedTableForQr] = useState<any | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // Stolni Tahrirlash Modali
  const [editTableModalOpen, setEditTableModalOpen] = useState(false);
  const [selectedTableForEdit, setSelectedTableForEdit] = useState<any | null>(null);
  const [editTableNumber, setEditTableNumber] = useState<number>(1);

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
      let res = await fetch(`/api/v1/restaurants/${restaurantId}/staff`, { credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ phone: '+998911000002', password: '+998911000002' }),
        });
        res = await fetch(`/api/v1/restaurants/${restaurantId}/staff`, { credentials: 'include' });
      }
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
          name: json.data.name || authProfile?.activeRestaurant?.name || '',
          phone: json.data.phone || '',
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


  const applyDatePreset = useCallback((preset: 'today' | 'yesterday' | '7days' | '30days' | 'all') => {
    setReportPreset(preset);
    const to = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
    let from = to;
    if (preset === 'today') {
      from = to;
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      from = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(y);
      setReportDateFrom(from);
      setReportDateTo(from);
      loadDetailedReports(from, from);
      return;
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      from = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
    } else if (preset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      from = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
    } else if (preset === 'all') {
      const d = new Date();
      d.setDate(d.getDate() - 120);
      from = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
    }
    setReportDateFrom(from);
    setReportDateTo(to);
    loadDetailedReports(from, to);
  }, [loadDetailedReports]);

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
      loadTables();
    }
  }, [loadDashboardMetrics, loadTables]);

  const { status } = useRealtime({
    restaurantId,
    onEvent: handleRealtimeEvent,
  });

  // Initial Data Load
  useEffect(() => {
    loadDashboardMetrics();
    loadTables();
    loadStaffList();
    loadSettings();
    loadMenuItems();
    loadStations();
  }, [loadDashboardMetrics, loadTables, loadStaffList, loadSettings, loadMenuItems, loadStations]);

  useEffect(() => {
    if (activeTab === 'reports') {
      applyDatePreset('today');
    }
  }, [activeTab, applyDatePreset]);

  // Sozlamalarni saqlash (Til, Ism, Telefon va Parol)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    setSettingsSuccess(null);

    const hasPasswordChange = Boolean(currentPassword || newPassword || confirmPassword);
    if (hasPasswordChange) {
      if (!currentPassword) {
        setSettingsError("Parolni o'zgartirish uchun amaldagi parolingizni kiriting.");
        return;
      }
      if (!newPassword || newPassword.length < 6) {
        setSettingsError("Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setSettingsError("Yangi parol va tasdiqlovchi parol bir-biriga mos kelmadi.");
        return;
      }
    }

    try {
      setSavingSettings(true);
      const csrfToken = getCsrfToken();

      // 1. Profilni yangilash (Ism va telefon)
      if (profileName.trim() || profilePhone.trim()) {
        const profRes = await fetch('/api/v1/auth/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({
            fullName: profileName.trim(),
            phone: profilePhone.trim(),
          }),
        });
        const profData = await profRes.json();
        if (profRes.ok && profData.success) {
          setCurrentUser((prev: any) => ({
            ...prev,
            fullName: profileName.trim(),
            phone: profilePhone.trim(),
          }));
          window.dispatchEvent(new Event('menurest_auth_change'));
        } else if (!profRes.ok) {
          throw new Error(profData.error?.message || 'Ism yoki telefonni saqlashda xatolik');
        }
      }

      // 2. Parolni yangilash (agar kiritilgan bo'lsa)
      if (hasPasswordChange) {
        const credRes = await fetch('/api/v1/auth/update-credentials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({
            currentPassword: currentPassword,
            newPassword: newPassword,
            newPhone: profilePhone.trim() || undefined,
          }),
        });
        const credData = await credRes.json();
        if (!credRes.ok || !credData.success) {
          throw new Error(credData.error?.message || 'Parolni yangilashda xatolik');
        }
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }

      // 3. Til sozlamasini saqlash
      localStorage.setItem('menurest_lang', settingsData.defaultLanguage || 'uz');
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        credentials: 'include',
        body: JSON.stringify({
          defaultLanguage: settingsData.defaultLanguage || 'uz',
        }),
      });
      const json = await res.json();
      if (!json.success) {
        console.warn('Til sozlamasini saqlashda ogohlantirish:', json.error);
      }

      setSettingsSuccess("Sozlamalar muvaffaqiyatli saqlandi!");
      setTimeout(() => setSettingsSuccess(null), 4000);
    } catch (err: any) {
      setSettingsError(err.message || 'Sozlamalarni saqlashda xatolik yuz berdi');
    } finally {
      setSavingSettings(false);
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
        alert(json.error?.message || 'Chegirma kiritish rad etildi, vakolat yetarli emas');
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
        alert(json.error?.message || 'Refund qilish rad etildi, vakolat yetarli emas');
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

    const payload: any = { ...formData };
    if (isEdit && (!payload.password || !payload.password.trim())) {
      delete payload.password;
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || 'Xodimni saqlashda xatolik');
    }

    // Agar joriy foydalanuvchi o'z profilini tahrirlagan bo'lsa, uni headerda ham yangilaymiz
    if (currentUser && (formData.userId === currentUser.id || formData.id === currentUser.id)) {
      setCurrentUser((prev: any) => ({
        ...prev,
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
      }));
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

  const openEditTableModal = (tbl: any) => {
    setSelectedTableForEdit(tbl);
    setEditTableNumber(Number(tbl.number) || 1);
    setEditTableModalOpen(true);
  };

  const handleUpdateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTableForEdit) return;
    try {
      setIsSubmittingTable(true);
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/tables/${selectedTableForEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({
          number: editTableNumber,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || 'Stolni yangilashda xatolik yuz berdi');
        return;
      }
      setEditTableModalOpen(false);
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



  const tableCounts = useMemo(() => {
    const occupied = tablesList.filter((t) => t.status === 'OCCUPIED').length;
    const free = tablesList.filter((t) => t.status !== 'OCCUPIED').length;
    return { all: tablesList.length, occupied, free };
  }, [tablesList]);

  const filteredTables = useMemo(() => {
    return tablesList.filter((t) => {
      const isOccupied = t.status === 'OCCUPIED';
      if (tableStatusFilter === 'occupied') return isOccupied;
      if (tableStatusFilter === 'free') return !isOccupied;
      return true;
    });
  }, [tablesList, tableStatusFilter]);

  const filteredDishes = useMemo(() => {
    return dishes.filter((d) => {
      return selectedMenuCategory === 'all' || d.categoryId === selectedMenuCategory;
    });
  }, [dishes, selectedMenuCategory]);

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

            <div className="flex items-center space-x-2 md:px-3.5 min-w-0">
              <span className="font-extrabold text-ink-main text-base sm:text-lg tracking-tight">
                Boshqaruv paneli
              </span>
            </div>
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
              <div className="px-1">
                <span className="font-bold text-base text-ink-main block">
                  Boshqaruv paneli
                </span>
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

            <div className="pt-2 border-t border-line space-y-2">
              <div className="px-3 py-2 bg-bg rounded-xl border border-line text-xs">
                <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider block">
                  {roleTitle}
                </span>
                <span className="font-bold text-ink-main truncate block mt-0.5">
                  {managerName}
                </span>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold border border-rose-200 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Chiqish</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Container with Docked Left Sidebar */}
      <div className="flex-1 flex w-full">
        {/* DESKTOP SIDEBAR - DOCKED TO HEADER (TEGIB TURGAN) */}
        <aside className="w-64 shrink-0 hidden md:flex flex-col justify-between sticky top-16 h-[calc(100vh-4rem)] bg-surface border-r border-line p-3 z-20">
          <div className="overflow-y-auto space-y-1">
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
                (activeTab === 'reports' || activeTab === 'overview') ? 'bg-brand text-white shadow-sm' : 'text-ink-secondary hover:bg-bg hover:text-ink-main'
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

          {/* Sidebar pastki qismi: Foydalanuvchi kartochkasi */}
          <div className="pt-3 border-t border-line space-y-2">
            <div className="px-3 py-2 bg-bg rounded-xl border border-line text-xs">
              <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider block">
                {roleTitle}
              </span>
              <span className="font-bold text-ink-main truncate block mt-0.5">
                {managerName}
              </span>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold border border-rose-200 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Chiqish</span>
              </button>
            )}
          </div>
        </aside>

        {/* MAIN VIEW CONTENT */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">

          {/* TAB 2: LIVE TABLE MAP */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              {/* Controls bar: Filter chips + Add button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-line shadow-subtle">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setTableStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      tableStatusFilter === 'all'
                        ? 'bg-ink-main text-white shadow-sm'
                        : 'bg-bg text-ink-secondary hover:text-ink-main border border-line'
                    }`}
                  >
                    Barchasi <span className="opacity-80 ml-1">{tableCounts.all}</span>
                  </button>

                  <button
                    onClick={() => setTableStatusFilter('occupied')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      tableStatusFilter === 'occupied'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Band <span className="opacity-80 ml-1">{tableCounts.occupied}</span>
                  </button>

                  <button
                    onClick={() => setTableStatusFilter('free')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      tableStatusFilter === 'free'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Bo'sh <span className="opacity-80 ml-1">{tableCounts.free}</span>
                  </button>
                </div>

                <div className="flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={openSingleTableModal}
                    className="text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Stol Qo'shish
                  </Button>
                </div>
              </div>



              {/* Grid of Tables */}
              {filteredTables.length === 0 ? (
                <div className="text-center py-12 bg-surface rounded-2xl border border-line p-6">
                  <p className="text-sm font-semibold text-ink-muted">
                    Tanlangan filtr bo'yicha stollar topilmadi.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredTables.map((tbl: any) => {
                    const isOccupied = tbl.status === 'OCCUPIED';

                    return (
                      <div
                        key={tbl.id}
                        className={`rounded-2xl border p-4 shadow-subtle flex flex-col justify-between space-y-3.5 transition-all ${
                          isOccupied
                            ? 'bg-surface border-amber-300 ring-1 ring-amber-400/20 shadow-md'
                            : 'bg-surface border-line hover:border-slate-300'
                        }`}
                      >
                        {/* Header: Table Number & Status Badge + Delete */}
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xl font-black text-ink-main block">
                              Stol {tbl.number}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Status type="table" value={isOccupied ? 'OCCUPIED' : 'FREE'} />
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

                        {/* Card Info Body */}
                        {isOccupied ? (
                          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs">
                            {tbl.totalTiyin !== undefined ? (
                              <div className="flex items-center justify-between font-black text-sm text-brand">
                                <span>Hisob:</span>
                                <Money amountTiyin={BigInt(tbl.totalTiyin)} />
                              </div>
                            ) : (
                              <div className="text-[11px] text-amber-800 font-medium">
                                Stol hozirda band
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1 text-xs">
                            <div className="text-[11px] text-emerald-700 font-medium">
                              Buyurtma qabul qilishga tayyor
                            </div>
                          </div>
                        )}

                        {/* QR Kod Tugmasi */}
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
                          className="w-full py-2 px-2.5 rounded-xl border border-brand/30 bg-brand-50/50 hover:bg-brand-50 text-xs font-bold text-brand flex items-center justify-center gap-1.5 transition-colors min-h-[36px]"
                          title="Stol QR kodini ko'rish va chop etish"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR Kod</span>
                        </button>

                        {/* ENG PAST QISMIDA: Tahrirlash tugmasi */}
                        <button
                          onClick={() => openEditTableModal(tbl)}
                          className="w-full py-2 px-3 rounded-xl border border-line bg-bg hover:bg-surface text-xs font-semibold text-ink-main flex items-center justify-center gap-1.5 transition-colors min-h-[36px]"
                          title={`${tbl.number}-raqamli stolni tahrirlash`}
                        >
                          <Edit2 className="w-3.5 h-3.5 text-brand" />
                          <span>Tahrirlash</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MENU & AVAILABILITY */}
          {activeTab === 'menu' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-ink-main">Menyu</h3>
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

              {/* Categories Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <button
                  onClick={() => setSelectedMenuCategory('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap min-h-[40px] transition-all ${
                    selectedMenuCategory === 'all'
                      ? 'bg-brand text-white shadow-sm'
                      : 'bg-surface border border-line text-ink-secondary hover:bg-bg hover:text-ink-main'
                  }`}
                >
                  Barchasi ({dishes.length})
                </button>
                {categories.map((c) => {
                  const count = dishes.filter((d) => d.categoryId === c.id).length;
                  const isSelected = selectedMenuCategory === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedMenuCategory(c.id)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold whitespace-nowrap min-h-[40px] flex items-center gap-1.5 transition-all shadow-xs ${
                        isSelected
                          ? 'bg-brand text-white border-brand shadow-sm'
                          : 'bg-surface border-line text-ink-secondary hover:bg-bg hover:text-ink-main'
                      }`}
                    >
                      <span>{c.name}</span>
                      {count > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-bg text-ink-secondary'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-dashed border-brand/50 text-brand text-xs font-bold hover:bg-brand-50 flex items-center gap-1.5 min-h-[40px] whitespace-nowrap transition-colors"
                  title="Yangi kategoriya qo'shish"
                >
                  <Plus className="w-3.5 h-3.5" /> Kategoriya qo'shish
                </button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Taom</TableHead>
                    <TableHead>Kategoriya</TableHead>
                    <TableHead>Narx</TableHead>
                    <TableHead>Mavjudlik</TableHead>
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
                          {dish.isAvailable ? 'Mavjud' : 'Tugagan'}
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
                    <TableHead>Lavozimi</TableHead>
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
                            {member.roles.map((r: string) => {
                              const conf = ROLE_BADGE_CONFIG[r] || { label: r, variant: 'neutral' as const };
                              return (
                                <Badge key={r} variant={conf.variant} size="sm">
                                  {conf.label}
                                </Badge>
                              );
                            })}
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
                              password: member.plainPassword || '',
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

          {/* TAB 5: HISOBOTLAR */}
          {(activeTab === 'reports' || activeTab === 'overview') && (
            <div className="space-y-6">
              {/* Davriy Filtrlash Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-surface rounded-2xl border border-line shadow-subtle">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ink-main">Savdo va Tushum Tahlili</h3>
                    <p className="text-xs text-ink-secondary mt-0.5">
                      Davriy faoliyat, moliyaviy aylanma va grafik tahlillar
                    </p>
                  </div>
                </div>

                {/* Date range presets and custom inputs */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => applyDatePreset('today')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        reportPreset === 'today'
                          ? 'bg-brand text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      Bugun
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDatePreset('yesterday')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        reportPreset === 'yesterday'
                          ? 'bg-brand text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      Kecha
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDatePreset('7days')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        reportPreset === '7days'
                          ? 'bg-brand text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      7 kun
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDatePreset('30days')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        reportPreset === '30days'
                          ? 'bg-brand text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      30 kun
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDatePreset('all')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        reportPreset === 'all'
                          ? 'bg-brand text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      Barchasi
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Input
                      type="date"
                      value={reportDateFrom}
                      onChange={(e) => {
                        setReportDateFrom(e.target.value);
                        setReportPreset('custom');
                      }}
                      className="w-32 text-xs"
                    />
                    <span className="text-xs text-ink-secondary font-bold">—</span>
                    <Input
                      type="date"
                      value={reportDateTo}
                      onChange={(e) => {
                        setReportDateTo(e.target.value);
                        setReportPreset('custom');
                      }}
                      className="w-32 text-xs"
                    />
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => loadDetailedReports(reportDateFrom, reportDateTo)}
                    disabled={loadingReports}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingReports ? 'animate-spin' : ''}`} /> Tahlil
                  </Button>
                </div>
              </div>

              {detailedReports ? (
                <div className="space-y-6">
                  {/* 3. To'lovlar va Buyurtmalar Taqsimoti */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-surface rounded-2xl border border-line shadow-subtle space-y-1">
                      <span className="text-xs text-ink-secondary font-semibold">Jami Buyurtmalar</span>
                      <div className="text-2xl font-black font-mono text-ink-main">
                        {detailedReports.ordersSummary?.totalOrdersCount ?? 0} <span className="text-xs font-normal text-ink-secondary">ta</span>
                      </div>
                    </div>

                    <div className="p-4 bg-surface rounded-2xl border border-line shadow-subtle space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-ink-secondary font-semibold">Naqd To'lovlar</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          {(() => {
                            const c = BigInt(detailedReports.paymentsSummary?.cashPaymentsTiyin || 0);
                            const t = BigInt(detailedReports.paymentsSummary?.terminalPaymentsTiyin || 0);
                            const sum = c + t;
                            return sum > 0n ? `${Math.round(Number((c * 1000n) / sum) / 10)}%` : '0%';
                          })()}
                        </span>
                      </div>
                      <div className="text-xl font-bold font-mono text-emerald-700">
                        <Money amountTiyin={BigInt(detailedReports.paymentsSummary?.cashPaymentsTiyin || 0)} />
                      </div>
                      <span className="text-[11px] text-ink-secondary font-medium">Kassaga kirim qilingan</span>
                    </div>

                    <div className="p-4 bg-surface rounded-2xl border border-line shadow-subtle space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-ink-secondary font-semibold">Terminal To'lovlar</span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          {(() => {
                            const c = BigInt(detailedReports.paymentsSummary?.cashPaymentsTiyin || 0);
                            const t = BigInt(detailedReports.paymentsSummary?.terminalPaymentsTiyin || 0);
                            const sum = c + t;
                            return sum > 0n ? `${Math.round(Number((t * 1000n) / sum) / 10)}%` : '0%';
                          })()}
                        </span>
                      </div>
                      <div className="text-xl font-bold font-mono text-blue-700">
                        <Money amountTiyin={BigInt(detailedReports.paymentsSummary?.terminalPaymentsTiyin || 0)} />
                      </div>
                      <span className="text-[11px] text-ink-secondary font-medium">Karta / QR to'lovlar</span>
                    </div>
                  </div>

                  {/* 4. 📈 GRAFIKLAR VA DIAGRAMMALAR BO'LIMI */}
                  {/* Grafik 1: Savdo va Tushum Dinamikasi (Kunlik Ustunli Grafik) */}
                  <div className="bg-surface rounded-2xl border border-line shadow-subtle p-5 sm:p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand flex items-center justify-center shrink-0">
                          <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-ink-main text-base">Savdo va Tushum Dinamikasi</h4>
                          <p className="text-xs text-ink-secondary mt-0.5">
                            Kunlik tushum va buyurtmalar o'zgarishi
                          </p>
                        </div>
                      </div>

                      {/* Metric Switcher: Tushum vs Buyurtmalar */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <div className="p-1 bg-slate-100 rounded-xl flex items-center text-xs">
                          <button
                            type="button"
                            onClick={() => setChartMetric('revenue')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                              chartMetric === 'revenue'
                                ? 'bg-white text-brand shadow-sm font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            💰 Tushum (UZS)
                          </button>
                          <button
                            type="button"
                            onClick={() => setChartMetric('orders')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                              chartMetric === 'orders'
                                ? 'bg-white text-brand shadow-sm font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            🧾 Buyurtmalar
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Summary Metrics Chips */}
                    {(() => {
                      const days: any[] = detailedReports.dailyBreakdown || [];
                      const maxRevTiyin = days.reduce((m, d) => {
                        const v = BigInt(d.netReceiptsTiyin || 0);
                        return v > m ? v : m;
                      }, 0n);
                      const totalRevTiyin = days.reduce((s, d) => s + BigInt(d.netReceiptsTiyin || 0), 0n);
                      const avgRevTiyin = days.length > 0 ? totalRevTiyin / BigInt(days.length) : 0n;
                      const totalOrdersCount = days.reduce((s, d) => s + (d.ordersCount || 0), 0);
                      const maxOrdersCount = days.reduce((m, d) => Math.max(m, d.ordersCount || 0), 0);

                      if (days.length === 0) {
                        return (
                          <div className="py-8 text-center text-xs text-ink-secondary">
                            Tanlangan davr uchun dinamik ma'lumotlar mavjud emas
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50/70 rounded-xl border border-slate-100 text-xs">
                            <div>
                              <span className="text-[11px] text-slate-500">Maksimal kunlik:</span>
                              <div className="font-bold font-mono text-ink-main">
                                {chartMetric === 'revenue' ? <Money amountTiyin={maxRevTiyin} /> : `${maxOrdersCount} ta`}
                              </div>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-500">O'rtacha kunlik:</span>
                              <div className="font-bold font-mono text-ink-main">
                                {chartMetric === 'revenue' ? <Money amountTiyin={avgRevTiyin} /> : `${(totalOrdersCount / Math.max(days.length, 1)).toFixed(1)} ta`}
                              </div>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-500">Jami faol kunlar:</span>
                              <div className="font-bold font-mono text-ink-main">{days.length} kun</div>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-500">O'rtacha chek:</span>
                              <div className="font-bold font-mono text-brand">
                                {totalOrdersCount > 0 ? <Money amountTiyin={totalRevTiyin / BigInt(totalOrdersCount)} /> : '0'}
                              </div>
                            </div>
                          </div>

                          {/* Visual Bar Chart Canvas */}
                          <div className="relative pt-6 pb-2">
                            {/* Guide lines (horizontal dashed lines) */}
                            <div className="absolute inset-x-0 top-6 bottom-8 pointer-events-none flex flex-col justify-between">
                              <div className="border-b border-dashed border-slate-200 w-full relative">
                                <span className="absolute -top-3 right-0 text-[10px] font-mono text-slate-400">
                                  {chartMetric === 'revenue' ? formatMoneyUzs(maxRevTiyin) : `${maxOrdersCount} ta`}
                                </span>
                              </div>
                              <div className="border-b border-dashed border-slate-100 w-full relative">
                                <span className="absolute -top-3 right-0 text-[10px] font-mono text-slate-300">
                                  {chartMetric === 'revenue' ? formatMoneyUzs(maxRevTiyin / 2n) : `${Math.round(maxOrdersCount / 2)} ta`}
                                </span>
                              </div>
                              <div className="border-b border-slate-200 w-full"></div>
                            </div>

                            {/* Bars Row with smooth scrolling */}
                            <div className="relative h-56 sm:h-64 flex items-end gap-2 sm:gap-3 overflow-x-auto no-scrollbar pt-6 pb-1 px-2">
                              {days.map((day: any) => {
                                const rev = BigInt(day.netReceiptsTiyin || 0);
                                const heightPct = chartMetric === 'revenue'
                                  ? (maxRevTiyin > 0n ? Math.max(Number((rev * 100n) / maxRevTiyin), rev > 0n ? 8 : 2) : 2)
                                  : (maxOrdersCount > 0 ? Math.max((day.ordersCount / maxOrdersCount) * 100, day.ordersCount > 0 ? 8 : 2) : 2);

                                const isHovered = hoveredDay?.date === day.date;

                                return (
                                  <div
                                    key={day.date}
                                    onMouseEnter={() => setHoveredDay(day)}
                                    onMouseLeave={() => setHoveredDay(null)}
                                    className="flex-1 min-w-[34px] sm:min-w-[42px] max-w-[64px] h-full flex flex-col justify-end items-center group relative cursor-pointer"
                                  >
                                    {/* Tooltip on Hover */}
                                    {isHovered && (
                                      <div className="absolute -top-24 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-left pointer-events-none whitespace-nowrap border border-slate-700 animate-in fade-in duration-150">
                                        <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-700 pb-1 mb-1">
                                          <Calendar className="w-3 h-3 text-brand-300" />
                                          <span>{day.dayLabel} ({day.date})</span>
                                        </div>
                                        <div className="text-[11px] space-y-0.5">
                                          <div className="flex justify-between gap-3 text-emerald-400 font-mono font-bold">
                                            <span>Sof Tushum:</span>
                                            <span>{formatMoneyUzs(day.netReceiptsTiyin)}</span>
                                          </div>
                                          <div className="flex justify-between gap-3 text-slate-300 font-mono text-[10px]">
                                            <span>Naqd:</span>
                                            <span>{formatMoneyUzs(day.cashTiyin)}</span>
                                          </div>
                                          <div className="flex justify-between gap-3 text-slate-300 font-mono text-[10px]">
                                            <span>Terminal:</span>
                                            <span>{formatMoneyUzs(day.terminalTiyin)}</span>
                                          </div>
                                          <div className="flex justify-between gap-3 text-amber-300 font-mono text-[10px] pt-0.5 border-t border-slate-800">
                                            <span>Buyurtmalar:</span>
                                            <span>{day.ordersCount} ta</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* The Bar */}
                                    <div className="w-full flex justify-center items-end h-[calc(100%-24px)]">
                                      <div
                                        style={{ height: `${heightPct}%` }}
                                        className={`w-full max-w-[28px] rounded-t-lg transition-all duration-300 relative ${
                                          isHovered
                                            ? 'bg-gradient-to-t from-brand-600 to-teal-400 shadow-lg scale-105 ring-2 ring-brand-300'
                                            : rev > 0n
                                              ? 'bg-gradient-to-t from-brand-700 to-emerald-500 hover:from-brand-600 hover:to-emerald-400'
                                              : 'bg-slate-200'
                                        }`}
                                      >
                                        {/* Top micro badge if height allows */}
                                        {heightPct > 35 && (
                                          <div className="absolute top-1 inset-x-0 text-center opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-white font-bold">
                                            {chartMetric === 'revenue' ? `${Math.round(Number(rev / 100000000n))}M` : day.ordersCount}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Day label */}
                                    <span className={`text-[10px] font-mono mt-1.5 transition-colors text-center truncate w-full ${
                                      isHovered ? 'font-bold text-brand' : 'text-slate-500'
                                    }`}>
                                      {day.dayLabel}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Grafik 2: To'lov Usullari Taqsimoti (SVG Donut Chart) */}
                  <div className="bg-surface rounded-2xl border border-line shadow-subtle p-5 sm:p-6 space-y-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <PieChart className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-ink-main text-base">To'lov Usullari Taqsimoti</h4>
                          <p className="text-xs text-ink-secondary mt-0.5">
                            Naqd va terminal (karta/QR) to'lovlar nisbati
                          </p>
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const cash = BigInt(detailedReports.paymentsSummary?.cashPaymentsTiyin || 0);
                      const terminal = BigInt(detailedReports.paymentsSummary?.terminalPaymentsTiyin || 0);
                      const total = cash + terminal;
                      const cashPct = total > 0n ? Math.round(Number((cash * 1000n) / total) / 10) : 0;
                      const termPct = total > 0n ? Math.round(Number((terminal * 1000n) / total) / 10) : 0;

                      // SVG Donut params
                      const radius = 54;
                      const circ = 2 * Math.PI * radius; // ~339.29
                      const cashStroke = total > 0n ? (cashPct / 100) * circ : 0;
                      const termStroke = total > 0n ? (termPct / 100) * circ : 0;

                      return (
                        <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
                          {/* SVG Donut Graphic */}
                          <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 140 140">
                              {/* Track circle */}
                              <circle
                                cx="70"
                                cy="70"
                                r={radius}
                                className="stroke-slate-100"
                                strokeWidth="20"
                                fill="transparent"
                              />
                              {/* Cash Segment (Emerald) */}
                              {cashStroke > 0 && (
                                <circle
                                  cx="70"
                                  cy="70"
                                  r={radius}
                                  stroke="#0F5C3C"
                                  strokeWidth="20"
                                  strokeDasharray={`${cashStroke} ${circ}`}
                                  strokeDashoffset="0"
                                  strokeLinecap="round"
                                  fill="transparent"
                                  className="transition-all duration-700 ease-out"
                                />
                              )}
                              {/* Terminal Segment (Blue) */}
                              {termStroke > 0 && (
                                <circle
                                  cx="70"
                                  cy="70"
                                  r={radius}
                                  stroke="#2563EB"
                                  strokeWidth="20"
                                  strokeDasharray={`${termStroke} ${circ}`}
                                  strokeDashoffset={`${-cashStroke}`}
                                  strokeLinecap="round"
                                  fill="transparent"
                                  className="transition-all duration-700 ease-out"
                                />
                              )}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Jami Tushum</span>
                              <span className="text-xs font-black font-mono text-slate-900 mt-0.5 truncate max-w-[110px]">
                                <Money amountTiyin={detailedReports.paymentsSummary?.netReceiptsTiyin || 0} />
                              </span>
                            </div>
                          </div>

                          {/* Legend and details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
                            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2.5">
                                <span className="w-3.5 h-3.5 rounded-full bg-emerald-700 shrink-0" />
                                <div>
                                  <div className="text-xs font-bold text-slate-800">Naqd To'lovlar</div>
                                  <div className="text-xs text-emerald-800 font-mono font-bold mt-0.5">
                                    <Money amountTiyin={cash} />
                                  </div>
                                </div>
                              </div>
                              <span className="text-sm font-black font-mono text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                                {cashPct}%
                              </span>
                            </div>

                            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2.5">
                                <span className="w-3.5 h-3.5 rounded-full bg-blue-600 shrink-0" />
                                <div>
                                  <div className="text-xs font-bold text-slate-800">Terminal (Karta / QR)</div>
                                  <div className="text-xs text-blue-800 font-mono font-bold mt-0.5">
                                    <Money amountTiyin={terminal} />
                                  </div>
                                </div>
                              </div>
                              <span className="text-sm font-black font-mono text-blue-800 bg-white px-2.5 py-1 rounded-lg border border-blue-200">
                                {termPct}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 5. Mashhur Taomlar Jadvali (Barchasi) */}
                  <div className="bg-surface rounded-2xl border border-line shadow-subtle p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UtensilsCrossed className="w-4 h-4 text-brand" />
                        <h4 className="font-bold text-ink-main text-sm">Sotilgan Taomlar Tahlili (Barchasi)</h4>
                      </div>
                      <span className="text-xs text-ink-secondary font-mono">
                        {(detailedReports.popularDishes || []).length} xil taom
                      </span>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto rounded-xl border border-line/60">
                      <Table>
                        <TableHeader className="sticky top-0 bg-surface z-10 shadow-sm">
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
                  </div>

                  {/* 6. Ofitsiantlar Ko'rsatkichi */}
                  <div className="bg-surface rounded-2xl border border-line shadow-subtle p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-brand" />
                        <h4 className="font-bold text-ink-main text-sm">Ofitsiantlar Xizmat Ko'rsatkichi</h4>
                      </div>
                      <span className="text-xs text-ink-secondary font-mono">
                        {(detailedReports.waiterPerformance || []).length} nafar xodim
                      </span>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto rounded-xl border border-line/60">
                      <Table>
                        <TableHeader className="sticky top-0 bg-surface z-10 shadow-sm">
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
                                <TableCell className="font-semibold text-ink-main">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand font-bold text-xs flex items-center justify-center shrink-0 border border-brand-100">
                                      {w.waiterName.slice(0, 1)}
                                    </div>
                                    <div>
                                      <div className="font-bold text-ink-main text-sm">{w.waiterName}</div>
                                      {w.phone && (
                                        <div className="text-[11px] text-ink-secondary font-mono">
                                          {w.phone}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center font-mono font-bold text-ink-main">
                                  <span className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100">
                                    {w.servedOrdersCount} ta
                                  </span>
                                </TableCell>
                                <TableCell className="text-center font-mono font-bold text-ink-main">
                                  <span className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100">
                                    {w.resolvedCallsCount} ta
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-brand text-sm">
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
                </div>
              ) : (
                <div className="p-8 text-center text-ink-secondary text-sm">Hisobotlar yuklanmoqda...</div>
              )}
            </div>
          )}

          {/* TAB 7: RESTAURANT & PROFILE SETTINGS */}
          {activeTab === 'settings' && (
            <div className="bg-surface rounded-2xl border border-line shadow-subtle p-6 space-y-6 max-w-lg">
              <div>
                <h3 className="text-base font-bold text-ink-main">Sozlamalar</h3>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Til, shaxsiy ma'lumotlar va xavfsizlik sozlamalari
                </p>
              </div>

              {settingsSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{settingsSuccess}</span>
                </div>
              )}

              {settingsError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <X className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>{settingsError}</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-5">
                {/* 1. Tilni tanlash */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-main">
                    <Globe className="w-3.5 h-3.5 text-brand" />
                    <span>Dastur tili</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { code: 'uz', label: "O'zbekcha", flag: "🇺🇿" },
                      { code: 'ru', label: "Русский", flag: "🇷🇺" },
                      { code: 'en', label: "English", flag: "🇬🇧" },
                    ].map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setSettingsData({ ...settingsData, defaultLanguage: lang.code })}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-h-[40px] ${
                          settingsData.defaultLanguage === lang.code
                            ? 'bg-brand text-white border-brand shadow-sm ring-2 ring-brand/20'
                            : 'bg-surface border-line text-ink-secondary hover:bg-bg hover:text-ink-main'
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. To'liq ism */}
                <div>
                  <label className="block text-xs font-semibold text-ink-main mb-1">To'liq ism</label>
                  <Input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Masalan: Davron Aliyev"
                    required
                  />
                </div>

                {/* 3. Telefon raqami */}
                <div>
                  <label className="block text-xs font-semibold text-ink-main mb-1">Telefon raqami</label>
                  <Input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="+998901234567"
                    required
                  />
                </div>

                {/* 4. Parolni o'zgartirish */}
                <div className="pt-3 border-t border-line space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-main">
                      <KeyRound className="w-3.5 h-3.5 text-brand" />
                      <span>Parolni o'zgartirish</span>
                    </label>
                    <span className="text-[11px] text-ink-secondary">(Ixtiyoriy)</span>
                  </div>

                  <div className="space-y-3 bg-bg/60 p-3.5 rounded-xl border border-line">
                    {/* Amaldagi parol */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-ink-secondary block">Amaldagi parol</span>
                      <div className="relative">
                        <Input
                          type={showCurrentPass ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Amaldagi parolingiz"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPass(!showCurrentPass)}
                          className="absolute right-3 top-2.5 text-ink-secondary hover:text-ink-main transition-colors"
                        >
                          {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Yangi parol */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-ink-secondary block">Yangi parol</span>
                      <div className="relative">
                        <Input
                          type={showNewPass ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Kamida 6 ta belgi"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass(!showNewPass)}
                          className="absolute right-3 top-2.5 text-ink-secondary hover:text-ink-main transition-colors"
                        >
                          {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Yangi parolni tasdiqlash */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-ink-secondary block">Yangi parolni takrorlang</span>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Yangi parolni qayta kiriting"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-line flex justify-end">
                  <Button type="submit" variant="primary" disabled={savingSettings} className="min-w-[120px]">
                    {savingSettings ? 'Saqlanmoqda...' : 'Saqlash'}
                  </Button>
                </div>
              </form>
            </div>
          )}

        </main>
      </div>

      {/* MODALS */}



      {/* Stolni Tahrirlash Modali */}
      {editTableModalOpen && selectedTableForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-xl border border-line p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-ink-main text-base">
                Stol {selectedTableForEdit.number} ni Tahrirlash
              </h3>
              <button onClick={() => setEditTableModalOpen(false)} className="text-ink-secondary hover:text-ink-main">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTable} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Stol Raqami</label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={editTableNumber}
                  onChange={(e) => setEditTableNumber(Number(e.target.value))}
                  required
                />
              </div>



              <div className="pt-2 flex justify-end gap-2 border-t border-line">
                <Button size="sm" variant="outline" type="button" onClick={() => setEditTableModalOpen(false)}>
                  Bekor qilish
                </Button>
                <Button size="sm" variant="primary" type="submit" disabled={isSubmittingTable}>
                  {isSubmittingTable ? "Saqlanmoqda..." : "Saqlash"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Chegirma Kiritish Modali */}
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
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Tashrif IDsi</label>
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
                  Foiz %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountForm({ ...discountForm, isPercent: false })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${!discountForm.isPercent ? 'bg-brand text-white' : 'bg-bg text-ink-secondary border border-line'}`}
                >
                  Qat'iy Summa
                </button>
              </div>

              {discountForm.isPercent ? (
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">Chegirma Foizi</label>
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
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">Chegirma Summasi</label>
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
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Sababi</label>
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
              <h3 className="font-bold text-ink-main text-base">Pul Qaytarishni Tasdiqlash</h3>
              <button onClick={() => setRefundModalOpen(false)} className="text-ink-secondary hover:text-ink-main">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApproveRefund} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">To'lov IDsi</label>
                <Input
                  value={refundForm.paymentId}
                  onChange={(e) => setRefundForm({ ...refundForm, paymentId: e.target.value })}
                  placeholder="Asl to'lov yozuvi IDsi..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Qaytariladigan Summa</label>
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
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Qaytarish Sababi</label>
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

      {/* 5. Stol Qo'shish Modali */}
      {tableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overscroll-contain">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-xl border border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-bold text-ink-main text-base">
                  Yangi Stol Qo'shish
                </h3>
                <p className="text-xs text-ink-secondary">
                  Hozirda jami {tablesList.length} ta stol mavjud
                </p>
              </div>
              <button onClick={() => setTableModalOpen(false)} className="text-ink-secondary hover:text-ink-main">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="space-y-4">
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

              <div className="pt-2 flex justify-end gap-2 border-t border-line">
                <Button size="sm" variant="outline" type="button" onClick={() => setTableModalOpen(false)}>
                  Bekor qilish
                </Button>
                <Button size="sm" variant="primary" type="submit" disabled={isSubmittingTable}>
                  {isSubmittingTable ? "Saqlanmoqda..." : "Stolni Yaratish"}
                </Button>
              </div>
            </form>
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
        onDelete={handleDeleteCategory}
        initialData={editingCategory}
        categories={categories.filter((c) => c.id !== 'all')}
        dishes={dishes}
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
