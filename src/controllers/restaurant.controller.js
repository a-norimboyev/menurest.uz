const bcrypt = require('bcryptjs');
const prisma = require('../services/db.service');

const restaurantController = {
  async getPublicRestaurants(req, res) {
    try {
      const list = await prisma.restaurant.findMany({
        where: { isActive: true },
        select: {
          id: true, name: true, slug: true, logo: true, banner: true,
          phone: true, address: true, description: true, _count: { select: { tables: true } }
        }
      });
      const mapped = list.map(r => ({ ...r, tablesCount: r._count.tables }));
      res.json({ success: true, restaurants: mapped });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getPublicStats(req, res) {
    try {
      const totalRestaurants = await prisma.restaurant.count({ where: { isActive: true } });
      const totalMenuItems = await prisma.menuItem.count();
      res.json({ success: true, totalRestaurants, totalMenuItems });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getClientMenu(req, res) {
    try {
      const slug = req.params.slug.toLowerCase();
      const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
      if (!restaurant) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });

      const categories = await prisma.category.findMany({
        where: { restaurantId: restaurant.id, isActive: true },
        orderBy: { sortOrder: 'asc' }
      });
      
      const activeCategoryIds = categories.map(c => c.id);
      
      const menuItems = await prisma.menuItem.findMany({
        where: { restaurantId: restaurant.id, categoryId: { in: activeCategoryIds } }
      });
      const mappedItems = menuItems.map(m => ({ ...m, price: Number(m.price) }));

      res.json({ success: true, restaurant, categories, menuItems: mappedItems });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getRestaurantById(req, res) {
    try {
      const rest = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
      if (!rest) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
      res.json({ success: true, restaurant: rest });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateRestaurant(req, res) {
    try {
      const data = { ...req.body };
      if (req.files) {
        if (req.files.logoFile) data.logo = '/uploads/' + req.files.logoFile[0].filename;
        if (req.files.bannerFile) data.banner = '/uploads/' + req.files.bannerFile[0].filename;
      }
      if (data.serviceFeePercent !== undefined) data.serviceFeePercent = Number(data.serviceFeePercent) || 0;

      const currentRest = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
      if (!currentRest) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });

      // Password update logic for the main user of this restaurant
      if (data.password && data.password.trim() !== '') {
        const oldPassword = (data.oldPassword || '').trim();
        if (!oldPassword) return res.status(400).json({ success: false, message: "Yangi parol o'rnatish uchun joriy parolni kiritish shart!" });

        const user = await prisma.user.findFirst({ where: { restaurantId: currentRest.id, role: 'admin' } });
        if (user) {
          const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
          if (!isValid) return res.status(400).json({ success: false, message: "Eski parol noto'g'ri kiritildi!" });
          
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: await bcrypt.hash(data.password.trim(), 10) }
          });
        }
      }
      
      delete data.password;
      delete data.oldPassword;
      delete data.ownerAvatarFile; // ignore extra fields
      delete data.staff;
      delete data.tablesCount; // stored as actual tables now

      const updated = await prisma.restaurant.update({
        where: { id: req.params.id },
        data
      });

      res.json({ success: true, restaurant: updated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Super Admin
  async superGetRestaurants(req, res) {
    try {
      const list = await prisma.restaurant.findMany({
        include: {
          _count: { select: { menuItems: true, orders: true } }
        }
      });
      const mapped = list.map(r => ({
        ...r,
        dishesCount: r._count.menuItems,
        ordersCount: r._count.orders
      }));
      res.json({ success: true, restaurants: mapped });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async superCreateRestaurant(req, res) {
    try {
      const data = { ...req.body };
      if (req.files) {
        if (req.files.logo) data.logo = '/uploads/' + req.files.logo[0].filename;
        if (req.files.banner) data.banner = '/uploads/' + req.files.banner[0].filename;
      }
      
      const slug = (data.slug || data.name).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
      
      const newRest = await prisma.restaurant.create({
        data: {
          name: data.name,
          slug,
          logo: data.logo || '/images/default-logo.png',
          banner: data.banner || '/images/default-banner.jpg',
          phone: data.phone || '',
          address: data.address || '',
          description: data.description || '',
          serviceFeePercent: Number(data.serviceFeePercent) || 0,
          currency: data.currency || "so'm",
          isActive: data.isActive !== false
        }
      });

      // Create Admin User
      const rawPass = data.password ? String(data.password).trim() : '123456';
      await prisma.user.create({
        data: {
          restaurantId: newRest.id,
          username: slug,
          passwordHash: await bcrypt.hash(rawPass, 10),
          role: 'admin',
          name: data.name + ' Admin'
        }
      });

      // Create Categories
      await prisma.category.createMany({
        data: [
          { restaurantId: newRest.id, nameUz: "Asosiy Taomlar", nameRu: "Основные блюда", nameEn: "Main Dishes", icon: "fa-solid fa-utensils", sortOrder: 1 },
          { restaurantId: newRest.id, nameUz: "Ichimliklar", nameRu: "Напитки", nameEn: "Drinks", icon: "fa-solid fa-mug-hot", sortOrder: 2 }
        ]
      });

      res.json({ success: true, restaurant: newRest });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async superUpdateRestaurant(req, res) {
    try {
      const { password, ...updateData } = req.body;
      const updated = await prisma.restaurant.update({
        where: { id: req.params.id },
        data: updateData
      });

      if (password && password.trim() !== '') {
        const user = await prisma.user.findFirst({ where: { restaurantId: updated.id, role: 'admin' } });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: await bcrypt.hash(password.trim(), 10) }
          });
        }
      }

      res.json({ success: true, restaurant: updated });
    } catch (err) {
      res.status(404).json({ success: false, message: 'Restoran topilmadi' });
    }
  },

  async superDeleteRestaurant(req, res) {
    try {
      await prisma.restaurant.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async superGetStats(req, res) {
    try {
      const [totalRestaurants, totalMenuItems, totalOrders] = await Promise.all([
        prisma.restaurant.count(),
        prisma.menuItem.count(),
        prisma.order.count()
      ]);
      res.json({ success: true, totalRestaurants, totalMenuItems, totalOrders });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = restaurantController;
