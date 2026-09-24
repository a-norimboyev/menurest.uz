const express = require('express');
const router = express.Router();
const kdsController = require('../controllers/kds.controller');

router.get('/orders/:slug', kdsController.getKdsOrders);
router.put('/orders/:id/status', kdsController.updateKdsOrderStatus);

module.exports = router;
