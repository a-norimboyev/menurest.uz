const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const storage = require('../services/storage.service');

const authController = {
  adminLogin(req, res) {
    const { slug, username, password, role } = req.body;
    const identifier = (slug || username || '').trim();
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Restoran identifikatori va parol kiritilishi shart" });
    }

    const restaurant = storage.getRestaurantBySlug(identifier) ||
      storage.getRestaurants().find(r => r.id === identifier || r.slug.toLowerCase() === identifier.toLowerCase() || r.slug.startsWith(identifier.toLowerCase()));

    if (!restaurant || !storage.verifyPassword(password, restaurant.password)) {
      return res.status(401).json({ success: false, message: "Restoran identifikatori yoki parol noto'g'ri" });
    }

    const userRole = role || 'manager';
    const token = jwt.sign({
      role: userRole,
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
      restaurantName: restaurant.name
    }, JWT_SECRET, { expiresIn: '7d' });

    const safeRestaurant = { ...restaurant };
    delete safeRestaurant.password;

    res.json({
      success: true,
      token,
      role: userRole,
      restaurant: safeRestaurant
    });
  },

  superLogin(req, res) {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Login va parol kiritilishi shart" });
    }

    if (!storage.verifySuperAdmin(username, password)) {
      return res.status(401).json({ success: false, message: "Login yoki parol noto'g'ri" });
    }

    const token = jwt.sign({
      role: 'super_admin',
      username
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: { username, role: 'super_admin' }
    });
  }
};

module.exports = authController;
