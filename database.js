const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILES = {
  restaurants: path.join(DATA_DIR, 'restaurants.json'),
  categories: path.join(DATA_DIR, 'categories.json'),
  menuItems: path.join(DATA_DIR, 'menu_items.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  tables: path.join(DATA_DIR, 'tables.json'),
  reviews: path.join(DATA_DIR, 'reviews.json')
};

// Yordamchi o'qish va yozish funksiyalari
function readData(fileKey, defaultValue = []) {
  const filePath = FILES[fileKey];
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
    return defaultValue;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

function writeData(fileKey, data) {
  const filePath = FILES[fileKey];
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

const db = {
  // === RESTORANLAR ===
  getRestaurants() {
    return readData('restaurants', []);
  },
  getRestaurantById(id) {
    const list = this.getRestaurants();
    return list.find(r => r.id === id) || null;
  },
  getRestaurantBySlug(slug) {
    const list = this.getRestaurants();
    return list.find(r => r.slug === slug.toLowerCase()) || null;
  },
  createRestaurant(data) {
    const list = this.getRestaurants();
    const newRest = {
      id: generateId(),
      name: data.name,
      slug: (data.slug || data.name).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-'),
      logo: data.logo || '/images/default-logo.png',
      banner: data.banner || '/images/default-banner.jpg',
      phone: data.phone || '',
      address: data.address || '',
      description: data.description || '',
      password: data.password || '123456',
      serviceFeePercent: Number(data.serviceFeePercent) || 0,
      currency: data.currency || "so'm",
      tablesCount: Number(data.tablesCount) || 10,
      isActive: data.isActive !== false,
      createdAt: new Date().toISOString()
    };
    list.push(newRest);
    writeData('restaurants', list);
    return newRest;
  },
  updateRestaurant(id, data) {
    const list = this.getRestaurants();
    const idx = list.findIndex(r => r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
    writeData('restaurants', list);
    return list[idx];
  },
  deleteRestaurant(id) {
    let list = this.getRestaurants();
    list = list.filter(r => r.id !== id);
    writeData('restaurants', list);

    // Unga tegishli taomlar va kategoriyalarni ham tozalash
    let cats = this.getAllCategories().filter(c => c.restaurantId !== id);
    writeData('categories', cats);

    let items = this.getAllMenuItems().filter(m => m.restaurantId !== id);
    writeData('menuItems', items);

    let orders = this.getAllOrders().filter(o => o.restaurantId !== id);
    writeData('orders', orders);

    return true;
  },

  // === KATEGORIYALAR ===
  getAllCategories() {
    return readData('categories', []);
  },
  getCategories(restaurantId) {
    return this.getAllCategories()
      .filter(c => c.restaurantId === restaurantId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  },
  getCategoryById(id) {
    return this.getAllCategories().find(c => c.id === id) || null;
  },
  createCategory(data) {
    const list = this.getAllCategories();
    const newCat = {
      id: generateId(),
      restaurantId: data.restaurantId,
      nameUz: data.nameUz,
      nameRu: data.nameRu || data.nameUz,
      nameEn: data.nameEn || data.nameUz,
      icon: data.icon || 'fas fa-utensils',
      sortOrder: Number(data.sortOrder) || list.length + 1
    };
    list.push(newCat);
    writeData('categories', list);
    return newCat;
  },
  updateCategory(id, data) {
    const list = this.getAllCategories();
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data };
    writeData('categories', list);
    return list[idx];
  },
  deleteCategory(id) {
    let list = this.getAllCategories();
    list = list.filter(c => c.id !== id);
    writeData('categories', list);

    // Shu kategoriyadagi taomlarni ham o'chirish yoki kategoriyasiz qoldirish
    let items = this.getAllMenuItems().filter(i => i.categoryId !== id);
    writeData('menuItems', items);
    return true;
  },

  // === TAOMLAR (MENU ITEMS) ===
  getAllMenuItems() {
    return readData('menuItems', []);
  },
  getMenuItems(restaurantId) {
    return this.getAllMenuItems().filter(m => m.restaurantId === restaurantId);
  },
  getMenuItemById(id) {
    return this.getAllMenuItems().find(m => m.id === id) || null;
  },
  createMenuItem(data) {
    const list = this.getAllMenuItems();
    const newItem = {
      id: generateId(),
      restaurantId: data.restaurantId,
      categoryId: data.categoryId,
      nameUz: data.nameUz,
      nameRu: data.nameRu || data.nameUz,
      nameEn: data.nameEn || data.nameUz,
      price: Number(data.price) || 0,
      image: data.image || '/images/default-dish.jpg',
      descriptionUz: data.descriptionUz || '',
      descriptionRu: data.descriptionRu || '',
      descriptionEn: data.descriptionEn || '',
      weight: data.weight || '',
      isAvailable: data.isAvailable !== false,
      isPopular: !!data.isPopular,
      createdAt: new Date().toISOString()
    };
    list.push(newItem);
    writeData('menuItems', list);
    return newItem;
  },
  updateMenuItem(id, data) {
    const list = this.getAllMenuItems();
    const idx = list.findIndex(m => m.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data };
    writeData('menuItems', list);
    return list[idx];
  },
  deleteMenuItem(id) {
    let list = this.getAllMenuItems();
    list = list.filter(m => m.id !== id);
    writeData('menuItems', list);
    return true;
  },

  // === BUYURTMALAR (ORDERS) ===
  getAllOrders() {
    return readData('orders', []);
  },
  getOrders(restaurantId) {
    return this.getAllOrders()
      .filter(o => o.restaurantId === restaurantId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  createOrder(data) {
    const list = this.getAllOrders();
    const newOrder = {
      id: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
      restaurantId: data.restaurantId,
      tableNumber: data.tableNumber || 1,
      items: data.items || [], // [{ id, name, price, quantity, comment }]
      subtotal: Number(data.subtotal) || 0,
      serviceFee: Number(data.serviceFee) || 0,
      totalPrice: Number(data.totalPrice) || 0,
      status: 'new', // new, preparing, ready, delivered, cancelled
      type: data.type || 'order', // 'order' yoki 'call_waiter'
      note: data.note || '',
      paymentStatus: 'unpaid', // 'unpaid', 'paid'
      paymentMethod: null, // 'cash', 'card', 'click'
      receiptId: null,
      paidAt: null,
      waiterAction: (data.type === 'call_waiter' || data.type === 'bill_request') ? 'pending' : null,
      createdAt: new Date().toISOString()
    };
    list.push(newOrder);
    writeData('orders', list);
    return newOrder;
  },
  updateOrderStatus(id, status, reason = null) {
    const list = this.getAllOrders();
    const idx = list.findIndex(o => o.id === id);
    if (idx === -1) return null;
    list[idx].status = status;
    if (reason) list[idx].cancellationReason = reason;
    list[idx].updatedAt = new Date().toISOString();
    writeData('orders', list);
    return list[idx];
  },
  // Stol bo'yicha to'lanmagan faol buyurtmalarni olish (Mijoz & Kassa uchun)
  getTableOrders(restaurantId, tableNumber) {
    const orders = this.getOrders(restaurantId);
    return orders.filter(o => Number(o.tableNumber) === Number(tableNumber) && o.paymentStatus !== 'paid' && o.status !== 'cancelled');
  },
  // Kassa: To'lovni qabul qilish va chek shakllantirish
  payOrder(id, options = {}) {
    const list = this.getAllOrders();
    const idx = list.findIndex(o => o.id === id);
    if (idx === -1) return null;

    const order = list[idx];
    const paymentMethod = typeof options === 'string' ? options : (options.paymentMethod || 'cash');
    const discountPercent = typeof options === 'object' ? (Number(options.discountPercent) || 0) : 0;
    const cashierName = (typeof options === 'object' && options.cashierName) ? options.cashierName : 'Kassir';

    const discountAmount = Math.round((order.totalPrice * discountPercent) / 100);
    const finalAmount = Math.max(0, order.totalPrice - discountAmount);
    const receivedAmount = (typeof options === 'object' && options.receivedAmount) ? Number(options.receivedAmount) : finalAmount;
    const changeAmount = Math.max(0, receivedAmount - finalAmount);

    order.paymentStatus = 'paid';
    order.paymentMethod = paymentMethod;
    order.discountPercent = discountPercent;
    order.discountAmount = discountAmount;
    order.finalAmount = finalAmount;
    order.receivedAmount = receivedAmount;
    order.changeAmount = changeAmount;
    order.cashierName = cashierName;
    order.receiptId = order.receiptId || ('CHK-' + Math.floor(100000 + Math.random() * 900000));
    order.paidAt = new Date().toISOString();
    if (order.status !== 'delivered' && order.status !== 'cancelled') {
      order.status = 'delivered';
    }
    writeData('orders', list);
    return order;
  },
  // Kassa: Z-Hisobot (Smena / Kunlik kassa yopish hisoboti)
  getZReport(restaurantId) {
    const orders = this.getOrders(restaurantId);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const todayPaidOrders = orders.filter(o => o.paymentStatus === 'paid' && o.paidAt && o.paidAt.startsWith(todayStr));

    let cashTotal = 0;
    let cardTotal = 0;
    let clickTotal = 0;
    let grossTotal = 0;
    let discountsTotal = 0;
    let netTotal = 0;

    todayPaidOrders.forEach(o => {
      const total = o.finalAmount !== undefined ? o.finalAmount : o.totalPrice;
      grossTotal += (o.totalPrice || 0);
      discountsTotal += (o.discountAmount || 0);
      netTotal += total;

      if (o.paymentMethod === 'card') cardTotal += total;
      else if (o.paymentMethod === 'click') clickTotal += total;
      else cashTotal += total;
    });

    return {
      reportId: 'Z-' + Date.now().toString().slice(-6),
      date: todayStr,
      generatedAt: now.toISOString(),
      totalReceipts: todayPaidOrders.length,
      grossTotal,
      discountsTotal,
      netTotal,
      cashTotal,
      cardTotal,
      clickTotal,
      receipts: todayPaidOrders
    };
  },
  // Ofitsiant: Chaqiruvni qabul qilib "Bordim" deb belgilash
  acknowledgeCall(id, waiterName = 'Ofitsiant') {
    const list = this.getAllOrders();
    const idx = list.findIndex(o => o.id === id);
    if (idx === -1) return null;
    list[idx].waiterAction = 'acknowledged';
    list[idx].waiterName = waiterName;
    list[idx].status = 'delivered';
    list[idx].updatedAt = new Date().toISOString();
    writeData('orders', list);
    return list[idx];
  },
  // Boshliq: Moliyaviy va savdo tahlili statistikasi
  getBossStats(restaurantId, period = 'today') {
    const orders = this.getOrders(restaurantId);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let todayRevenue = 0;
    let yesterdayRevenue = 0;
    let totalRevenue = 0;
    let todayOrdersCount = 0;
    let cashTotal = 0;
    let cardTotal = 0;
    let clickTotal = 0;

    const dishSales = {}; // { dishName: { count, revenue } }

    orders.forEach(o => {
      const orderDate = o.createdAt ? o.createdAt.split('T')[0] : '';
      const isPaid = o.paymentStatus === 'paid' || o.status === 'delivered';
      const amount = o.finalAmount !== undefined ? o.finalAmount : o.totalPrice;

      if (isPaid && amount > 0) {
        totalRevenue += amount;

        if (orderDate === todayStr) {
          todayRevenue += amount;
          todayOrdersCount++;
        } else if (orderDate === yesterdayStr) {
          yesterdayRevenue += amount;
        }

        if (o.paymentMethod === 'card') cardTotal += amount;
        else if (o.paymentMethod === 'click') clickTotal += amount;
        else cashTotal += amount;

        // Taomlar hisobi
        if (Array.isArray(o.items)) {
          o.items.forEach(it => {
            if (!dishSales[it.name]) {
              dishSales[it.name] = { name: it.name, count: 0, revenue: 0 };
            }
            dishSales[it.name].count += it.quantity || 1;
            dishSales[it.name].revenue += (it.price * (it.quantity || 1));
          });
        }
      }
    });

    const topDishes = Object.values(dishSales)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const averageCheck = todayOrdersCount > 0 ? Math.round(todayRevenue / todayOrdersCount) : 0;

    return {
      todayRevenue,
      yesterdayRevenue,
      totalRevenue,
      todayOrdersCount,
      totalOrdersCount: orders.length,
      averageCheck,
      cashTotal,
      cardTotal,
      clickTotal,
      topDishes
    };
  },

  getBossAnalytics(restaurantId, options = {}) {
    const orders = this.getOrders(restaurantId);
    const period = options.period || 'today';
    const now = new Date();

    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Filter orders based on period
    const filteredOrders = orders.filter(o => {
      const isPaid = o.paymentStatus === 'paid' || o.status === 'delivered';
      if (!isPaid) return false;
      const oDate = o.createdAt ? o.createdAt.split('T')[0] : '';
      if (!oDate) return false;

      if (period === 'today') {
        return oDate === todayStr;
      } else if (period === 'yesterday') {
        return oDate === yesterdayStr;
      } else if (period === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(o.createdAt) >= weekAgo;
      } else if (period === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return new Date(o.createdAt) >= monthAgo;
      } else if (period === 'custom' && options.startDate) {
        const s = options.startDate;
        const e = options.endDate || todayStr;
        return oDate >= s && oDate <= e;
      }
      return true; // 'all'
    });

    // Kechagi tushumni hisoblash
    let yesterdayRevenue = 0;
    orders.forEach(o => {
      const isPaid = o.paymentStatus === 'paid' || o.status === 'delivered';
      if (!isPaid) return;
      const oDate = o.createdAt ? o.createdAt.split('T')[0] : '';
      if (oDate === yesterdayStr) {
        const amount = o.finalAmount !== undefined ? o.finalAmount : o.totalPrice;
        yesterdayRevenue += (amount || 0);
      }
    });

    let totalRevenue = 0;
    let serviceFeeTotal = 0;
    let cashTotal = 0;
    let cardTotal = 0;
    let clickTotal = 0;
    const dishSales = {};
    const waiterStats = {};
    const hourlySales = Array(24).fill(0);
    const dailySalesMap = {};

    filteredOrders.forEach(o => {
      const amount = o.finalAmount !== undefined ? o.finalAmount : o.totalPrice;
      if (amount <= 0) return;

      totalRevenue += amount;
      serviceFeeTotal += (o.serviceFee || 0);
      if (o.paymentMethod === 'card') cardTotal += amount;
      else if (o.paymentMethod === 'click') clickTotal += amount;
      else cashTotal += amount;

      // Soatbay tushum
      if (o.createdAt) {
        const hour = new Date(o.createdAt).getHours();
        if (hour >= 0 && hour < 24) {
          hourlySales[hour] += amount;
        }

        const dateKey = o.createdAt.split('T')[0];
        dailySalesMap[dateKey] = (dailySalesMap[dateKey] || 0) + amount;
      }

      // Ofitsiant tahlili
      const waiter = o.waiterName || o.cashierName || 'Ofitsiant 1';
      if (!waiterStats[waiter]) {
        waiterStats[waiter] = { name: waiter, count: 0, revenue: 0 };
      }
      waiterStats[waiter].count++;
      waiterStats[waiter].revenue += amount;

      // Taomlar hisobi
      if (Array.isArray(o.items)) {
        o.items.forEach(it => {
          if (!dishSales[it.name]) {
            dishSales[it.name] = { name: it.name, count: 0, revenue: 0 };
          }
          dishSales[it.name].count += it.quantity || 1;
          dishSales[it.name].revenue += (it.price * (it.quantity || 1));
        });
      }
    });

    // Bekor qilingan buyurtmalar va zarar tahlili
    const cancelledOrders = orders.filter(o => {
      if (o.status !== 'cancelled') return false;
      const oDate = o.createdAt ? o.createdAt.split('T')[0] : '';
      if (!oDate) return false;
      if (period === 'today') return oDate === todayStr;
      if (period === 'yesterday') return oDate === yesterdayStr;
      if (period === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(o.createdAt) >= weekAgo;
      }
      if (period === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return new Date(o.createdAt) >= monthAgo;
      }
      return true;
    });
    const cancelledTotal = cancelledOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    const averageCheck = filteredOrders.length > 0 ? Math.round(totalRevenue / filteredOrders.length) : 0;
    const topDishes = Object.values(dishSales).sort((a, b) => b.count - a.count).slice(0, 5);

    // Eng kam sotilgan taomlar (Autsayderlar)
    const allMenuItems = this.getMenuItems(restaurantId);
    const leastDishes = allMenuItems.map(m => {
      const name = m.nameUz || m.name;
      const stat = dishSales[name] || dishSales[m.name] || { count: 0, revenue: 0 };
      return {
        name,
        count: stat.count,
        revenue: stat.revenue,
        price: m.price
      };
    }).sort((a, b) => a.count - b.count).slice(0, 5);

    const waiterPerformance = Object.values(waiterStats).map(w => ({
      ...w,
      averageCheck: w.count > 0 ? Math.round(w.revenue / w.count) : 0
    })).sort((a, b) => b.revenue - a.revenue);

    // Kunbay savdo massivini tartiblash
    const dailySales = Object.keys(dailySalesMap).sort().map(d => ({
      date: d,
      revenue: dailySalesMap[d]
    }));

    // Eng qizg'in soatni topish
    let peakHour = 0;
    let peakHourRevenue = 0;
    hourlySales.forEach((rev, h) => {
      if (rev > peakHourRevenue) {
        peakHourRevenue = rev;
        peakHour = h;
      }
    });

    return {
      period,
      totalRevenue,
      yesterdayRevenue,
      serviceFeeTotal,
      cancelledOrdersCount: cancelledOrders.length,
      cancelledTotal,
      cancelledOrders: cancelledOrders.slice(0, 10),
      ordersCount: filteredOrders.length,
      averageCheck,
      cashTotal,
      cardTotal,
      clickTotal,
      topDishes,
      leastDishes,
      waiterPerformance,
      hourlySales,
      dailySales,
      peakHour: `${peakHour}:00 - ${peakHour + 1}:00`,
      peakHourRevenue
    };
  },

  // === FIKR-MULOHAZALAR & REYTING (REVIEWS) ===
  getAllReviews() {
    return readData('reviews', []);
  },
  getReviews(restaurantId) {
    return this.getAllReviews()
      .filter(r => r.restaurantId === restaurantId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  createReview(data) {
    const list = this.getAllReviews();
    const newReview = {
      id: 'REV-' + Date.now().toString(36),
      restaurantId: data.restaurantId,
      tableNumber: Number(data.tableNumber) || 1,
      rating: Math.min(5, Math.max(1, Number(data.rating) || 5)),
      comment: data.comment || '',
      createdAt: new Date().toISOString()
    };
    list.push(newReview);
    writeData('reviews', list);
    return newReview;
  },
  getReviewsStats(restaurantId) {
    const allReviews = this.getReviews(restaurantId);
    
    // Faqat bugungi fikr-mulohazalar (Today only)
    const now = new Date();
    const todayIso = now.toISOString().split('T')[0];
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const todayReviews = allReviews.filter(r => {
      if (!r.createdAt) return false;
      const d = r.createdAt.split('T')[0];
      return d === todayIso || d === todayLocal;
    });

    if (todayReviews.length === 0) {
      return {
        averageRating: 5.0,
        totalCount: 0,
        reviews: [],
        allTimeCount: allReviews.length
      };
    }

    const sum = todayReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    const avg = Number((sum / todayReviews.length).toFixed(1));
    return {
      averageRating: avg,
      totalCount: todayReviews.length,
      reviews: todayReviews,
      allTimeCount: allReviews.length
    };
  }
};

module.exports = db;
