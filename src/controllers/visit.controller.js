const prisma = require('../services/db.service');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

exports.openVisit = async (req, res) => {
  try {
    const { tableId } = req.body;
    const restaurantId = req.user.restaurantId;

    if (!restaurantId) return res.status(403).json({ error: "Access denied" });

    // Check if table is already active
    const existingActive = await prisma.visit.findFirst({
      where: { tableId, status: 'ACTIVE', restaurantId }
    });

    if (existingActive) {
      return res.status(400).json({ error: "Bu stolda allaqachon faol tashrif mavjud" });
    }

    const newVisit = await prisma.visit.create({
      data: {
        restaurantId,
        tableId,
        status: 'ACTIVE',
        joinToken: uuidv4().substring(0, 8).toUpperCase() // short token
      }
    });

    // Update table status
    await prisma.table.update({
      where: { id: tableId },
      data: { status: 'OCCUPIED' }
    });

    res.json({ message: "Tashrif ochildi", visit: newVisit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ichki xatolik" });
  }
};

exports.joinVisit = async (req, res) => {
  try {
    const { joinToken } = req.body;

    const visit = await prisma.visit.findUnique({
      where: { joinToken },
      include: { table: true, restaurant: true }
    });

    if (!visit || visit.status !== 'ACTIVE') {
      return res.status(404).json({ error: "Faol tashrif topilmadi yoki yopilgan." });
    }

    // Returning a simple session or token for the client
    // For MVP, we just return the visitId so the client can use it in future API calls
    const clientToken = jwt.sign(
      { visitId: visit.id, restaurantId: visit.restaurant.id, tableId: visit.tableId },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ 
      success: true,
      message: "Tashrifga ulandingiz", 
      visitId: visit.id,
      clientToken,
      tableNumber: visit.table.tableNumber,
      restaurant: { id: visit.restaurant.id, name: visit.restaurant.name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ichki xatolik" });
  }
};

exports.closeVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const restaurantId = req.user.restaurantId;

    const visit = await prisma.visit.findUnique({
      where: { id: visitId }
    });

    if (!visit || visit.restaurantId !== restaurantId) {
      return res.status(404).json({ error: "Topilmadi" });
    }

    // Verify if bills are paid
    const unpaidBills = await prisma.bill.findFirst({
      where: { visitId, status: { not: 'PAID' } }
    });

    if (unpaidBills) {
      return res.status(400).json({ error: "To'lanmagan hisob mavjud. Avval hisobni yoping." });
    }

    await prisma.visit.update({
      where: { id: visitId },
      data: { status: 'CLOSED', closedAt: new Date() }
    });

    await prisma.table.update({
      where: { id: visit.tableId },
      data: { status: 'DIRTY' } // Staff needs to clean
    });

    res.json({ message: "Tashrif yopildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ichki xatolik" });
  }
};
