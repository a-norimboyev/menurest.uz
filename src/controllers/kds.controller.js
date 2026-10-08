const prisma = require('../services/db.service');
const socketService = require('../services/socket.service');

const kdsController = {
  async getKdsOrders(req, res) {
    try {
      const slug = req.params.slug.toLowerCase();
      const restaurant = await prisma.restaurant.findUnique({
        where: { slug }
      });
      if (!restaurant) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });

      const orders = await prisma.order.findMany({
        where: {
          restaurantId: restaurant.id,
          type: { notIn: ['call_waiter', 'bill_request'] },
          status: { not: 'cancelled' }
        },
        include: {
          items: true,
          visit: {
            include: {
              table: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Map it to have tableNumber and other flat fields if needed
      const mappedOrders = orders.map(o => ({
        ...o,
        tableNumber: o.visit?.table?.tableNumber,
        subtotal: Number(o.subtotal),
        serviceFeeAmount: Number(o.serviceFeeAmount),
        totalAmount: Number(o.totalAmount),
        totalPrice: Number(o.totalAmount) // map for frontend
      }));

      res.json({
        success: true,
        restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug, logo: restaurant.logo },
        orders: mappedOrders
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateKdsOrderStatus(req, res) {
    try {
      const { status, reason } = req.body;
      const { id } = req.params;

      const orderData = { status };
      if (reason) orderData.cancellationNote = reason;

      const order = await prisma.order.update({
        where: { id },
        data: orderData,
        include: {
          items: true,
          visit: {
            include: { table: true }
          }
        }
      });

      if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });

      const mappedOrder = {
        ...order,
        tableNumber: order.visit?.table?.tableNumber,
        subtotal: Number(order.subtotal),
        serviceFeeAmount: Number(order.serviceFeeAmount),
        totalAmount: Number(order.totalAmount),
        totalPrice: Number(order.totalAmount) // map for frontend
      };

      socketService.emitToRestaurant(mappedOrder.restaurantId, 'order:status_updated', mappedOrder);
      socketService.emitToKitchen(mappedOrder.restaurantId, 'order:status_updated', mappedOrder);
      if (mappedOrder.tableNumber) {
        socketService.emitToTable(mappedOrder.restaurantId, mappedOrder.tableNumber, 'order:status_updated', mappedOrder);
      }

      res.json({ success: true, order: mappedOrder });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = kdsController;
