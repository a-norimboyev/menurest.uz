const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { JWT_SECRET } = require('../config/constants');
const prisma = require('../services/db.service');

const authController = {
  async adminLogin(req, res) {
    try {
      const { slug, username, password, role } = req.body;
      const identifier = (slug || username || '').trim();
      if (!identifier || !password) {
        return res.status(400).json({ success: false, message: "Restoran identifikatori va parol kiritilishi shart" });
      }

      // First check if it is a user
      let user = await prisma.user.findFirst({
        where: { username: identifier },
        include: { restaurant: true }
      });
      
      let restaurant = null;
      let userRole = role || 'MANAGER';

      if (user) {
        if (!user.isActive) {
          return res.status(403).json({ success: false, message: "Foydalanuvchi bloklangan" });
        }
        if (!bcrypt.compareSync(password, user.passwordHash)) {
          return res.status(401).json({ success: false, message: "Parol noto'g'ri" });
        }
        restaurant = user.restaurant;
        userRole = user.role;
      } else {
        // Fallback to searching restaurant directly (for old users before migration where boss_slug was created)
        restaurant = await prisma.restaurant.findFirst({
          where: {
            OR: [
              { id: identifier },
              { slug: identifier.toLowerCase() }
            ]
          }
        });

        if (!restaurant) {
          return res.status(401).json({ success: false, message: "Restoran yoki foydalanuvchi topilmadi" });
        }
        
        // Find boss user for this restaurant
        user = await prisma.user.findFirst({
          where: { restaurantId: restaurant.id, role: 'BOSS' }
        });

        if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
          return res.status(401).json({ success: false, message: "Parol noto'g'ri" });
        }
        userRole = 'BOSS';
      }

      const token = jwt.sign({
        userId: user.id,
        role: userRole,
        restaurantId: restaurant.id,
        restaurantSlug: restaurant.slug,
        restaurantName: restaurant.name
      }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        success: true,
        token,
        role: userRole,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          logo: restaurant.logo
        },
        user: {
          id: user.id,
          username: user.username,
          name: user.name
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server xatosi' });
    }
  },

  async superLogin(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ success: false, message: "Login va parol kiritilishi shart" });
      }

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user || user.role !== 'SUPER_ADMIN' || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).json({ success: false, message: "Login yoki parol noto'g'ri" });
      }

      const token = jwt.sign({
        userId: user.id,
        role: 'SUPER_ADMIN',
        username: user.username
      }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        success: true,
        token,
        user: { username, role: 'SUPER_ADMIN' }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server xatosi' });
    }
  }
};

module.exports = authController;
