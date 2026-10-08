const QRCode = require('qrcode');
const prisma = require('../services/db.service');
const socketService = require('../services/socket.service');

// Concurrency mutex for visit payments
const visitPaymentLocks = new Map();
async function withVisitPaymentLock(visitId, fn) {
  while (visitPaymentLocks.has(visitId)) {
    await visitPaymentLocks.get(visitId);
  }
  let resolveLock;
  const lockPromise = new Promise(resolve => { resolveLock = resolve; });
  visitPaymentLocks.set(visitId, lockPromise);
  try {
    return await fn();
  } finally {
    visitPaymentLocks.delete(visitId);
    resolveLock();
  }
}

// Deep content comparison helper for order idempotency
function areOrdersContentEqual(orderInDb, reqItems, reqSubtotal, reqNote) {
  if (Math.abs(Number(orderInDb.subtotal) - Number(reqSubtotal)) > 0.001) return false;

  const dbNote = (orderInDb.note || '').trim();
  const reqN = (reqNote || '').trim();
  if (dbNote !== reqN) return false;

  const dbItems = orderInDb.items || [];
  if (dbItems.length !== (reqItems || []).length) return false;

  const normDb = dbItems.map(it => ({
    key: (it.menuItemId || it.name || '').trim(),
    name: (it.name || '').trim(),
    price: Math.round(Number(it.price)),
    quantity: Number(it.quantity)
  })).sort((a, b) => a.key.localeCompare(b.key) || a.name.localeCompare(b.name));

  const normReq = (reqItems || []).map(it => ({
    key: (it.id || it.menuItemId || it.name || '').trim(),
    name: (it.name || '').trim(),
    price: Math.round(Number(it.price)),
    quantity: Number(it.quantity)
  })).sort((a, b) => a.key.localeCompare(b.key) || a.name.localeCompare(b.name));

  for (let i = 0; i < normDb.length; i++) {
    const a = normDb[i];
    const b = normReq[i];
    if (a.key !== b.key && a.name !== b.name) return false;
    if (a.quantity !== b.quantity) return false;
    if (a.price !== b.price) return false;
  }

  return true;
}

// Helper to get or create table/visit
async function getOrCreateVisit(restaurantId, tableNumber) {
  const num = Number(tableNumber) || 1;
  let table = await prisma.table.findFirst({
    where: { restaurantId, tableNumber: num }
  });
  if (!table) {
    table = await prisma.table.create({
      data: { restaurantId, tableNumber: num, capacity: 4, status: 'OCCUPIED' }
    });
  }
  let visit = await prisma.visit.findFirst({
    where: { tableId: table.id, status: 'ACTIVE' }
  });
  if (!visit) {
    visit = await prisma.visit.create({
      data: { restaurantId, tableId: table.id, status: 'ACTIVE' }
    });
    await prisma.table.update({ where: { id: table.id }, data: { status: 'OCCUPIED' } });
  }
  return visit;
}

const orderController = {
  // === MIJOZLAR ===
  async clientCreateOrder(req, res) {
    try {
      const slug = req.params.slug.toLowerCase();
      const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
      if (!restaurant) {
        return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
      }

      const { tableNumber, items, subtotal, serviceFee, totalPrice, note, type, idempotencyKey } = req.body;
      const { visitId } = req.clientVisit;
      
      if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: "Savatcha bo'sh" });
      }

      const visit = await prisma.visit.findFirst({
        where: { id: visitId, restaurantId: restaurant.id, status: 'ACTIVE' },
        include: { table: true }
      });
      if (!visit) {
        return res.status(403).json({ success: false, message: 'Tashrif topilmadi yoki yopilgan. Iltimos yangidan ulaning.' });
      }

      // Idempotency check with full content verification & authorization
      if (idempotencyKey) {
        const duplicateOrder = await prisma.order.findUnique({
          where: { idempotencyKey },
          include: { items: true, visit: { include: { table: true } } }
        });
        
        if (duplicateOrder) {
          if (duplicateOrder.restaurantId !== restaurant.id || duplicateOrder.visitId !== visit.id) {
            return res.status(403).json({ success: false, message: "Ruxsat yo'q: Bu idempotency kaliti boshqa tashrifga tegishli." });
          }

          const isSameContent = areOrdersContentEqual(duplicateOrder, items, subtotal, note);
          if (!isSameContent) {
            return res.status(409).json({
              success: false,
              message: "Konflikt (409): Ushbu idempotency kaliti bilan boshqa mazmundagi buyurtma aniqlandi. Har bir yangi buyurtma uchun yangi kalit ishlating."
            });
          }

          const mappedDuplicate = {
            ...duplicateOrder,
            tableNumber: duplicateOrder.visit.table.tableNumber,
            totalPrice: Number(duplicateOrder.totalAmount),
            subtotal: Number(duplicateOrder.subtotal),
            serviceFee: Number(duplicateOrder.serviceFeeAmount)
          };
          return res.json({ success: true, message: "Takroriy so'rov, buyurtma avval qabul qilingan", order: mappedDuplicate });
        }
      }

      const orderNumber = Math.floor(100 + Math.random() * 900);
      let order;
      try {
        order = await prisma.order.create({
          data: {
            restaurantId: restaurant.id,
            visitId: visit.id,
            orderNumber,
            status: 'NEW',
            type: type || 'ORDER',
            note: note || '',
            subtotal: Number(subtotal) || 0,
            serviceFeeAmount: Number(serviceFee) || 0,
            totalAmount: Number(totalPrice) || 0,
            idempotencyKey: idempotencyKey || null,
            items: {
              create: items.map(i => ({
                name: i.name,
                price: Number(i.price),
                quantity: Number(i.quantity),
                menuItemId: i.id || null
              }))
            }
          },
          include: { items: true, visit: { include: { table: true } } }
        });
      } catch (createErr) {
        if (createErr.code === 'P2002' && createErr.meta?.target?.includes('idempotencyKey')) {
          // Parallel race condition: existing order was committed concurrently
          const existingOrder = await prisma.order.findUnique({
            where: { idempotencyKey },
            include: { items: true, visit: { include: { table: true } } }
          });

          if (existingOrder) {
            if (existingOrder.restaurantId !== restaurant.id || existingOrder.visitId !== visit.id) {
              return res.status(403).json({ success: false, message: "Ruxsat yo'q: Ushbu idempotency kaliti boshqa tashrifga tegishli." });
            }

            const isSameContent = areOrdersContentEqual(existingOrder, items, subtotal, note);
            if (!isSameContent) {
              return res.status(409).json({
                success: false,
                message: "Konflikt (409): Ushbu idempotency kaliti bilan boshqa mazmundagi buyurtma parallel yaratilgan."
              });
            }

            const mappedExisting = {
              ...existingOrder,
              tableNumber: existingOrder.visit.table.tableNumber,
              totalPrice: Number(existingOrder.totalAmount),
              subtotal: Number(existingOrder.subtotal),
              serviceFee: Number(existingOrder.serviceFeeAmount)
            };
            return res.json({ success: true, message: "Takroriy so'rov (Parallel commit), buyurtma qabul qilingan", order: mappedExisting });
          }
        }
        throw createErr;
      }

      const mappedOrder = {
        ...order,
        id: order.id,
        tableNumber: order.visit.table.tableNumber,
        subtotal: Number(order.subtotal),
        serviceFee: Number(order.serviceFeeAmount),
        totalPrice: Number(order.totalAmount),
        items: order.items.map(it => ({ ...it, price: Number(it.price) }))
      };

      socketService.emitToRestaurant(restaurant.id, 'order:new', mappedOrder);
      socketService.emitToKitchen(restaurant.id, 'order:new', mappedOrder);
      socketService.emitToTable(restaurant.id, mappedOrder.tableNumber, 'order:created', mappedOrder);

      res.json({ success: true, order: mappedOrder });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async clientCallWaiter(req, res) {
    try {
      const slug = req.params.slug.toLowerCase();
      const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
      if (!restaurant) {
        return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
      }

      const { tableNumber, callType, idempotencyKey } = req.body;
      const { visitId } = req.clientVisit;

      const visit = await prisma.visit.findFirst({
        where: { id: visitId, restaurantId: restaurant.id, status: 'ACTIVE' },
        include: { table: true }
      });
      if (!visit) {
        return res.status(403).json({ success: false, message: 'Tashrif topilmadi yoki yopilgan. Iltimos yangidan ulaning.' });
      }

      const activeCallType = callType === 'bill' ? 'BILL_REQUEST' : 'CALL_WAITER';
      const activeCallKey = `${visit.id}_${activeCallType}`;

      // 1. Check if active call already exists
      const existingCall = await prisma.order.findUnique({
        where: { activeCallKey },
        include: { visit: { include: { table: true } } }
      });

      if (existingCall) {
        const mappedOrder = { ...existingCall, tableNumber: existingCall.visit.table.tableNumber };
        return res.json({
          success: true,
          message: "Sizning xabaringiz tizimda faol (Takroriy so'rov)",
          order: mappedOrder
        });
      }

      // 2. Atomic creation: activeCallKey has a UNIQUE constraint in DB
      const orderNumber = Math.floor(100 + Math.random() * 900);
      let callOrder;
      try {
        callOrder = await prisma.order.create({
          data: {
            restaurantId: restaurant.id,
            visitId: visit.id,
            orderNumber,
            status: 'NEW',
            type: activeCallType,
            activeCallKey: activeCallKey,
            note: callType === 'bill' ? "Mijoz hisobni so'ramoqda" : "Mijoz ofitsiantni chaqirmoqda",
            idempotencyKey: idempotencyKey || null
          },
          include: { visit: { include: { table: true } } }
        });
      } catch (createErr) {
        if (createErr.code === 'P2002' && (createErr.meta?.target?.includes('activeCallKey') || createErr.meta?.target?.includes('idempotencyKey'))) {
          const parallelCall = await prisma.order.findUnique({
            where: { activeCallKey },
            include: { visit: { include: { table: true } } }
          });
          if (parallelCall) {
            const mappedParallel = { ...parallelCall, tableNumber: parallelCall.visit.table.tableNumber };
            return res.json({
              success: true,
              message: "Sizning xabaringiz tizimda faol (Parallel qabul qilindi)",
              order: mappedParallel
            });
          }
        }
        throw createErr;
      }

      const mappedOrder = { ...callOrder, tableNumber: callOrder.visit.table.tableNumber };
      socketService.emitToRestaurant(restaurant.id, 'waiter:call', mappedOrder);
      res.json({ success: true, message: "Xabar ofitsiantga yetkazildi", order: mappedOrder });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async clientGetTableOrders(req, res) {
    try {
      const slug = req.params.slug.toLowerCase();
      const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
      if (!restaurant) {
        return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
      }

      const tableNumber = Number(req.params.tableNumber);
      const table = await prisma.table.findFirst({ where: { restaurantId: restaurant.id, tableNumber } });
      
      let activeOrders = [];
      if (table) {
        const visit = await prisma.visit.findFirst({ where: { tableId: table.id, status: 'ACTIVE' } });
        if (visit) {
          const orders = await prisma.order.findMany({
            where: { visitId: visit.id, status: { notIn: ['CANCELLED'] }, type: 'ORDER' },
            include: { items: true }
          });
          activeOrders = orders.map(o => ({
            ...o,
            totalPrice: Number(o.totalAmount),
            items: o.items.map(it => ({ ...it, price: Number(it.price) }))
          }));
        }
      }
      
      const totalAmount = activeOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
      res.json({ success: true, tableNumber, activeOrders, totalAmount });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // === ADMIN ===
  async adminGetOrders(req, res) {
    try {
      const orders = await prisma.order.findMany({
        where: { restaurantId: req.params.restaurantId },
        include: { items: true, visit: { include: { table: true } } },
        orderBy: { createdAt: 'desc' }
      });
      const mappedOrders = orders.map(o => ({
        ...o,
        tableNumber: o.visit?.table?.tableNumber,
        totalPrice: Number(o.totalAmount),
        serviceFee: Number(o.serviceFeeAmount),
        subtotal: Number(o.subtotal),
        items: o.items.map(it => ({ ...it, price: Number(it.price) }))
      }));
      res.json({ success: true, orders: mappedOrders });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async adminUpdateStatus(req, res) {
    try {
      const { status, reason } = req.body;
      const data = { status };
      if (reason) data.cancellationNote = reason;
      if (['DELIVERED', 'CANCELLED'].includes(status)) {
        data.activeCallKey = null;
      }

      const order = await prisma.order.update({
        where: { id: req.params.id },
        data,
        include: { visit: { include: { table: true } } }
      });
      const mappedOrder = { ...order, tableNumber: order.visit?.table?.tableNumber };

      socketService.emitToRestaurant(order.restaurantId, 'order:status_updated', mappedOrder);
      socketService.emitToKitchen(order.restaurantId, 'order:status_updated', mappedOrder);
      if (mappedOrder.tableNumber) {
        socketService.emitToTable(order.restaurantId, mappedOrder.tableNumber, 'order:status_updated', mappedOrder);
      }

      res.json({ success: true, order: mappedOrder });
    } catch (err) {
      res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });
    }
  },

  async adminGetActiveVisits(req, res) {
    try {
      const visits = await prisma.visit.findMany({
        where: { restaurantId: req.params.restaurantId, status: 'ACTIVE' },
        include: {
          table: true,
          orders: { include: { items: true } },
          bills: { include: { payments: true } }
        }
      });
      const result = visits.map(v => {
        let grossTotal = 0;
        let items = [];
        v.orders.forEach(o => {
          if (o.status !== 'CANCELLED' && o.type === 'ORDER') {
            grossTotal += Number(o.totalAmount);
            items.push(...o.items);
          }
        });

        let totalPaid = 0;
        v.bills.forEach(b => {
          (b.payments || []).forEach(p => {
            totalPaid += Number(p.amount);
          });
        });

        const remaining = Math.max(0, grossTotal - totalPaid);
        const isPaid = grossTotal > 0 && remaining === 0;

        return {
          id: v.id,
          tableNumber: v.table.tableNumber,
          openedAt: v.openedAt,
          totalPrice: grossTotal,
          paidAmount: totalPaid,
          remaining: remaining,
          isPaid: isPaid,
          ordersCount: v.orders.filter(o => o.type === 'ORDER').length,
          orders: v.orders,
          items: items
        };
      });
      res.json({ success: true, visits: result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async adminPayVisit(req, res) {
    const visitId = req.params.id;
    return withVisitPaymentLock(visitId, async () => {
      try {
        const { paymentMethod, discountPercent, receivedAmount, idempotencyKey } = req.body;
        
        // Idempotency check before transaction
        if (idempotencyKey) {
          const dupPayment = await prisma.payment.findUnique({
            where: { idempotencyKey },
            include: { bill: true }
          });
          if (dupPayment) {
            return res.json({
              success: true,
              message: "To'lov allaqachon qabul qilingan (Takroriy kalit)",
              payment: dupPayment,
              bill: dupPayment.bill
            });
          }
        }

        const result = await prisma.$transaction(async (tx) => {
          const visit = await tx.visit.findUnique({
            where: { id: visitId },
            include: { table: true, orders: true, bills: { include: { payments: true } } }
          });

          if (!visit || visit.status !== 'ACTIVE') {
            const err = new Error('Ochiq tashrif topilmadi yoki allaqachon yopilgan');
            err.statusCode = 404;
            throw err;
          }

          // Calculate gross orders amount
          let grossAmount = 0;
          visit.orders.forEach(o => {
            if (o.status !== 'CANCELLED' && o.type === 'ORDER') {
              grossAmount += Number(o.totalAmount);
            }
          });

          const discountPct = Number(discountPercent) || 0;
          const discountAmount = Math.round((grossAmount * discountPct) / 100);
          const netAmount = Math.max(0, grossAmount - discountAmount);

          // Find or create bill
          let bill = visit.bills[0];
          if (!bill) {
            bill = await tx.bill.create({
              data: {
                restaurantId: visit.restaurantId,
                visitId: visit.id,
                subtotal: grossAmount,
                discountAmount: discountAmount,
                finalAmount: netAmount,
                paidAmount: 0,
                version: 0,
                status: 'UNPAID'
              },
              include: { payments: true }
            });
          }

          // Calculate existing payments
          const currentPayments = bill.payments || [];
          const alreadyPaid = currentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
          const remaining = Math.max(0, netAmount - alreadyPaid);

          // If remaining is 0 or less, reject double payment!
          if (remaining <= 0) {
            const err = new Error(`Hisob allaqachon to'liq to'langan. Yangilangan qoldiq: 0 so'm`);
            err.statusCode = 409;
            err.remaining = 0;
            throw err;
          }

          // Optimistic Concurrency check using Bill version
          const updateCount = await tx.bill.updateMany({
            where: { id: bill.id, version: bill.version },
            data: { version: { increment: 1 } }
          });

          if (updateCount.count === 0) {
            const err = new Error(`Konflikt: Boshqa kassir hisobni parallel yangiladi. Yangilangan qoldiqni tekshiring.`);
            err.statusCode = 409;
            throw err;
          }

          let reqAmount = Number(receivedAmount);
          if (isNaN(reqAmount) || reqAmount <= 0) {
            reqAmount = remaining;
          }

          let actualPayment = reqAmount;
          let changeAmount = 0;

          if (paymentMethod === 'CASH') {
            if (reqAmount > remaining) {
              actualPayment = remaining;
              changeAmount = reqAmount - remaining;
            }
          } else {
            if (reqAmount > remaining) {
              const err = new Error(`Kiritilgan summa qoldiqdan (${remaining} so'm) ko'p bo'lishi mumkin emas.`);
              err.statusCode = 400;
              throw err;
            }
          }

          // Create payment record
          const payment = await tx.payment.create({
            data: {
              restaurantId: visit.restaurantId,
              billId: bill.id,
              method: paymentMethod || 'CASH',
              amount: actualPayment,
              idempotencyKey: idempotencyKey || null
            }
          });

          const newTotalPaid = alreadyPaid + actualPayment;
          const newRemaining = Math.max(0, netAmount - newTotalPaid);
          const isFullyPaid = newRemaining === 0;

          await tx.bill.update({
            where: { id: bill.id },
            data: {
              status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
              paidAmount: newTotalPaid,
              finalAmount: netAmount,
              discountAmount: discountAmount
            }
          });

          return {
            isFullyPaid,
            remaining: newRemaining,
            paidAmount: actualPayment,
            changeAmount,
            billId: bill.id,
            paymentId: payment.id,
            tableNumber: visit.table.tableNumber,
            restaurantId: visit.restaurantId
          };
        });

        if (result.isFullyPaid) {
          socketService.emitToRestaurant(result.restaurantId, 'orders:paid', { tableNumber: result.tableNumber });
          socketService.emitToTable(result.restaurantId, result.tableNumber, 'order:paid', { tableNumber: result.tableNumber });
        }

        res.json({
          success: true,
          message: result.isFullyPaid
            ? `To'lov to'liq qabul qilindi${result.changeAmount > 0 ? ` (Qaytim: ${result.changeAmount} so'm)` : ''}`
            : `Qisman to'lov qabul qilindi (Qoldiq: ${result.remaining} so'm)`,
          remaining: result.remaining,
          paidAmount: result.paidAmount,
          changeAmount: result.changeAmount,
          isFullyPaid: result.isFullyPaid
        });
      } catch (err) {
        if (err.statusCode) {
          return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            remaining: err.remaining !== undefined ? err.remaining : undefined
          });
        }
        if (err.code === 'P2002' && err.meta?.target?.includes('idempotencyKey')) {
          return res.json({ success: true, message: "Takroriy to'lov so'rovi (Parallel lock)" });
        }
        res.status(500).json({ success: false, message: err.message });
      }
    });
  },

  async adminCloseVisit(req, res) {
    try {
      const visitId = req.params.id;
      const visit = await prisma.visit.findUnique({
        where: { id: visitId },
        include: { table: true, orders: true, bills: { include: { payments: true } } }
      });

      if (!visit) {
        return res.status(404).json({ success: false, message: "Tashrif topilmadi" });
      }

      if (visit.status !== 'ACTIVE') {
        return res.json({ success: true, message: "Tashrif allaqachon yopilgan", visit });
      }

      // Check if all orders are paid
      let grossAmount = 0;
      visit.orders.forEach(o => {
        if (o.status !== 'CANCELLED' && o.type === 'ORDER') {
          grossAmount += Number(o.totalAmount);
        }
      });

      let totalPaid = 0;
      visit.bills.forEach(b => {
        (b.payments || []).forEach(p => {
          totalPaid += Number(p.amount);
        });
      });

      const remaining = grossAmount - totalPaid;
      if (remaining > 0) {
        return res.status(400).json({
          success: false,
          message: `Tashrifni yopib bo'lmaydi: ${remaining} so'm to'lanmagan qoldiq mavjud. Avval kassa orqali to'lovni qabul qiling.`,
          remaining
        });
      }

      // Explicit staff action to close visit and mark table as DIRTY
      const closedVisit = await prisma.visit.update({
        where: { id: visitId },
        data: { status: 'CLOSED', closedAt: new Date() },
        include: { table: true }
      });

      await prisma.table.update({
        where: { id: visit.tableId },
        data: { status: 'DIRTY' }
      });

      socketService.emitToRestaurant(visit.restaurantId, 'visit:closed', {
        visitId: visit.id,
        tableNumber: visit.table.tableNumber
      });

      res.json({
        success: true,
        message: `Stol ${visit.table.tableNumber} tashrifi muvaffaqiyatli yopildi. Stol holati 'DIRTY' (tozalash kutilmoqda) ga o'tkazildi.`,
        visit: closedVisit
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async adminCleanTable(req, res) {
    try {
      const tableId = req.params.id;
      const table = await prisma.table.update({
        where: { id: tableId },
        data: { status: 'FREE' }
      });
      socketService.emitToRestaurant(table.restaurantId, 'table:status_updated', table);
      res.json({ success: true, message: `Stol ${table.tableNumber} tozalandi va FREE holatiga o'tkazildi`, table });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async adminPayOrder(req, res) {
    try {
      const { paymentMethod, discountPercent, receivedAmount } = req.body;
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { visit: { include: { table: true } } }
      });
      if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });

      let bill = await prisma.bill.findFirst({ where: { visitId: order.visitId } });
      if (!bill) {
        bill = await prisma.bill.create({
          data: {
            restaurantId: order.restaurantId,
            visitId: order.visitId,
            subtotal: Number(order.totalAmount),
            discountAmount: (Number(order.totalAmount) * (Number(discountPercent) || 0)) / 100,
            finalAmount: Number(order.totalAmount) - ((Number(order.totalAmount) * (Number(discountPercent) || 0)) / 100),
            status: 'PAID'
          }
        });
      }

      await prisma.payment.create({
        data: {
          restaurantId: order.restaurantId,
          billId: bill.id,
          method: paymentMethod || 'CASH',
          amount: Number(receivedAmount) || bill.finalAmount
        }
      });

      const updatedOrder = await prisma.order.update({
        where: { id: req.params.id },
        data: { status: 'PAID' },
        include: { visit: { include: { table: true } } }
      });

      const mappedOrder = {
        ...updatedOrder,
        paymentStatus: 'paid',
        paymentMethod,
        tableNumber: updatedOrder.visit?.table?.tableNumber
      };

      socketService.emitToRestaurant(updatedOrder.restaurantId, 'order:paid', mappedOrder);
      if (mappedOrder.tableNumber) {
        socketService.emitToTable(updatedOrder.restaurantId, mappedOrder.tableNumber, 'order:paid', mappedOrder);
      }

      res.json({ success: true, order: mappedOrder });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async adminGetZReport(req, res) {
    try {
      const payments = await prisma.payment.findMany({
        where: { restaurantId: req.params.restaurantId },
        include: { bill: true }
      });
      
      let cashTotal = 0, terminalTotal = 0, mixedTotal = 0;
      payments.forEach(p => {
        if (p.method === 'CASH') cashTotal += Number(p.amount);
        else if (p.method === 'CARD' || p.method === 'TERMINAL') terminalTotal += Number(p.amount);
        else mixedTotal += Number(p.amount);
      });
      
      const totalRevenue = cashTotal + terminalTotal + mixedTotal;

      res.json({ 
        success: true, 
        report: { 
          totalReceipts: payments.length, 
          grossTotal: totalRevenue, 
          netTotal: totalRevenue, 
          cashTotal,
          terminalTotal,
          mixedTotal
        } 
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async adminAcknowledgeCall(req, res) {
    try {
      const order = await prisma.order.update({
        where: { id: req.params.id },
        data: { status: 'DELIVERED', activeCallKey: null },
        include: { visit: { include: { table: true } } }
      });
      const mappedOrder = { ...order, tableNumber: order.visit?.table?.tableNumber };
      socketService.emitToRestaurant(order.restaurantId, 'waiter:acknowledged', mappedOrder);
      res.json({ success: true, order: mappedOrder });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async adminGetBossStats(req, res) {
    res.json({ success: true, stats: { todayRevenue: 0, yesterdayRevenue: 0, totalRevenue: 0, todayOrdersCount: 0, topDishes: [] } });
  },

  async adminGetBossAnalytics(req, res) {
    res.json({ success: true, analytics: { totalRevenue: 0, ordersCount: 0, topDishes: [], allDishRankings: [] } });
  },

  async adminGetQR(req, res) {
    try {
      const restaurant = await prisma.restaurant.findUnique({ where: { id: req.params.restaurantId } });
      if (!restaurant) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });

      const host = req.get('host');
      const protocol = req.protocol;
      const baseUrl = `${protocol}://${host}`;

      const tablesCount = 10;
      const promises = [];

      for (let i = 1; i <= tablesCount; i++) {
        const targetUrl = `${baseUrl}/r/${restaurant.slug}?table=${i}`;
        promises.push(
          QRCode.toDataURL(targetUrl, {
            width: 300, margin: 2, color: { dark: '#1e293b', light: '#ffffff' }
          }).then(qrDataUrl => ({ tableNumber: i, targetUrl, qrDataUrl }))
        );
      }

      const qrList = await Promise.all(promises);

      res.json({
        success: true,
        restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug, logo: restaurant.logo },
        qrCodes: qrList
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getPublicSingleQR(req, res) {
    try {
      const restaurant = await prisma.restaurant.findUnique({ where: { id: req.params.restaurantId } });
      if (!restaurant) return res.status(404).json({ success: false, message: 'Restoran topilmadi' });

      const host = req.get('host');
      const protocol = req.protocol;
      const baseUrl = `${protocol}://${host}`;
      const targetUrl = `${baseUrl}/r/${restaurant.slug}?table=1`;

      const qrDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 300, margin: 2, color: { dark: '#1e293b', light: '#ffffff' }
      });

      res.json({
        success: true,
        restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug, logo: restaurant.logo },
        qrCodes: [{ tableNumber: 1, targetUrl, qrDataUrl }]
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = orderController;
