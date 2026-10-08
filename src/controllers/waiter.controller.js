const prisma = require('../services/db.service');
const socketService = require('../services/socket.service');

exports.getDashboard = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;

    const tables = await prisma.table.findMany({
      where: { restaurantId },
      include: { visits: { where: { status: 'ACTIVE' } } }
    });

    const activeVisits = await prisma.visit.findMany({
      where: { restaurantId, status: 'ACTIVE' }
    });
    
    const visitIds = activeVisits.map(v => v.id);

    const calls = await prisma.order.findMany({
      where: {
        restaurantId,
        visitId: { in: visitIds },
        type: { in: ['CALL_WAITER', 'BILL_REQUEST'] },
        status: 'NEW'
      }
    });

    const readyItems = await prisma.orderItem.findMany({
      where: {
        order: { restaurantId, visitId: { in: visitIds } },
        status: 'READY'
      },
      include: { order: true }
    });

    res.json({
      success: true,
      tables,
      calls,
      readyItems
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.acknowledgeCall = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ success: false, message: "Topilmadi" });
    if (order.status !== 'NEW') {
      return res.json({ success: true, order }); // Already acknowledged
    }

    // Since it's just a call, "delivering" it means acknowledging and freeing activeCallKey
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        activeCallKey: null,
        note: (order.note || '') + ' (Qabul qilindi)'
      }
    });

    socketService.emitToRestaurant(order.restaurantId, 'waiter:acknowledged', updated);

    res.json({ success: true, order: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deliverItem = async (req, res) => {
  try {
    const itemId = req.params.id;
    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { order: true }
    });
    if (!item) return res.status(404).json({ success: false, message: "Topilmadi" });

    const updated = await prisma.orderItem.update({
      where: { id: itemId },
      data: { status: 'DELIVERED' }
    });

    // Check if all items in order are delivered, if so update order
    const pendingItems = await prisma.orderItem.count({
      where: { orderId: item.orderId, status: { not: 'DELIVERED' } }
    });

    if (pendingItems === 0) {
      const updatedOrder = await prisma.order.update({
        where: { id: item.orderId },
        data: { status: 'DELIVERED' }
      });
      socketService.emitToTable(updatedOrder.restaurantId, updatedOrder.tableNumber, 'order:status_updated', updatedOrder);
    }

    res.json({ success: true, item: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.cleanTable = async (req, res) => {
  try {
    const tableId = req.params.id;
    const table = await prisma.table.update({
      where: { id: tableId },
      data: { status: 'FREE' }
    });
    socketService.emitToRestaurant(table.restaurantId, 'table:status_updated', table);
    res.json({ success: true, message: `Stol ${table.tableNumber} tozalandi va FREE holatiga o'tkazildi`, table });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
