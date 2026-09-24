const QRCode = require('qrcode');
const storage = require('../services/storage.service');
const socketService = require('../services/socket.service');

const orderController = {
  // === MIJOZLAR ===
  clientCreateOrder(req, res) {
    const slug = req.params.slug.toLowerCase();
    const restaurant = storage.getRestaurantBySlug(slug);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
    }

    const { tableNumber, items, subtotal, serviceFee, totalPrice, note, type } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Savatcha bo'sh" });
    }

    const order = storage.createOrder({
      restaurantId: restaurant.id,
      tableNumber: Number(tableNumber) || 1,
      items,
      subtotal,
      serviceFee,
      totalPrice,
      note,
      type: type || 'order'
    });

    // Real-time bildirishnomalar
    socketService.emitToRestaurant(restaurant.id, 'order:new', order);
    socketService.emitToKitchen(restaurant.id, 'order:new', order);
    socketService.emitToTable(restaurant.id, order.tableNumber, 'order:created', order);

    res.json({ success: true, order });
  },

  clientCallWaiter(req, res) {
    const slug = req.params.slug.toLowerCase();
    const restaurant = storage.getRestaurantBySlug(slug);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
    }

    const { tableNumber, callType } = req.body;
    const callOrder = storage.createOrder({
      restaurantId: restaurant.id,
      tableNumber: Number(tableNumber) || 1,
      items: [],
      subtotal: 0,
      serviceFee: 0,
      totalPrice: 0,
      type: callType === 'bill' ? 'bill_request' : 'call_waiter',
      note: callType === 'bill' ? "Mijoz hisobni so'ramoqda" : "Mijoz ofitsiantni chaqirmoqda"
    });

    socketService.emitToRestaurant(restaurant.id, 'waiter:call', callOrder);
    res.json({ success: true, message: "Xabar ofitsiantga yetkazildi", order: callOrder });
  },

  clientGetTableOrders(req, res) {
    const slug = req.params.slug.toLowerCase();
    const restaurant = storage.getRestaurantBySlug(slug);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
    }

    const tableNumber = Number(req.params.tableNumber);
    const activeOrders = storage.getTableOrders(restaurant.id, tableNumber);
    const totalAmount = activeOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    res.json({
      success: true,
      tableNumber,
      activeOrders,
      totalAmount
    });
  },

  clientOnlinePay(req, res) {
    const slug = req.params.slug.toLowerCase();
    const restaurant = storage.getRestaurantBySlug(slug);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
    }

    const { tableNumber, paymentMethod } = req.body;
    const activeOrders = storage.getTableOrders(restaurant.id, Number(tableNumber));

    if (activeOrders.length === 0) {
      return res.status(400).json({ success: false, message: "To'lanishi kerak bo'lgan faol buyurtma topilmadi" });
    }

    const paidOrders = [];
    activeOrders.forEach(o => {
      const paid = storage.payOrder(o.id, {
        paymentMethod: paymentMethod || 'click',
        discountPercent: 0,
        cashierName: 'Online POS'
      });
      if (paid) paidOrders.push(paid);
    });

    socketService.emitToRestaurant(restaurant.id, 'orders:paid', { tableNumber, paidOrders });
    socketService.emitToTable(restaurant.id, tableNumber, 'orders:paid', { paidOrders });

    res.json({
      success: true,
      message: "To'lov muvaffaqiyatli qabul qilindi",
      paidOrders,
      receiptId: paidOrders[0]?.receiptId
    });
  },

  // === ADMIN ===
  adminGetOrders(req, res) {
    const orders = storage.getOrders(req.params.restaurantId);
    res.json({ success: true, orders });
  },

  adminUpdateStatus(req, res) {
    const { status, reason } = req.body;
    const order = storage.updateOrderStatus(req.params.id, status, reason);
    if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });

    socketService.emitToRestaurant(order.restaurantId, 'order:status_updated', order);
    socketService.emitToKitchen(order.restaurantId, 'order:status_updated', order);
    socketService.emitToTable(order.restaurantId, order.tableNumber, 'order:status_updated', order);

    res.json({ success: true, order });
  },

  adminPayOrder(req, res) {
    const { paymentMethod, discountPercent, receivedAmount, cashierName } = req.body;
    const order = storage.payOrder(req.params.id, {
      paymentMethod: paymentMethod || 'cash',
      discountPercent: Number(discountPercent) || 0,
      receivedAmount: Number(receivedAmount) || 0,
      cashierName: cashierName || 'Kassir'
    });
    if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });

    socketService.emitToRestaurant(order.restaurantId, 'order:paid', order);
    socketService.emitToTable(order.restaurantId, order.tableNumber, 'order:paid', order);

    res.json({ success: true, order });
  },

  adminGetZReport(req, res) {
    const report = storage.getZReport(req.params.restaurantId);
    res.json({ success: true, report });
  },

  adminAcknowledgeCall(req, res) {
    const { waiterName } = req.body;
    const order = storage.acknowledgeCall(req.params.id, waiterName || 'Ofitsiant');
    if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });

    socketService.emitToRestaurant(order.restaurantId, 'waiter:acknowledged', order);
    res.json({ success: true, order });
  },

  adminGetBossStats(req, res) {
    const period = req.query.period || 'today';
    const stats = storage.getBossStats(req.params.restaurantId, period);
    res.json({ success: true, stats });
  },

  adminGetBossAnalytics(req, res) {
    const analytics = storage.getBossAnalytics(req.params.restaurantId, req.query);
    res.json({ success: true, analytics });
  },

  async adminGetQR(req, res) {
    try {
      const restaurant = storage.getRestaurantById(req.params.restaurantId);
      if (!restaurant) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });

      const host = req.get('host');
      const protocol = req.protocol;
      const baseUrl = `${protocol}://${host}`;

      const tablesCount = restaurant.tablesCount || 10;
      const promises = [];

      for (let i = 1; i <= tablesCount; i++) {
        const targetUrl = `${baseUrl}/r/${restaurant.slug}?table=${i}`;
        promises.push(
          QRCode.toDataURL(targetUrl, {
            width: 300,
            margin: 2,
            color: { dark: '#1e293b', light: '#ffffff' }
          }).then(qrDataUrl => ({
            tableNumber: i,
            targetUrl,
            qrDataUrl
          }))
        );
      }

      const qrList = await Promise.all(promises);

      res.json({
        success: true,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          logo: restaurant.logo
        },
        qrCodes: qrList
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getPublicSingleQR(req, res) {
    try {
      const restaurant = storage.getRestaurantById(req.params.restaurantId);
      if (!restaurant) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });

      const host = req.get('host');
      const protocol = req.protocol;
      const baseUrl = `${protocol}://${host}`;
      const targetUrl = `${baseUrl}/r/${restaurant.slug}?table=1`;

      const qrDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' }
      });

      res.json({
        success: true,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          logo: restaurant.logo
        },
        qrCodes: [{
          tableNumber: 1,
          targetUrl,
          qrDataUrl
        }]
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = orderController;
