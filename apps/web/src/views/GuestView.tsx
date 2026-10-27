import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Bell,
  Receipt,
  UtensilsCrossed,
  Plus,
  Minus,
  Globe,
  CheckCircle2,
  EyeOff,
  RefreshCw,
  Clock,
  Sparkles,
  ChevronRight,
  Info,
  X,
  Trash2,
  Phone,
  Send,
  Instagram,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { ImageFallback } from '../components/ui/ImageFallback.tsx';
import { Money } from '../components/ui/Money.tsx';
import { Drawer } from '../components/ui/Drawer.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { DishDetailModal, SelectedDishDetail, CartSubmitItem } from '../components/menu/DishDetailModal.tsx';
import { useRealtime } from '../hooks/useRealtime.ts';
import { ConnectionBanner } from '../components/ui/ConnectionBanner.tsx';

interface GuestOrderItemAddon {
  name: string;
  priceTiyin: string;
}

interface GuestOrderItem {
  id: string;
  name: string;
  priceTiyin: string;
  variantName?: string | null;
  quantity: number;
  status: string; // 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED'
  addons: GuestOrderItemAddon[];
}

interface GuestOrder {
  id: string;
  orderNumber: number;
  status: string; // 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED'
  notes?: string | null;
  createdAt: string;
  items: GuestOrderItem[];
}

interface GuestDish {
  id: string;
  name: string;
  desc?: string;
  priceTiyin: bigint;
  cat: string;
  img?: string;
  isAvailable: boolean;
  allergens?: string[];
  version: number;
  variants?: { id: string; name: string; priceDiffTiyin?: bigint | string; isAvailable?: boolean }[];
  addonGroups?: {
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    options: { id: string; name: string; priceTiyin?: bigint | string; isAvailable?: boolean }[];
  }[];
}

const parseBannerUrls = (raw?: string | null): string[] => {
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

export const GuestView: React.FC = () => {
  const [lang, setLang] = useState<'uz' | 'ru'>('uz');
  const [activeCategory, setActiveCategory] = useState('milliy');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartSubmitItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [activeNav, setActiveNav] = useState<'menu' | 'orders' | 'service' | 'bill'>('menu');
  const [serviceCallSent, setServiceCallSent] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState<{
    name: string;
    phone?: string | null;
    extraPhones?: string[];
    telegram?: string | null;
    instagram?: string | null;
    address?: string | null;
    logoUrl?: string | null;
    bannerUrl?: string | null;
  } | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  const bannerUrls = useMemo(() => {
    return parseBannerUrls(restaurantInfo?.bannerUrl);
  }, [restaurantInfo?.bannerUrl]);

  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  // Muqova rasmlarini har 2 soniyada avto-almashlab turish
  useEffect(() => {
    if (bannerUrls.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % bannerUrls.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [bannerUrls.length]);

  // Bosqich 6-7: Stol va Mehmon Sessiyasi Holati
  const [tableStatus, setTableStatus] = useState<'FREE' | 'DIRTY' | 'OCCUPIED'>('OCCUPIED');
  const [tableNumber, setTableNumber] = useState<number>(4);
  const [_hallName, setHallName] = useState<string>('Asosiy Zal');
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [qrToken] = useState<string>(() => {
    // 1. URL Path: /table/:qrToken
    if (typeof window !== 'undefined') {
      const pathMatch = window.location.pathname.match(/\/table\/([^\/]+)/);
      if (pathMatch && pathMatch[1]) return pathMatch[1];

      // 2. Query param: ?qr=... yoki ?token=...
      const urlParams = new URLSearchParams(window.location.search);
      const fromQuery = urlParams.get('qr') || urlParams.get('token');
      if (fromQuery) return fromQuery;
    }
    return 'qr_rayhon_tbl_4';
  });
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Taom Tafsiloti Modali Holati
  const [selectedDishForModal, setSelectedDishForModal] = useState<SelectedDishDetail | null>(null);
  const [dishModalOpen, setDishModalOpen] = useState(false);

  // Buyurtma Yuborish & Idempotency Holati
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orders, setOrders] = useState<GuestOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Default Categories
  const [categories, setCategories] = useState([
    { id: 'milliy', name: lang === 'uz' ? 'Milliy Taomlar' : 'Национальные блюда' },
    { id: 'kabob', name: lang === 'uz' ? 'Kaboblar' : 'Шашлыки' },
    { id: 'shorva', name: lang === 'uz' ? 'Sho\'rvalar' : 'Супы' },
    { id: 'salat', name: lang === 'uz' ? 'Salatlar' : 'Салаты' },
    { id: 'ichimlik', name: lang === 'uz' ? 'Ichimliklar' : 'Напитки' },
  ]);

  // Default dishes
  const [dishes, setDishes] = useState<GuestDish[]>([
    {
      id: 'd1',
      name: lang === 'uz' ? 'To\'y Oshi' : 'Свадебный плов',
      desc: lang === 'uz' ? 'Devzira guruch, barra go\'sht, noxat va kishmish' : 'Рис девзира, нежное мясо, горох и изюм',
      priceTiyin: 4200000n,
      cat: 'milliy',
      img: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      allergens: ['Zira', 'Noxat'],
      version: 1,
      variants: [
        { id: 'v1-1', name: 'To\'liq porsiya', priceDiffTiyin: 0n },
        { id: 'v1-2', name: 'Yarim porsiya', priceDiffTiyin: -1000000n },
      ],
      addonGroups: [
        {
          id: 'ag-1',
          name: 'Qo\'shimchalar',
          minSelect: 0,
          maxSelect: 3,
          options: [
            { id: 'opt-qazi', name: 'Qazi', priceTiyin: 800000n },
            { id: 'opt-egg', name: 'Bedana tuxumi', priceTiyin: 300000n },
          ],
        },
      ],
    },
    {
      id: 'd2',
      name: lang === 'uz' ? 'Qozon Kabob' : 'Казан-кабоб',
      desc: lang === 'uz' ? 'Qizartirib qovurilgan go\'sht va tillarang kartoshka' : 'Обжаренная баранина с золотистым картофелем',
      priceTiyin: 6500000n,
      cat: 'milliy',
      img: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      version: 1,
    },
    {
      id: 'd7',
      name: lang === 'uz' ? 'Qo\'y Go\'shti Shashlik' : 'Шашлык из баранины',
      desc: lang === 'uz' ? 'Ko\'mirda pishirilgan yumshoq barra kabob' : 'Ароматный шашлык на углях',
      priceTiyin: 2400000n,
      cat: 'kabob',
      img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
      isAvailable: false, // Tugagan
      allergens: ['Piyoz'],
      version: 1,
    },
    {
      id: 'd15',
      name: lang === 'uz' ? 'Achichuk Salati' : 'Салат Ачичук',
      desc: lang === 'uz' ? 'Yupqa to\'g\'ralgan qizil pomidor, piyoz va rayhon' : 'Тонко нарезанные помидоры, лук и базилик',
      priceTiyin: 1400000n,
      cat: 'salat',
      img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      version: 1,
    },
    {
      id: 'd19',
      name: lang === 'uz' ? 'Ko\'k Choy 95 (Choynak)' : 'Зеленый чай 95',
      desc: lang === 'uz' ? 'Samovarda damlangan sara ko\'k choy' : 'Отборный зеленый чай из самовара',
      priceTiyin: 800000n,
      cat: 'ichimlik',
      img: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      version: 1,
    },
  ]);

  const targetRestaurantSlug = useMemo(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const fromParam = urlParams.get('restaurant') || urlParams.get('slug');
      if (fromParam) return fromParam;
    }
    return '';
  }, []);

  // Public Menu Load
  const loadPublicMenu = useCallback(async (slugOrId?: string) => {
    const effectiveSlug = slugOrId || targetRestaurantSlug || 'rayhon-chilonzor';
    try {
      setLoadingMenu(true);
      const res = await fetch(`/api/v1/public/restaurants/${effectiveSlug}/menu?lang=${lang}`);
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.restaurant) {
          setRestaurantInfo(json.data.restaurant);
        }
        if (json.data.categories?.length > 0) {
          setCategories(json.data.categories);
          if (!json.data.categories.some((c: any) => c.id === activeCategory)) {
            setActiveCategory(json.data.categories[0].id);
          }
        }
        if (json.data.items?.length > 0) {
          setDishes(
            json.data.items.map((item: any) => ({
              id: item.id,
              name: item.name,
              desc: item.description,
              priceTiyin: BigInt(item.basePriceTiyin),
              cat: item.categoryId,
              img: item.imageUrl || 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=600&q=80',
              isAvailable: item.isAvailable,
              allergens: item.allergens,
              version: item.version || 1,
              variants: item.variants?.map((v: any) => ({
                id: v.id,
                name: v.name,
                priceDiffTiyin: BigInt(v.priceDifferenceTiyin || 0),
                isAvailable: v.isAvailable !== false,
              })),
              addonGroups: item.addonGroups?.map((g: any) => ({
                id: g.id,
                name: g.name,
                minSelect: g.minSelect || 0,
                maxSelect: g.maxSelect || 10,
                options: g.options?.map((opt: any) => ({
                  id: opt.id,
                  name: opt.name,
                  priceTiyin: BigInt(opt.priceTiyin || 0),
                  isAvailable: opt.isAvailable !== false,
                })),
              })),
            }))
          );
        }
      }
    } catch {
      // Fallback data saqlanadi
    } finally {
      setLoadingMenu(false);
    }
  }, [lang, activeCategory, targetRestaurantSlug]);

  // Tashrif Buyurtmalarini yuklash (GET /api/v1/guest/orders)
  const fetchOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const res = await fetch('/api/v1/guest/orders', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setOrders(json.data);
          setIsJoined(true);
        }
      } else if (res.status === 401) {
        // Sessiya yo'q
        setIsJoined(false);
      }
    } catch {
      // Offline yoki tarmoq xatoligi
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  // Stol ma'lumotlarini yuklash (GET /api/v1/public/tables/:qrToken)
  const loadTableInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/public/tables/${qrToken}`);
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        if (json.data.table) {
          if (json.data.table.number) setTableNumber(json.data.table.number);
          if (json.data.table.hall?.name) setHallName(json.data.table.hall.name);
          if (json.data.table.status) setTableStatus(json.data.table.status);
        }
        if (json.data.restaurant) {
          setRestaurantInfo((prev) => ({ ...prev, ...json.data.restaurant }));
          if (json.data.restaurant.slug || json.data.restaurant.id) {
            loadPublicMenu(json.data.restaurant.slug || json.data.restaurant.id);
          }
        }
      }
    } catch {
      // Fallback
    }
  }, [qrToken, loadPublicMenu]);

  // Stolga avtomatik ulanish (PIN-siz to'g'ridan-to'g'ri)
  const joinTableDirectly = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/public/tables/${qrToken}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setIsJoined(true);
        await fetchOrders();
      }
    } catch {
      // Fallback
    }
  }, [qrToken, fetchOrders]);

  useEffect(() => {
    loadPublicMenu();
    loadTableInfo();
    joinTableDirectly();
  }, [loadPublicMenu, loadTableInfo, joinTableDirectly]);

  // Jonli yangilanish (SSE) va ulanish nazorati
  const { status } = useRealtime({
    enabled: isJoined,
    guestToken: isJoined ? 'session-active' : undefined,
    onReconnect: () => {
      fetchOrders();
    },
    onEvent: (event) => {
      if (event.type === 'visit.closed') {
        setIsJoined(false);
      }
      fetchOrders();
    },
  });

  // Taom kartasi bosilganda DishDetailModal ochish
  function handleOpenDishDetail(dish: GuestDish) {
    if (!dish.isAvailable) return;
    setSelectedDishForModal({
      id: dish.id,
      name: dish.name,
      desc: dish.desc,
      basePriceTiyin: dish.priceTiyin,
      imageUrl: dish.img,
      isAvailable: dish.isAvailable,
      version: dish.version,
      allergens: dish.allergens,
      variants: dish.variants,
      addonGroups: dish.addonGroups,
    });
    setDishModalOpen(true);
  }

  // Modaldan savatga qo'shish
  function handleAddToCartFromModal(newItem: CartSubmitItem) {
    setCart((prev) => {
      // Agar aynan bir xil variant, addonlar va izohga ega taom bo'lsa, miqdorini oshirish
      const sameItemIndex = prev.findIndex((i) => {
        if (i.menuItemId !== newItem.menuItemId) return false;
        if (i.variantId !== newItem.variantId) return false;
        if ((i.notes || '') !== (newItem.notes || '')) return false;
        const prevAddonIds = i.selectedAddons.map((a) => a.id).sort().join(',');
        const newAddonIds = newItem.selectedAddons.map((a) => a.id).sort().join(',');
        return prevAddonIds === newAddonIds;
      });

      if (sameItemIndex >= 0) {
        const updated = [...prev];
        const existing = updated[sameItemIndex];
        const newQty = Math.min(50, existing.quantity + newItem.quantity);
        updated[sameItemIndex] = { ...existing, quantity: newQty };
        return updated;
      }
      return [...prev, newItem];
    });

    setDishModalOpen(false);
    setFeedbackMsg(
      lang === 'uz'
        ? `"${newItem.name}" savatga qo'shildi!`
        : `"${newItem.name}" добавлено в корзину!`
    );
    setTimeout(() => setFeedbackMsg(null), 2500);
  }

  // Savatdagi taom miqdorini o'zgartirish
  function handleUpdateCartQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === itemId) {
            const nextQty = i.quantity + delta;
            return nextQty > 0 && nextQty <= 50 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter((i): i is CartSubmitItem => i !== null)
    );
  }

  // Savatdan o'chirish
  function handleRemoveFromCart(itemId: string) {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  }

  // Savat jami hisob-kitoblari (tiyin formatida)
  const totalCartTiyin = cart.reduce(
    (sum, item) => sum + item.finalUnitPriceTiyin * BigInt(item.quantity),
    0n
  );
  const serviceChargeTiyin = (totalCartTiyin * 10n) / 100n; // 10% xizmat haqi
  const grandTotalCartTiyin = totalCartTiyin + serviceChargeTiyin;
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // BUYURTMANI YUBORISH (POST /api/v1/guest/orders - Idempotency & Conflict Guard bilan)
  async function handleSubmitOrder() {
    if (cart.length === 0) return;

    // Agar stolga ulanmagan bo'lsa, to'g'ridan-to'g'ri avtomatik ulanish
    if (!isJoined) {
      await joinTableDirectly();
    }

    setIsSubmittingOrder(true);
    setFeedbackMsg(null);

    // Idempotency kaliti (har bir yangi so'rov urinishida unique UUID)
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `order-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const payload = {
        orderNotes: orderNotes.trim() || undefined,
        items: cart.map((item) => ({
          menuItemId: item.menuItemId,
          variantId: item.variantId || undefined,
          addonOptionIds: item.selectedAddons.map((a) => a.id),
          notes: item.notes?.trim() || undefined,
          quantity: item.quantity,
          expectedVersion: item.expectedVersion,
        })),
      };

      const res = await fetch('/api/v1/guest/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.status === 201 || res.status === 200) {
        // Muvaffaqiyatli buyurtma yaratildi
        setCart([]);
        setOrderNotes('');
        setCartOpen(false);
        setActiveNav('orders');
        await fetchOrders();
        setFeedbackMsg(
          lang === 'uz'
            ? 'Buyurtmangiz qabul qilindi! Ofitsiant tasdig\'i kutilmoqda.'
            : 'Ваш заказ принят! Ожидает подтверждения официанта.'
        );
        setTimeout(() => setFeedbackMsg(null), 4000);
      } else if (res.status === 409) {
        // Narx yoki menyu versiyasi ziddiyati (PRICE_VERSION_CONFLICT)
        if (json.error?.code === 'PRICE_VERSION_CONFLICT') {
          alert(
            lang === 'uz'
              ? 'Diqqat: Ba\'zi taomlar narxi yoki menyu yangilandi! Iltimos, savatni qayta ko\'rib chiqing.'
              : 'Внимание: Цены меню обновились. Пожалуйста, проверьте корзину.'
          );
          await loadPublicMenu();
        } else if (json.error?.code === 'IDEMPOTENCY_CONFLICT') {
          alert(
            lang === 'uz'
              ? 'Aynan shu so\'rov boshqa parametrlar bilan aniqlandi. Iltimos, qayta urinib ko\'ring.'
              : 'Конфликт идемпотентности. Повторите попытку.'
          );
        } else {
          alert(json.error?.message || 'Ziddiyat yuz berdi');
        }
      } else if (res.status === 401) {
        setIsJoined(false);
        await joinTableDirectly();
        alert(
          lang === 'uz'
            ? 'Mehmon sessiyasi yangilandi. Iltimos, qayta urinib ko\'ring.'
            : 'Сессия обновлена. Пожалуйста, повторите попытку.'
        );
      } else {
        alert(json.error?.message || 'Buyurtma yuborishda xatolik yuz berdi.');
      }
    } catch {
      alert('Tarmoq xatosi: buyurtmani yuborib bo\'lmadi');
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  // Xizmat chaqirish
  async function handleServiceCall(type: 'WAITER' | 'BILL' | 'CLEAN') {
    if (tableStatus === 'DIRTY') {
      alert(
        lang === 'uz'
          ? 'Stol tozalanmoqda. Iltimos, xodimga murojaat qiling.'
          : 'Стол убирается.'
      );
      return;
    }
    if (!isJoined) {
      await joinTableDirectly();
    }
    setServiceCallSent(true);
    setFeedbackMsg(
      type === 'BILL'
        ? (lang === 'uz' ? 'Hisob so\'rovi ofitsiantga yuborildi!' : 'Запрос счета отправлен!')
        : type === 'CLEAN'
        ? (lang === 'uz' ? 'Stolni tozalash so\'rovi yuborildi!' : 'Запрос на уборку отправлен!')
        : (lang === 'uz' ? 'Ofitsiant chaqirildi! Tez orada keladi.' : 'Официант вызван!')
    );
    setTimeout(() => {
      setServiceCallSent(false);
      setFeedbackMsg(null);
    }, 3500);
  }

  // Status badge yordamchisi
  function getOrderStatusBadge(status: string) {
    switch (status) {
      case 'NEW':
        return {
          label: lang === 'uz' ? 'Kutilmoqda (Ofitsiant tasdig\'i)' : 'Ожидает подтверждения',
          color: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-500 animate-pulse',
        };
      case 'CONFIRMED':
        return {
          label: lang === 'uz' ? 'Tasdiqlandi' : 'Подтвержден',
          color: 'bg-blue-100 text-blue-900 border-blue-300',
          dot: 'bg-blue-500',
        };
      case 'PREPARING':
        return {
          label: lang === 'uz' ? 'Tayyorlanmoqda' : 'Готовится',
          color: 'bg-purple-100 text-purple-900 border-purple-300',
          dot: 'bg-purple-500 animate-pulse',
        };
      case 'READY':
        return {
          label: lang === 'uz' ? 'Tayyor' : 'Готов',
          color: 'bg-teal-100 text-teal-900 border-teal-300',
          dot: 'bg-teal-500',
        };
      case 'SERVED':
        return {
          label: lang === 'uz' ? 'Yetkazildi' : 'Подано',
          color: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          dot: 'bg-emerald-600',
        };
      case 'CANCELLED':
        return {
          label: lang === 'uz' ? 'Bekor qilingan' : 'Отменен',
          color: 'bg-rose-100 text-rose-900 border-rose-300',
          dot: 'bg-rose-500',
        };
      default:
        return {
          label: status,
          color: 'bg-slate-100 text-slate-800 border-slate-300',
          dot: 'bg-slate-400',
        };
    }
  }

  function getItemStatusBadge(status: string) {
    switch (status) {
      case 'PENDING':
        return {
          label: lang === 'uz' ? 'Kutilmoqda' : 'В ожидании',
          color: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'ACCEPTED':
        return {
          label: lang === 'uz' ? 'Qabul qilindi' : 'Принят',
          color: 'bg-blue-50 text-blue-800 border-blue-200',
        };
      case 'PREPARING':
        return {
          label: lang === 'uz' ? 'Pishirilmoqda' : 'Готовится',
          color: 'bg-purple-50 text-purple-800 border-purple-200',
        };
      case 'READY':
        return {
          label: lang === 'uz' ? 'Tayyor' : 'Готово',
          color: 'bg-teal-50 text-teal-800 border-teal-200',
        };
      case 'SERVED':
        return {
          label: lang === 'uz' ? 'Yetkazildi' : 'Подано',
          color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      case 'CANCELLED':
        return {
          label: lang === 'uz' ? 'Bekor qilindi' : 'Отменен',
          color: 'bg-rose-50 text-rose-800 border-rose-200',
        };
      default:
        return {
          label: status,
          color: 'bg-slate-50 text-slate-700 border-slate-200',
        };
    }
  }

  const filteredDishes = dishes.filter(
    (d) =>
      (d.cat === activeCategory || searchQuery.length > 0) &&
      (!searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="w-full min-h-screen bg-slate-100 flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen bg-bg flex flex-col pb-28 relative select-none sm:shadow-2xl sm:border-x sm:border-line">
        {/* Offline Ogohlantirish Paneli */}
        <ConnectionBanner
          status={status}
          onManualRefresh={fetchOrders}
        />

      {/* 1. Restoran Banneri va Header */}
      <div className="relative bg-brand-900 text-white">
        <div className="h-28 sm:h-36 bg-gradient-to-r from-brand-950 via-brand-900 to-brand-800 relative overflow-hidden">
          {bannerUrls.length > 0 ? (
            bannerUrls.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`Restoran muqovasi ${idx + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
                  idx === (activeBannerIndex % bannerUrls.length) ? 'opacity-40' : 'opacity-0 pointer-events-none'
                }`}
              />
            ))
          ) : (
            <img
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"
              alt="Restoran"
              className="w-full h-full object-cover opacity-35"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950/80 to-transparent" />

          {/* Til almashtirish tugmasi */}
          <div className="absolute top-3 right-3 z-30">
            <button
              onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition-all shadow-md active:scale-95"
            >
              <Globe className="w-3.5 h-3.5 text-brand-300" />
              <span className="uppercase tracking-wide">{lang}</span>
            </button>
          </div>

          {/* Ko'p rasm bo'lsa indikator nuqtalar */}
          {bannerUrls.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
              {bannerUrls.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === (activeBannerIndex % bannerUrls.length) ? 'w-4 bg-brand-400' : 'w-1.5 bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FEEDBACK TOAST / BANNER */}
      {feedbackMsg && (
        <div className="sticky top-2 z-50 px-4 py-2 mx-4 mt-2 bg-brand-900 text-white text-xs font-bold rounded-2xl shadow-xl flex items-center justify-between border border-brand-700 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:text-slate-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ASOSIY KONTENT: TABLAR BO'YICHA */}
      {activeNav === 'menu' && (
        <>
          {/* 2. Sticky Qidiruv va Kategoriyalar */}
          <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur-md pt-3 pb-2 px-4 border-b border-line shadow-subtle space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'uz' ? 'Taom yoki ichimlik qidirish...' : 'Поиск блюда или напитка...'}
                className="w-full bg-surface rounded-xl pl-9 pr-4 py-2 text-xs text-ink-main border border-line focus:outline-none focus:ring-2 focus:ring-brand shadow-subtle min-h-[44px]"
              />
            </div>

            <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1">
              {categories.map((c) => {
                const isActive = activeCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveCategory(c.id);
                      setSearchQuery('');
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[44px] ${
                      isActive
                        ? 'bg-brand text-white shadow-subtle font-extrabold'
                        : 'bg-surface text-ink-muted border border-line hover:bg-bg hover:text-ink-main'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Taomlar Ro'yxati */}
          <div className="p-4 grid grid-cols-1 gap-3.5 flex-1 content-start">
            {loadingMenu ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : filteredDishes.length === 0 ? (
              <EmptyState
                title={lang === 'uz' ? 'Taomlar topilmadi' : 'Блюда не найдены'}
                description={
                  lang === 'uz'
                    ? 'Qidiruv so\'rovi yoki tanlangan kategoriya bo\'yicha hech narsa chiqmadi.'
                    : 'По вашему запросу ничего не найдено.'
                }
              />
            ) : (
              filteredDishes.map((dish) => {
                const inCartQuantity = cart
                  .filter((i) => i.menuItemId === dish.id)
                  .reduce((sum, i) => sum + i.quantity, 0);

                return (
                  <div
                    key={dish.id}
                    onClick={() => handleOpenDishDetail(dish)}
                    className={`bg-surface rounded-card p-3.5 border shadow-subtle flex gap-3.5 transition-all cursor-pointer hover:border-brand-300 ${
                      dish.isAvailable ? 'border-line' : 'border-line/60 opacity-70 bg-bg/40'
                    }`}
                  >
                    {/* Katta Taom Rasmi */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 border border-line relative">
                      <ImageFallback src={dish.img} alt={dish.name} className="w-full h-full object-cover" />
                      {!dish.isAvailable && (
                        <div className="absolute inset-0 bg-ink-main/50 backdrop-blur-[1px] flex items-center justify-center">
                          <span className="text-[10px] font-extrabold text-white bg-red-600 px-2 py-0.5 rounded-full">
                            {lang === 'uz' ? 'Tugagan' : 'Закончилось'}
                          </span>
                        </div>
                      )}
                      {inCartQuantity > 0 && (
                        <div className="absolute top-1.5 right-1.5 bg-brand text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                          {inCartQuantity}
                        </div>
                      )}
                    </div>

                    {/* Taom Ma'lumoti */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="font-bold text-sm text-ink-main leading-snug truncate">{dish.name}</h3>
                          {dish.allergens && dish.allergens.length > 0 && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                              {dish.allergens[0]}
                            </span>
                          )}
                        </div>
                        {dish.desc && (
                          <p className="text-[11px] text-ink-muted line-clamp-2 leading-relaxed">{dish.desc}</p>
                        )}
                        {(dish.variants?.length ?? 0) > 0 && (
                          <div className="text-[10px] text-brand-700 font-semibold">
                            {dish.variants?.length} xil porsiya / variant
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <Money amountTiyin={dish.priceTiyin} className="text-sm text-brand font-bold" />

                        {!dish.isAvailable ? (
                          <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>{lang === 'uz' ? 'Vaqtincha yo\'q' : 'Нет в наличии'}</span>
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDishDetail(dish);
                            }}
                            className="rounded-xl px-3 py-1.5 text-xs min-h-[36px]"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            <span>{lang === 'uz' ? 'Qo\'shish' : 'Добавить'}</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* BUYURTMALAR TABI (Mening Buyurtmalarim) */}
      {activeNav === 'orders' && (
        <div className="p-4 space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-ink-main">
                {lang === 'uz' ? 'Mening Buyurtmalarim' : 'Мои Заказы'}
              </h2>
              <p className="text-xs text-ink-muted">
                {lang === 'uz' ? 'Stol #' + tableNumber + ' bo\'yicha barcha buyurtmalar' : 'Заказы стола #' + tableNumber}
              </p>
            </div>
            <button
              onClick={fetchOrders}
              disabled={loadingOrders}
              className="p-2 rounded-xl bg-surface border border-line text-brand hover:bg-bg transition-colors"
              title="Yangilash"
            >
              <RefreshCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {!isJoined ? (
            <div className="bg-surface rounded-2xl p-6 border border-line text-center space-y-3">
              <Button size="sm" variant="primary" onClick={() => joinTableDirectly()}>
                {lang === 'uz' ? 'Stolga Ulanish' : 'Подключиться к столу'}
              </Button>
            </div>
          ) : loadingOrders ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              title={lang === 'uz' ? 'Hozircha buyurtmalar yo\'q' : 'Заказов пока нет'}
              description={
                lang === 'uz'
                  ? 'Menyudan xohlagan taomlarni tanlab savat orqali buyurtma bering.'
                  : 'Выберите блюда из меню и оформите заказ.'
              }
              actionLabel={lang === 'uz' ? 'Menyuga o\'tish' : 'Перейти в меню'}
              onAction={() => setActiveNav('menu')}
            />
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const statusMeta = getOrderStatusBadge(order.status);
                const orderTotalTiyin = order.items.reduce(
                  (sum, item) => sum + BigInt(item.priceTiyin) * BigInt(item.quantity),
                  0n
                );

                return (
                  <div
                    key={order.id}
                    className="bg-surface rounded-2xl p-4 border border-line shadow-subtle space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-line pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink-main">
                          Buyurtma #{order.orderNumber}
                        </span>
                        <span className="text-[11px] text-ink-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1.5 ${statusMeta.color}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                        {statusMeta.label}
                      </span>
                    </div>

                    {order.notes && (
                      <div className="text-xs text-ink-secondary bg-bg p-2 rounded-xl border border-line italic">
                        Izoh: "{order.notes}"
                      </div>
                    )}

                    <div className="divide-y divide-line/60">
                      {order.items.map((item) => {
                        const itemStatusMeta = getItemStatusBadge(item.status);
                        const itemTotalTiyin = BigInt(item.priceTiyin) * BigInt(item.quantity);

                        return (
                          <div key={item.id} className="py-2 flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-ink-main flex items-center gap-1.5">
                                <span>{item.quantity}x</span>
                                <span>{item.name}</span>
                                {item.variantName && (
                                  <span className="text-[10px] text-brand bg-brand-50 px-1.5 py-0.2 rounded font-medium">
                                    {item.variantName}
                                  </span>
                                )}
                              </div>
                              {item.addons && item.addons.length > 0 && (
                                <div className="text-[10px] text-ink-muted pl-4">
                                  + {item.addons.map((a) => a.name).join(', ')}
                                </div>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <Money amountTiyin={itemTotalTiyin} className="text-xs font-bold text-ink-main" />
                              <div className="mt-0.5">
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold inline-block ${itemStatusMeta.color}`}
                                >
                                  {itemStatusMeta.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-line flex items-center justify-between text-xs font-bold">
                      <span className="text-ink-muted">Buyurtma summasi:</span>
                      <Money amountTiyin={orderTotalTiyin} className="text-brand font-extrabold text-sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* XIZMAT TABI (Ofitsiant chaqirish) */}
      {activeNav === 'service' && (
        <div className="p-4 space-y-4 flex-1">
          <div>
            <h2 className="text-base font-bold text-ink-main">
              {lang === 'uz' ? 'Xizmat Ko\'rsatish' : 'Сервис и Официант'}
            </h2>
            <p className="text-xs text-ink-muted">
              {lang === 'uz' ? 'Ofitsiantni stolingizga chaqirish' : 'Вызов персонала к столику'}
            </p>
          </div>

          <div className="space-y-3">
            <div
              onClick={() => handleServiceCall('WAITER')}
              className="bg-surface hover:bg-brand-50/50 cursor-pointer rounded-2xl p-4 border border-line shadow-subtle flex items-center justify-between transition-all active:scale-[0.99]"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-ink-main">
                    {lang === 'uz' ? 'Ofitsiantni Chaqirish' : 'Вызов официанта'}
                  </h3>
                  <p className="text-xs text-ink-muted">
                    {lang === 'uz' ? 'Savollar yoki qo\'shimcha xizmat uchun' : 'По любым вопросам к столику'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-ink-muted" />
            </div>

            <div
              onClick={() => handleServiceCall('BILL')}
              className="bg-surface hover:bg-brand-50/50 cursor-pointer rounded-2xl p-4 border border-line shadow-subtle flex items-center justify-between transition-all active:scale-[0.99]"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-ink-main">
                    {lang === 'uz' ? 'Hisobni So\'rash' : 'Попросить счет'}
                  </h3>
                  <p className="text-xs text-ink-muted">
                    {lang === 'uz' ? 'To\'lov qilish uchun chekni keltirish' : 'Принести расчетный чек'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-ink-muted" />
            </div>

            <div
              onClick={() => handleServiceCall('CLEAN')}
              className="bg-surface hover:bg-brand-50/50 cursor-pointer rounded-2xl p-4 border border-line shadow-subtle flex items-center justify-between transition-all active:scale-[0.99]"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-ink-main">
                    {lang === 'uz' ? 'Stolni Tozalash' : 'Уборка стола'}
                  </h3>
                  <p className="text-xs text-ink-muted">
                    {lang === 'uz' ? 'Bo\'shagan idishlarni olib ketish' : 'Убрать пустую посуду'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-ink-muted" />
            </div>
          </div>
        </div>
      )}

      {/* HISOB TABI (Tashrif hisobi) */}
      {activeNav === 'bill' && (
        <div className="p-4 space-y-4 flex-1">
          <div>
            <h2 className="text-base font-bold text-ink-main">
              {lang === 'uz' ? 'Joriy Hisob' : 'Текущий Счет'}
            </h2>
            <p className="text-xs text-ink-muted">
              {lang === 'uz' ? 'Stol #' + tableNumber + ' tashrifining umumiy hisob-kitobi' : 'Итоговый чек стола'}
            </p>
          </div>

          {orders.length === 0 ? (
            <EmptyState
              title={lang === 'uz' ? 'Hali buyurtma berilmagan' : 'Заказов пока нет'}
              description={
                lang === 'uz'
                  ? 'Hisob shakllanishi uchun avval menyudan buyurtma yuboring.'
                  : 'Счет появится после отправки первого заказа.'
              }
              actionLabel={lang === 'uz' ? 'Menyuga o\'tish' : 'Перейти в меню'}
              onAction={() => setActiveNav('menu')}
            />
          ) : (
            <div className="bg-surface rounded-2xl p-5 border border-line shadow-subtle space-y-4">
              <div className="space-y-2 border-b border-line pb-3">
                <div className="text-xs font-bold text-ink-muted uppercase tracking-wider">
                  {lang === 'uz' ? 'Buyurtma qilingan taomlar' : 'Заказанные блюда'}
                </div>
                {orders
                  .flatMap((o) => o.items)
                  .filter((i) => i.status !== 'CANCELLED')
                  .map((item, idx) => {
                    const lineTotal = BigInt(item.priceTiyin) * BigInt(item.quantity);
                    return (
                      <div key={idx} className="flex justify-between text-xs text-ink-main">
                        <span>
                          {item.quantity}x {item.name} {item.variantName ? `(${item.variantName})` : ''}
                        </span>
                        <Money amountTiyin={lineTotal} className="font-semibold" />
                      </div>
                    );
                  })}
              </div>

              {/* Moliyaviy jami hisob */}
              {(() => {
                const activeItemsSum = orders
                  .flatMap((o) => o.items)
                  .filter((i) => i.status !== 'CANCELLED')
                  .reduce((sum, item) => sum + BigInt(item.priceTiyin) * BigInt(item.quantity), 0n);
                const svc = (activeItemsSum * 10n) / 100n;
                const grand = activeItemsSum + svc;

                return (
                  <div className="space-y-2 pt-1 text-xs">
                    <div className="flex justify-between text-ink-muted">
                      <span>{lang === 'uz' ? 'Taomlar qiymati:' : 'Сумма блюд:'}</span>
                      <Money amountTiyin={activeItemsSum} />
                    </div>
                    <div className="flex justify-between text-ink-muted">
                      <span>{lang === 'uz' ? 'Xizmat haqi (10%):' : 'Обслуживание (10%):'}</span>
                      <Money amountTiyin={svc} />
                    </div>
                    <div className="flex justify-between text-base font-extrabold text-ink-main pt-2 border-t border-line">
                      <span>{lang === 'uz' ? 'Jami to\'lov:' : 'Итого к оплате:'}</span>
                      <Money amountTiyin={grand} className="text-brand text-lg" />
                    </div>
                  </div>
                );
              })()}

              <div className="bg-bg rounded-xl p-3 text-[11px] text-ink-muted space-y-1 border border-line">
                <div className="flex items-center gap-1.5 font-bold text-ink-main">
                  <Info className="w-3.5 h-3.5 text-brand" />
                  <span>{lang === 'uz' ? 'To\'lov usullari:' : 'Способы оплаты:'}</span>
                </div>
                <div>Naqd pul, Uzcard/Humo bank kartalari, Payme yoki Click orqali ofitsiantga to'lanadi.</div>
              </div>

              <Button
                variant="primary"
                size="lg"
                className="w-full font-bold"
                onClick={() => handleServiceCall('BILL')}
              >
                <Receipt className="w-4 h-4 mr-2" />
                {lang === 'uz' ? 'Ofitsiantdan Hisobni So\'rash' : 'Попросить счет у официанта'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 4. Qulay Savat Suzuvchi Paneli */}
      {totalCartCount > 0 && activeNav === 'menu' && (
        <div className="fixed bottom-20 left-0 right-0 max-w-[480px] mx-auto px-4 z-30 pointer-events-none">
          <div
            onClick={() => setCartOpen(true)}
            className="pointer-events-auto bg-brand hover:bg-brand-hover text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between cursor-pointer border border-brand-hover transition-transform active:scale-[0.98]"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-brand-hover flex items-center justify-center relative">
                <ShoppingCart className="w-4 h-4 text-white" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-brand-950 font-black text-[10px] rounded-full flex items-center justify-center shadow-sm">
                  {totalCartCount}
                </span>
              </div>
              <div className="text-left">
                <span className="text-xs text-brand-100 block font-medium">
                  {lang === 'uz' ? 'Savatchada:' : 'В корзине:'}
                </span>
                <span className="text-sm font-extrabold text-white">
                  <Money amountTiyin={grandTotalCartTiyin} />
                </span>
              </div>
            </div>

            <span className="text-xs font-bold bg-white text-brand px-3 py-1.5 rounded-xl shadow-sm">
              {lang === 'uz' ? 'Ko\'rish' : 'Посмотреть'} →
            </span>
          </div>
        </div>
      )}

      {/* 5. Pastki Navigatsiya Paneli */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto h-16 bg-surface border-t border-line px-6 flex items-center justify-between z-40 shadow-lg">
        <button
          onClick={() => setActiveNav('menu')}
          className={`flex flex-col items-center justify-center space-y-1 transition-colors min-h-[44px] min-w-[44px] ${
            activeNav === 'menu' ? 'text-brand font-bold' : 'text-ink-muted hover:text-ink-main'
          }`}
        >
          <UtensilsCrossed className="w-5 h-5" />
          <span className="text-[10px]">{lang === 'uz' ? 'Menyu' : 'Меню'}</span>
        </button>

        <button
          onClick={() => setActiveNav('orders')}
          className={`flex flex-col items-center justify-center space-y-1 transition-colors min-h-[44px] min-w-[44px] relative ${
            activeNav === 'orders' ? 'text-brand font-bold' : 'text-ink-muted hover:text-ink-main'
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px]">{lang === 'uz' ? 'Buyurtmalar' : 'Заказы'}</span>
          {orders.length > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-brand" />
          )}
        </button>

        <button
          onClick={() => setActiveNav('service')}
          className={`flex flex-col items-center justify-center space-y-1 transition-colors min-h-[44px] min-w-[44px] ${
            activeNav === 'service' ? 'text-brand font-bold' : 'text-ink-muted hover:text-ink-main'
          }`}
        >
          <Bell className={`w-5 h-5 ${serviceCallSent ? 'text-amber-500 animate-bounce' : ''}`} />
          <span className="text-[10px]">{lang === 'uz' ? 'Xizmat' : 'Официант'}</span>
        </button>

        <button
          onClick={() => setActiveNav('bill')}
          className={`flex flex-col items-center justify-center space-y-1 transition-colors min-h-[44px] min-w-[44px] ${
            activeNav === 'bill' ? 'text-brand font-bold' : 'text-ink-muted hover:text-ink-main'
          }`}
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[10px]">{lang === 'uz' ? 'Hisob' : 'Счет'}</span>
        </button>
      </nav>

      {/* Cart Drawer */}
      <Drawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        title={lang === 'uz' ? 'Mening Savatcham' : 'Моя Корзина'}
      >
        <div className="space-y-4">
          {cart.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-muted">
              {lang === 'uz' ? 'Savatcha bo\'sh' : 'Корзина пуста'}
            </div>
          ) : (
            <div className="divide-y divide-line max-h-60 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-ink-main truncate">{item.name}</h4>
                    {item.variantName && (
                      <span className="inline-block text-[10px] font-semibold text-brand bg-brand-50 px-2 py-0.5 rounded-md">
                        {item.variantName}
                      </span>
                    )}
                    {item.selectedAddons.length > 0 && (
                      <div className="text-[10px] text-ink-secondary">
                        + {item.selectedAddons.map((a) => a.name).join(', ')}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-[10px] text-ink-muted italic">
                        Izoh: "{item.notes}"
                      </div>
                    )}
                    <Money
                      amountTiyin={item.finalUnitPriceTiyin * BigInt(item.quantity)}
                      className="text-xs text-ink-main font-bold block pt-0.5"
                    />
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0 pt-1">
                    <button
                      onClick={() => {
                        if (item.quantity === 1) {
                          handleRemoveFromCart(item.id);
                        } else {
                          handleUpdateCartQty(item.id, -1);
                        }
                      }}
                      className="w-7 h-7 rounded-lg bg-bg border border-line text-ink-main flex items-center justify-center font-bold text-xs hover:bg-slate-100"
                    >
                      {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-rose-600" /> : <Minus className="w-3.5 h-3.5" />}
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-ink-main">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateCartQty(item.id, 1)}
                      className="w-7 h-7 rounded-lg bg-brand text-white flex items-center justify-center font-bold text-xs shadow-sm hover:bg-brand-hover"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Buyurtmaga umumiy izoh */}
          {cart.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-line">
              <label className="text-xs font-bold text-ink-secondary flex items-center justify-between">
                <span>{lang === 'uz' ? 'Buyurtmaga umumiy izoh:' : 'Примечание к заказу:'}</span>
                <span className="text-[10px] text-ink-muted">{orderNotes.length}/500</span>
              </label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value.slice(0, 500))}
                rows={2}
                placeholder={
                  lang === 'uz'
                    ? 'Masalan: Barcha taomlar bir vaqtda keltirilsin...'
                    : 'Например: Подать все блюда одновременно...'
                }
                className="w-full bg-surface border border-line rounded-xl p-2.5 text-xs text-ink-main focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          )}

          {/* Narxlar va Xizmat haqi */}
          {cart.length > 0 && (
            <div className="pt-3 border-t border-line space-y-2">
              <div className="flex justify-between text-xs text-ink-muted">
                <span>{lang === 'uz' ? 'Taomlar qiymati:' : 'Сумма блюд:'}</span>
                <Money amountTiyin={totalCartTiyin} />
              </div>
              <div className="flex justify-between text-xs text-ink-muted">
                <span>{lang === 'uz' ? 'Xizmat haqi (10%):' : 'Обслуживание (10%):'}</span>
                <Money amountTiyin={serviceChargeTiyin} />
              </div>
              <div className="flex justify-between text-base font-extrabold text-ink-main">
                <span>{lang === 'uz' ? 'Jami to\'lov:' : 'Итого к оплате:'}</span>
                <Money amountTiyin={grandTotalCartTiyin} className="text-brand text-lg" />
              </div>
            </div>
          )}

          <Button
            size="lg"
            variant="primary"
            disabled={cart.length === 0 || isSubmittingOrder}
            className="w-full mt-2 font-bold"
            onClick={handleSubmitOrder}
          >
            {isSubmittingOrder ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                {lang === 'uz' ? 'Yuborilmoqda (Natija tekshirilmoqda)...' : 'Отправка заказа...'}
              </span>
            ) : (
              <span>
                {lang === 'uz' ? 'Buyurtmani Yuborish' : 'Отправить заказ'}
              </span>
            )}
          </Button>
        </div>
      </Drawer>

      {/* TAOM TAFSILOTI DIALOGI (Bosqich 7) */}
      <DishDetailModal
        isOpen={dishModalOpen}
        onClose={() => setDishModalOpen(false)}
        dish={selectedDishForModal}
        lang={lang}
        onAddToCart={handleAddToCartFromModal}
      />

      {/* RESTORAN MA'LUMOTLARI VA ALOQA MODALI */}
      <Dialog
        isOpen={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        title={restaurantInfo?.name || (lang === 'uz' ? "Restoran Ma'lumotlari" : 'Информация о ресторане')}
      >
        <div className="space-y-4 pt-2 text-xs">
          {/* Manzil */}
          {restaurantInfo?.address && (
            <div className="p-3 bg-bg rounded-xl border border-line space-y-1">
              <span className="text-[11px] text-ink-secondary block font-medium">
                {lang === 'uz' ? 'Manzil' : 'Адрес'}
              </span>
              <p className="font-semibold text-ink-main">{restaurantInfo.address}</p>
            </div>
          )}

          {/* Telefon raqamlar */}
          <div className="p-3 bg-surface rounded-xl border border-line space-y-2">
            <span className="text-xs font-bold text-ink-main flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-brand" />
              {lang === 'uz' ? 'Aloqa Telefonlari' : 'Контактные телефоны'}
            </span>
            <div className="space-y-1.5">
              {[restaurantInfo?.phone, ...(restaurantInfo?.extraPhones || [])].filter(Boolean).length > 0 ? (
                [restaurantInfo?.phone, ...(restaurantInfo?.extraPhones || [])].filter(Boolean).map((p, idx) => (
                  <a
                    key={idx}
                    href={`tel:${p?.replace(/\s+/g, '')}`}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-bg hover:bg-brand/10 hover:border-brand/30 border border-transparent transition-all group"
                  >
                    <span className="font-mono font-medium text-ink-main group-hover:text-brand">{p}</span>
                    <span className="text-[11px] text-brand font-bold">
                      {lang === 'uz' ? "Qo'ng'iroq qilish →" : 'Позвонить →'}
                    </span>
                  </a>
                ))
              ) : (
                <p className="text-ink-secondary text-xs">
                  {lang === 'uz' ? "Telefon raqam ko'rsatilmagan" : 'Телефон не указан'}
                </p>
              )}
            </div>
          </div>

          {/* Ijtimoiy tarmoqlar */}
          {(restaurantInfo?.telegram || restaurantInfo?.instagram) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {restaurantInfo.telegram && (
                <a
                  href={
                    restaurantInfo.telegram.startsWith('http')
                      ? restaurantInfo.telegram
                      : `https://t.me/${restaurantInfo.telegram.replace('@', '')}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 p-3 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl border border-sky-200 font-semibold transition-all"
                >
                  <Send className="w-4 h-4 text-sky-600 shrink-0" />
                  <div className="truncate">
                    <span className="block text-[10px] text-sky-600">Telegram</span>
                    <span className="text-xs truncate block">{restaurantInfo.telegram}</span>
                  </div>
                </a>
              )}

              {restaurantInfo.instagram && (
                <a
                  href={
                    restaurantInfo.instagram.startsWith('http')
                      ? restaurantInfo.instagram
                      : `https://instagram.com/${restaurantInfo.instagram.replace('@', '')}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 p-3 bg-pink-50 hover:bg-pink-100 text-pink-800 rounded-xl border border-pink-200 font-semibold transition-all"
                >
                  <Instagram className="w-4 h-4 text-pink-600 shrink-0" />
                  <div className="truncate">
                    <span className="block text-[10px] text-pink-600">Instagram</span>
                    <span className="text-xs truncate block">{restaurantInfo.instagram}</span>
                  </div>
                </a>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => setInfoModalOpen(false)}>
              {lang === 'uz' ? 'Yopish' : 'Закрыть'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  </div>
  );
};
