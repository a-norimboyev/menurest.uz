const express = require('express');
const router = express.Router();
const waiterController = require('../controllers/waiter.controller');
const { authenticateToken, requireRoles } = require('../middlewares/auth.middleware');

router.use(authenticateToken);
router.use(requireRoles('WAITER', 'MANAGER', 'BOSS', 'SUPER_ADMIN'));

router.get('/dashboard', waiterController.getDashboard);
router.post('/calls/:id/acknowledge', waiterController.acknowledgeCall);
router.post('/items/:id/deliver', waiterController.deliverItem);
router.post('/tables/:id/clean', waiterController.cleanTable);

module.exports = router;
