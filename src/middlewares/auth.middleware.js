const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Autentifikatsiya talab qilinadi (Token yo'q)" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: "Yaroqsiz yoki muddati o'tgan token" });
    }
    req.user = user;
    next();
  });
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: "Ushbu amal faqat Super Admin uchun ruxsat etilgan" });
  }
  next();
}

function requireRestaurantAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Avtorizatsiya talab qilinadi" });
  }
  if (req.user.role === 'super_admin') {
    return next();
  }
  const restaurantId = req.params.restaurantId || req.params.id || req.body.restaurantId;
  if (restaurantId && req.user.restaurantId !== restaurantId) {
    return res.status(403).json({ success: false, message: "Boshqa restoranning ma'lumotlariga ruxsat yo'q" });
  }
  next();
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Avtorizatsiya talab qilinadi" });
    }
    if (req.user.role === 'super_admin') return next();
    if (allowedRoles.includes(req.user.role)) return next();
    return res.status(403).json({ success: false, message: "Ushbu bo'lim uchun ruxsatingiz yetarli emas" });
  };
}

module.exports = {
  authenticateToken,
  requireSuperAdmin,
  requireRestaurantAccess,
  requireRoles
};
