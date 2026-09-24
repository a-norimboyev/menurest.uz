const storage = require('../services/storage.service');
const socketService = require('../services/socket.service');

const kdsController = {
  getKdsOrders(req, res) {
    const slug = req.params.slug.toLowerCase();
    const restaurant = storage.getRestaurantBySlug(slug);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });

    const orders = storage.getOrders(restaurant.id)
      .filter(o => o.type !== 'call_waiter' && o.type !== 'bill_request' && o.status !== 'cancelled');

    res.json({
      success: true,
      restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug, logo: restaurant.logo },
      orders
    });
  },

  updateKdsOrderStatus(req, res) {
    const { status, reason } = req.body;
    const order = storage.updateOrderStatus(req.params.id, status, reason);
    if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });

    socketService.emitToRestaurant(order.restaurantId, 'order:status_updated', order);
    socketService.emitToKitchen(order.restaurantId, 'order:status_updated', order);
    socketService.emitToTable(order.restaurantId, order.tableNumber, 'order:status_updated', order);

    res.json({ success: true, order });
  }
};

module.exports = kdsController;
