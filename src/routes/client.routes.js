const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurant.controller');
const orderController = require('../controllers/order.controller');
const reviewController = require('../controllers/review.controller');
const visitController = require('../controllers/visit.controller');
const { orderLimiter } = require('../middlewares/rateLimiter.middleware');
const { authenticateClient } = require('../middlewares/clientAuth.middleware');

router.post('/join', visitController.joinVisit);

router.get('/:slug', restaurantController.getClientMenu);
router.post('/:slug/order', orderLimiter, authenticateClient, orderController.clientCreateOrder);
router.post('/:slug/call-waiter', orderLimiter, authenticateClient, orderController.clientCallWaiter);
router.get('/:slug/table-orders/:tableNumber', orderController.clientGetTableOrders);

router.post('/:slug/review', orderLimiter, reviewController.createReview);

module.exports = router;
