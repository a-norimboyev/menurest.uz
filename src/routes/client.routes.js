const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurant.controller');
const orderController = require('../controllers/order.controller');
const reviewController = require('../controllers/review.controller');
const { orderLimiter } = require('../middlewares/rateLimiter.middleware');

router.get('/:slug', restaurantController.getClientMenu);
router.post('/:slug/order', orderLimiter, orderController.clientCreateOrder);
router.post('/:slug/call-waiter', orderLimiter, orderController.clientCallWaiter);
router.get('/:slug/table-orders/:tableNumber', orderController.clientGetTableOrders);
router.post('/:slug/online-pay', orderLimiter, orderController.clientOnlinePay);
router.post('/:slug/review', orderLimiter, reviewController.createReview);

module.exports = router;
