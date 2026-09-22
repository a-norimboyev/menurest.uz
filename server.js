const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const db = require('./database');

// Dastlabki ma'lumotlarni yuklash (agar bo'sh bo'lsa)
try {
  require('./seed');
} catch (e) {
  console.log('Seed yuklanmadi yoki allaqachon mavjud:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Uploads papkasini tekshirish
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer sozlamalari (rasmlar yuklash uchun)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'dish-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


// Oshxona (KDS) ekrani marshruti
app.get('/kitchen', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kitchen', 'index.html'));
});

// ==================== MIJOZLAR UCHUN API ====================

// Restoran menyusi va ma'lumotlarini olish
app.get('/api/r/:slug', (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const restaurant = db.getRestaurantBySlug(slug);
  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
  }

  const categories = db.getCategories(restaurant.id);
  const menuItems = db.getMenuItems(restaurant.id);

  // Parolni mijozga ko'rsatmaslik
  const safeRestaurant = { ...restaurant };
  delete safeRestaurant.password;

  res.json({
    success: true,
    restaurant: safeRestaurant,
    categories,
    menuItems
  });
});

// Yangi buyurtma yuborish
app.post('/api/r/:slug/order', async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const restaurant = db.getRestaurantBySlug(slug);
  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
  }

  const { tableNumber, items, subtotal, serviceFee, totalPrice, note, type } = req.body;
  
  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: "Savatcha bo'sh" });
  }

  const order = db.createOrder({
    restaurantId: restaurant.id,
    tableNumber: Number(tableNumber) || 1,
    items,
    subtotal,
    serviceFee,
    totalPrice,
    note,
    type: type || 'order'
  });

  res.json({ success: true, order });
});

// Ofitsiantni chaqirish yoki hisobni so'rash
app.post('/api/r/:slug/call-waiter', (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const restaurant = db.getRestaurantBySlug(slug);
  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
  }

  const { tableNumber, callType } = req.body; // callType: 'waiter' yoki 'bill'

  const callOrder = db.createOrder({
    restaurantId: restaurant.id,
    tableNumber: Number(tableNumber) || 1,
    items: [],
    subtotal: 0,
    serviceFee: 0,
    totalPrice: 0,
    type: callType === 'bill' ? 'bill_request' : 'call_waiter',
    note: callType === 'bill' ? "Mijoz hisobni so'ramoqda" : "Mijoz ofitsiantni chaqirmoqda"
  });

  res.json({ success: true, message: "Xabar ofitsiantga yetkazildi", order: callOrder });
});

// Stol bo'yicha faol buyurtmalar va holatni olish (Mijoz uchun jonli kuzatish)
app.get('/api/r/:slug/table-orders/:tableNumber', (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const restaurant = db.getRestaurantBySlug(slug);
  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
  }

  const tableNumber = Number(req.params.tableNumber);
  const activeOrders = db.getTableOrders(restaurant.id, tableNumber);
  const totalAmount = activeOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  res.json({
    success: true,
    tableNumber,
    activeOrders,
    totalAmount
  });
});

// Mijoz Online To'lovi (Click / Payme)
app.post('/api/r/:slug/online-pay', (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const restaurant = db.getRestaurantBySlug(slug);
  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
  }

  const { tableNumber, paymentMethod } = req.body; // 'click' yoki 'payme'
  const activeOrders = db.getTableOrders(restaurant.id, Number(tableNumber));

  if (activeOrders.length === 0) {
    return res.status(400).json({ success: false, message: "To'lanishi kerak bo'lgan faol buyurtma topilmadi" });
  }

  const paidOrders = [];
  activeOrders.forEach(o => {
    const paid = db.payOrder(o.id, {
      paymentMethod: paymentMethod || 'click',
      discountPercent: 0,
      cashierName: 'Online POS'
    });
    if (paid) paidOrders.push(paid);
  });

  res.json({
    success: true,
    message: "To'lov muvaffaqiyatli qabul qilindi",
    paidOrders,
    receiptId: paidOrders[0]?.receiptId
  });
});

// Mijoz Fikr-mulohaza (Rating & Review) qoldirish
app.post('/api/r/:slug/review', (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const restaurant = db.getRestaurantBySlug(slug);
  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
  }

  const { tableNumber, rating, comment } = req.body;
  const review = db.createReview({
    restaurantId: restaurant.id,
    tableNumber,
    rating,
    comment
  });

  res.json({ success: true, review });
});

// ==================== RESTORAN ADMIN API ====================

// Restoran admini kirishi
app.post('/api/admin/login', (req, res) => {
  const { slug, password } = req.body;
  if (!slug || !password) {
    return res.status(400).json({ success: false, message: "Restoran identifikatori va parol kiritilishi shart" });
  }

  const restaurant = db.getRestaurantBySlug(slug);
  if (!restaurant || restaurant.password !== password) {
    return res.status(401).json({ success: false, message: "Restoran identifikatori yoki parol noto'g'ri" });
  }

  const safeRestaurant = { ...restaurant };
  delete safeRestaurant.password;

  res.json({ success: true, restaurant: safeRestaurant });
});

// Restoran ma'lumotlarini olish va tahrirlash
app.get('/api/admin/restaurant/:id', (req, res) => {
  const rest = db.getRestaurantById(req.params.id);
  if (!rest) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
  const safe = { ...rest };
  delete safe.password;
  res.json({ success: true, restaurant: safe });
});

app.put('/api/admin/restaurant/:id', upload.fields([{ name: 'logoFile', maxCount: 1 }, { name: 'bannerFile', maxCount: 1 }]), (req, res) => {
  try {
    const data = { ...req.body };
    if (req.files) {
      if (req.files.logoFile) data.logo = '/uploads/' + req.files.logoFile[0].filename;
      if (req.files.bannerFile) data.banner = '/uploads/' + req.files.bannerFile[0].filename;
    }
    if (data.serviceFeePercent !== undefined) data.serviceFeePercent = Number(data.serviceFeePercent) || 0;
    if (data.tablesCount !== undefined) data.tablesCount = Number(data.tablesCount) || 15;

    // Agar yangi parol kiritilmagan bo'lsa, eskisini saqlab qolish
    if (!data.password || data.password.trim() === '') {
      delete data.password;
    }

    const updated = db.updateRestaurant(req.params.id, data);
    if (!updated) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
    
    const safe = { ...updated };
    delete safe.password;
    res.json({ success: true, restaurant: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Kategoriyalar
app.get('/api/admin/categories/:restaurantId', (req, res) => {
  const cats = db.getCategories(req.params.restaurantId);
  res.json({ success: true, categories: cats });
});

app.post('/api/admin/categories', (req, res) => {
  const { restaurantId, nameUz, nameRu, nameEn, icon, sortOrder } = req.body;
  if (!restaurantId || !nameUz) {
    return res.status(400).json({ success: false, message: "Kategoriya nomi kiritilmadi" });
  }
  const cat = db.createCategory({ restaurantId, nameUz, nameRu, nameEn, icon, sortOrder });
  res.json({ success: true, category: cat });
});

app.put('/api/admin/categories/:id', (req, res) => {
  const cat = db.updateCategory(req.params.id, req.body);
  if (!cat) return res.status(404).json({ success: false, message: 'Kategoriya topilmadi' });
  res.json({ success: true, category: cat });
});

app.delete('/api/admin/categories/:id', (req, res) => {
  db.deleteCategory(req.params.id);
  res.json({ success: true });
});

// Taomlar (Menu Items)
app.get('/api/admin/menu/:restaurantId', (req, res) => {
  const items = db.getMenuItems(req.params.restaurantId);
  res.json({ success: true, menuItems: items });
});

// Yangi taom qo'shish (rasm yuklash bilan birga)
app.post('/api/admin/menu', upload.single('imageFile'), (req, res) => {
  try {
    const {
      restaurantId,
      categoryId,
      nameUz,
      nameRu,
      nameEn,
      price,
      imageUrl,
      descriptionUz,
      descriptionRu,
      descriptionEn,
      weight,
      isPopular
    } = req.body;

    if (!restaurantId || !nameUz || !price) {
      return res.status(400).json({ success: false, message: "Taom nomi va narxi majburiy" });
    }

    let image = imageUrl || '/images/default-dish.jpg';
    if (req.file) {
      image = '/uploads/' + req.file.filename;
    }

    const item = db.createMenuItem({
      restaurantId,
      categoryId,
      nameUz,
      nameRu,
      nameEn,
      price: Number(price),
      image,
      descriptionUz,
      descriptionRu,
      descriptionEn,
      weight,
      isPopular: isPopular === 'true' || isPopular === true
    });

    res.json({ success: true, menuItem: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Taomni yangilash
app.put('/api/admin/menu/:id', upload.single('imageFile'), (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.price) updateData.price = Number(updateData.price);
    if (req.file) {
      updateData.image = '/uploads/' + req.file.filename;
    }
    if (updateData.isPopular !== undefined) {
      updateData.isPopular = updateData.isPopular === 'true' || updateData.isPopular === true;
    }
    if (updateData.isAvailable !== undefined) {
      updateData.isAvailable = updateData.isAvailable === 'true' || updateData.isAvailable === true;
    }

    const item = db.updateMenuItem(req.params.id, updateData);
    if (!item) return res.status(404).json({ success: false, message: 'Taom topilmadi' });
    res.json({ success: true, menuItem: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/admin/menu/:id', (req, res) => {
  db.deleteMenuItem(req.params.id);
  res.json({ success: true });
});

// Buyurtmalar
app.get('/api/admin/orders/:restaurantId', (req, res) => {
  const orders = db.getOrders(req.params.restaurantId);
  res.json({ success: true, orders });
});

app.put('/api/admin/orders/:id/status', (req, res) => {
  const { status, reason } = req.body;
  const order = db.updateOrderStatus(req.params.id, status, reason);
  if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });
  res.json({ success: true, order });
});

// Kassa: To'lovni qabul qilish
app.post('/api/admin/orders/:id/pay', (req, res) => {
  const { paymentMethod, discountPercent, receivedAmount, cashierName } = req.body;
  const order = db.payOrder(req.params.id, {
    paymentMethod: paymentMethod || 'cash',
    discountPercent: Number(discountPercent) || 0,
    receivedAmount: Number(receivedAmount) || 0,
    cashierName: cashierName || 'Kassir'
  });
  if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });
  res.json({ success: true, order });
});

// Kassa: Z-Hisobot (Smena / Kunlik kassa yopish)
app.get('/api/admin/cashier/z-report/:restaurantId', (req, res) => {
  const report = db.getZReport(req.params.restaurantId);
  res.json({ success: true, report });
});

// Ofitsiant: Chaqiruvni qabul qilish
app.post('/api/admin/orders/:id/acknowledge-call', (req, res) => {
  const { waiterName } = req.body;
  const order = db.acknowledgeCall(req.params.id, waiterName || 'Ofitsiant');
  if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });
  res.json({ success: true, order });
});

// Boshliq: Moliyaviy va savdo tahlili statistikasi
app.get('/api/admin/boss/stats/:restaurantId', (req, res) => {
  const period = req.query.period || 'today';
  const stats = db.getBossStats(req.params.restaurantId, period);
  res.json({ success: true, stats });
});

// Boshliq: Kengaytirilgan tahlil, grafiklar va xodimlar unumdorligi statistikasi
app.get('/api/admin/boss/analytics/:restaurantId', (req, res) => {
  const analytics = db.getBossAnalytics(req.params.restaurantId, req.query);
  res.json({ success: true, analytics });
});

// QR Kodlarni generatsiya qilish (Stollar bo'yicha)
app.get('/api/admin/qr-codes/:restaurantId', async (req, res) => {
  try {
    const restaurant = db.getRestaurantById(req.params.restaurantId);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });

    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    const tablesCount = restaurant.tablesCount || 10;
    const qrList = [];

    for (let i = 1; i <= tablesCount; i++) {
      const targetUrl = `${baseUrl}/r/${restaurant.slug}?table=${i}`;
      const qrDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#1e293b',
          light: '#ffffff'
        }
      });

      qrList.push({
        tableNumber: i,
        targetUrl,
        qrDataUrl
      });
    }

    res.json({
      success: true,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        logo: restaurant.logo
      },
      qrCodes: qrList
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Telegram ulanishini test qilish
// Taom mavjudligini o'zgartirish (Stop-list)
app.patch('/api/admin/menu/:id/toggle-availability', (req, res) => {
  const item = db.getMenuItemById(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Taom topilmadi' });
  const newStatus = req.body.isAvailable !== undefined ? req.body.isAvailable : !item.isAvailable;
  const updated = db.updateMenuItem(req.params.id, { isAvailable: newStatus });
  res.json({ success: true, menuItem: updated });
});

// Restoran sharhlari va reytingi
app.get('/api/admin/reviews/:restaurantId', (req, res) => {
  const stats = db.getReviewsStats(req.params.restaurantId);
  res.json({ success: true, ...stats });
});

// ==================== SUPER ADMIN API ====================

app.get('/api/super/restaurants', (req, res) => {
  const list = db.getRestaurants().map(r => {
    const dishes = db.getMenuItems(r.id).length;
    const orders = db.getOrders(r.id).length;
    return { ...r, dishesCount: dishes, ordersCount: orders };
  });
  res.json({ success: true, restaurants: list });
});

app.post('/api/super/restaurants', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), (req, res) => {
  try {
    const data = { ...req.body };
    if (req.files) {
      if (req.files.logo) data.logo = '/uploads/' + req.files.logo[0].filename;
      if (req.files.banner) data.banner = '/uploads/' + req.files.banner[0].filename;
    }
    const newRest = db.createRestaurant(data);

    // Yangi restoranga boshlang'ich bir-ikkita kategoriya qo'shib berish
    db.createCategory({
      restaurantId: newRest.id,
      nameUz: "Asosiy Taomlar",
      nameRu: "Основные блюда",
      nameEn: "Main Dishes",
      icon: "fa-solid fa-utensils",
      sortOrder: 1
    });
    db.createCategory({
      restaurantId: newRest.id,
      nameUz: "Ichimliklar",
      nameRu: "Напитки",
      nameEn: "Drinks",
      icon: "fa-solid fa-mug-hot",
      sortOrder: 2
    });

    res.json({ success: true, restaurant: newRest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/super/restaurants/:id', (req, res) => {
  const updated = db.updateRestaurant(req.params.id, req.body);
  if (!updated) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
  res.json({ success: true, restaurant: updated });
});

app.delete('/api/super/restaurants/:id', (req, res) => {
  db.deleteRestaurant(req.params.id);
  res.json({ success: true });
});

app.get('/api/super/stats', (req, res) => {
  const restaurants = db.getRestaurants();
  const items = db.getAllMenuItems();
  const orders = db.getAllOrders();
  res.json({
    success: true,
    totalRestaurants: restaurants.length,
    totalMenuItems: items.length,
    totalOrders: orders.length
  });
});

// ==================== SAHIFALARNI YO'NALTIRISH (ROUTING) ====================

// Oshxona ekrani (KDS): /kitchen
app.get('/kitchen', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kitchen', 'index.html'));
});

// Mijoz menyusi: /r/:slug
app.get('/r/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'r', 'index.html'));
});

// Restoran Admin paneli: /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Super Admin paneli: /super-admin
app.get('/super-admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'super-admin', 'index.html'));
});

// Asosiy sahifa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serverni ishga tushirish
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 QR Menyu platformasi muvaffaqiyatli ishga tushdi!`);
  console.log(`📍 Asosiy platforma:     http://localhost:${PORT}`);
  console.log(`📱 Mijoz namunasi:       http://localhost:${PORT}/r/rayhon?table=1`);
  console.log(`👨‍🍳 Restoran Admin:       http://localhost:${PORT}/admin`);
  console.log(`👑 Super Admin:          http://localhost:${PORT}/super-admin`);
  console.log(`====================================================`);
});
