const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurant.controller');
const orderController = require('../controllers/order.controller');
const leadController = require('../controllers/lead.controller');
const { leadLimiter } = require('../middlewares/rateLimiter.middleware');

router.get('/restaurants', restaurantController.getPublicRestaurants);
router.get('/stats', restaurantController.getPublicStats);
router.get('/qr-codes/:restaurantId', orderController.getPublicSingleQR);
router.post('/leads', leadLimiter, leadController.createLead);

module.exports = router;
