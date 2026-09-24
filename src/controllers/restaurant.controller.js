const storage = require('../services/storage.service');

const restaurantController = {
  getPublicRestaurants(req, res) {
    const list = storage.getRestaurants().filter(r => r.isActive !== false).map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      logo: r.logo,
      banner: r.banner,
      phone: r.phone,
      address: r.address,
      description: r.description,
      tablesCount: r.tablesCount
    }));
    res.json({ success: true, restaurants: list });
  },

  getPublicStats(req, res) {
    const restaurants = storage.getRestaurants().filter(r => r.isActive !== false);
    const items = storage.getAllMenuItems();
    res.json({
      success: true,
      totalRestaurants: restaurants.length,
      totalMenuItems: items.length
    });
  },

  getClientMenu(req, res) {
    const slug = req.params.slug.toLowerCase();
    const restaurant = storage.getRestaurantBySlug(slug);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
    }

    const allCategories = storage.getCategories(restaurant.id);
    const categories = allCategories.filter(c => c.isActive !== false);
    const activeCategoryIds = new Set(categories.map(c => c.id));
    const menuItems = storage.getMenuItems(restaurant.id).filter(m => activeCategoryIds.has(m.categoryId));

    const safeRestaurant = { ...restaurant };
    delete safeRestaurant.password;

    res.json({
      success: true,
      restaurant: safeRestaurant,
      categories,
      menuItems
    });
  },

  getRestaurantById(req, res) {
    const rest = storage.getRestaurantById(req.params.id);
    if (!rest) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
    const safe = { ...rest };
    delete safe.password;
    res.json({ success: true, restaurant: safe });
  },

  updateRestaurant(req, res) {
    try {
      const data = { ...req.body };
      if (req.files) {
        if (req.files.logoFile) data.logo = '/uploads/' + req.files.logoFile[0].filename;
        if (req.files.bannerFile) data.banner = '/uploads/' + req.files.bannerFile[0].filename;
        if (req.files.ownerAvatarFile) data.ownerAvatar = '/uploads/' + req.files.ownerAvatarFile[0].filename;
      }
      if (data.serviceFeePercent !== undefined) data.serviceFeePercent = Number(data.serviceFeePercent) || 0;
      if (data.tablesCount !== undefined) data.tablesCount = Number(data.tablesCount) || 15;

      if (typeof data.staff === 'string') {
        try { data.staff = JSON.parse(data.staff); } catch (e) {}
      }

      if (data.password && data.password.trim() !== '') {
        const currentRest = storage.getRestaurantById(req.params.id);
        if (!currentRest) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });

        const oldPassword = (data.oldPassword || '').trim();
        if (!oldPassword) {
          return res.status(400).json({ success: false, message: "Yangi parol o'rnatish uchun joriy parolni kiritish shart!" });
        }
        if (!storage.verifyPassword(oldPassword, currentRest.password)) {
          return res.status(400).json({ success: false, message: "Eski parol noto'g'ri kiritildi!" });
        }
        delete data.oldPassword;
      } else {
        delete data.password;
        delete data.oldPassword;
      }

      const updated = storage.updateRestaurant(req.params.id, data);
      if (!updated) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });

      const safe = { ...updated };
      delete safe.password;
      res.json({ success: true, restaurant: safe });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Super Admin
  superGetRestaurants(req, res) {
    const list = storage.getRestaurants().map(r => {
      const dishes = storage.getMenuItems(r.id).length;
      const orders = storage.getOrders(r.id).length;
      const safe = { ...r, dishesCount: dishes, ordersCount: orders };
      delete safe.password;
      return safe;
    });
    res.json({ success: true, restaurants: list });
  },

  superCreateRestaurant(req, res) {
    try {
      const data = { ...req.body };
      if (req.files) {
        if (req.files.logo) data.logo = '/uploads/' + req.files.logo[0].filename;
        if (req.files.banner) data.banner = '/uploads/' + req.files.banner[0].filename;
      }
      const newRest = storage.createRestaurant(data);

      storage.createCategory({
        restaurantId: newRest.id,
        nameUz: "Asosiy Taomlar",
        nameRu: "Основные блюда",
        nameEn: "Main Dishes",
        icon: "fa-solid fa-utensils",
        sortOrder: 1
      });
      storage.createCategory({
        restaurantId: newRest.id,
        nameUz: "Ichimliklar",
        nameRu: "Напитки",
        nameEn: "Drinks",
        icon: "fa-solid fa-mug-hot",
        sortOrder: 2
      });

      const safe = { ...newRest };
      delete safe.password;
      res.json({ success: true, restaurant: safe });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  superUpdateRestaurant(req, res) {
    const updated = storage.updateRestaurant(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
    const safe = { ...updated };
    delete safe.password;
    res.json({ success: true, restaurant: safe });
  },

  superDeleteRestaurant(req, res) {
    storage.deleteRestaurant(req.params.id);
    res.json({ success: true });
  },

  superGetStats(req, res) {
    const restaurants = storage.getRestaurants();
    const items = storage.getAllMenuItems();
    const orders = storage.getAllOrders();
    res.json({
      success: true,
      totalRestaurants: restaurants.length,
      totalMenuItems: items.length,
      totalOrders: orders.length
    });
  }
};

module.exports = restaurantController;
