const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const restaurantController = require('../controllers/restaurant.controller');
const leadController = require('../controllers/lead.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticateToken, requireSuperAdmin } = require('../middlewares/auth.middleware');
const { loginLimiter } = require('../middlewares/rateLimiter.middleware');

// Super Admin Login
router.post('/login', loginLimiter, authController.superLogin);

// Restoranlar boshqaruvi
router.get('/restaurants', authenticateToken, requireSuperAdmin, restaurantController.superGetRestaurants);
router.post('/restaurants', authenticateToken, requireSuperAdmin, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), restaurantController.superCreateRestaurant);
router.put('/restaurants/:id', authenticateToken, requireSuperAdmin, restaurantController.superUpdateRestaurant);
router.delete('/restaurants/:id', authenticateToken, requireSuperAdmin, restaurantController.superDeleteRestaurant);

// Platforma statistikasi va arizalar
router.get('/stats', authenticateToken, requireSuperAdmin, restaurantController.superGetStats);
router.get('/leads', authenticateToken, requireSuperAdmin, leadController.getLeads);

module.exports = router;
