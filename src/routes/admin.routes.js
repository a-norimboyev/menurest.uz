const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const restaurantController = require('../controllers/restaurant.controller');
const categoryController = require('../controllers/category.controller');
const menuController = require('../controllers/menu.controller');
const orderController = require('../controllers/order.controller');
const reviewController = require('../controllers/review.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticateToken, requireRestaurantAccess, requireRoles } = require('../middlewares/auth.middleware');
const { loginLimiter } = require('../middlewares/rateLimiter.middleware');

// Kirish (Login)
router.post('/login', loginLimiter, authController.adminLogin);

// Restoran profili
router.get('/restaurant/:id', authenticateToken, requireRestaurantAccess, restaurantController.getRestaurantById);
router.put('/restaurant/:id', authenticateToken, requireRestaurantAccess, requireRoles('boss', 'manager'), upload.fields([
  { name: 'logoFile', maxCount: 1 },
  { name: 'bannerFile', maxCount: 1 },
  { name: 'ownerAvatarFile', maxCount: 1 }
]), restaurantController.updateRestaurant);

// Kategoriyalar
router.get('/categories/:restaurantId', authenticateToken, requireRestaurantAccess, categoryController.getCategories);
router.post('/categories', authenticateToken, requireRestaurantAccess, requireRoles('boss', 'manager'), categoryController.createCategory);
router.put('/categories/:id', authenticateToken, requireRoles('boss', 'manager'), categoryController.updateCategory);
router.post('/categories/reorder', authenticateToken, requireRoles('boss', 'manager'), categoryController.reorderCategories);
router.patch('/categories/:id/toggle-status', authenticateToken, requireRoles('boss', 'manager'), categoryController.toggleStatus);
router.delete('/categories/:id', authenticateToken, requireRoles('boss', 'manager'), categoryController.deleteCategory);

// Menyu
router.get('/menu/:restaurantId', authenticateToken, requireRestaurantAccess, menuController.getMenu);
router.post('/menu', authenticateToken, requireRestaurantAccess, requireRoles('boss', 'manager'), upload.single('imageFile'), menuController.createMenuItem);
router.put('/menu/:id', authenticateToken, requireRoles('boss', 'manager'), upload.single('imageFile'), menuController.updateMenuItem);
router.patch('/menu/:id/toggle-availability', authenticateToken, menuController.toggleAvailability);
router.delete('/menu/:id', authenticateToken, requireRoles('boss', 'manager'), menuController.deleteMenuItem);

// Buyurtmalar / Tashriflar
router.get('/orders/:restaurantId', authenticateToken, requireRestaurantAccess, orderController.adminGetOrders);
router.get('/visits/:restaurantId/active', authenticateToken, requireRestaurantAccess, orderController.adminGetActiveVisits);
router.put('/orders/:id/status', authenticateToken, orderController.adminUpdateStatus);
router.post('/orders/:id/pay', authenticateToken, requireRoles('boss', 'manager', 'cashier'), orderController.adminPayOrder);
router.post('/visits/:id/pay', authenticateToken, requireRoles('boss', 'manager', 'cashier'), orderController.adminPayVisit);
router.post('/visits/:id/close', authenticateToken, requireRoles('boss', 'manager', 'cashier', 'waiter'), orderController.adminCloseVisit);
router.post('/tables/:id/clean', authenticateToken, requireRoles('boss', 'manager', 'cashier', 'waiter'), orderController.adminCleanTable);
router.get('/cashier/smena-hisoboti/:restaurantId', authenticateToken, requireRestaurantAccess, requireRoles('boss', 'manager', 'cashier'), orderController.adminGetZReport);
router.post('/orders/:id/acknowledge-call', authenticateToken, orderController.adminAcknowledgeCall);

// Statistika va Analitika
router.get('/boss/stats/:restaurantId', authenticateToken, requireRestaurantAccess, requireRoles('boss', 'manager'), orderController.adminGetBossStats);
router.get('/boss/analytics/:restaurantId', authenticateToken, requireRestaurantAccess, requireRoles('boss', 'manager'), orderController.adminGetBossAnalytics);

// QR Kodlar
router.get('/qr-codes/:restaurantId', authenticateToken, requireRestaurantAccess, orderController.adminGetQR);

// Sharhlar
router.get('/reviews/:restaurantId', authenticateToken, requireRestaurantAccess, reviewController.getReviews);

module.exports = router;
