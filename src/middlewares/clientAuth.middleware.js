const jwt = require('jsonwebtoken');
const prisma = require('../services/db.service');
const { JWT_SECRET } = require('../config/constants');

exports.authenticateClient = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: "Avtorizatsiya tokeni yo'q. Iltimos stol kodini kiriting." });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ success: false, message: "Token muddati o'tgan yoki yaroqsiz." });
    }

    if (!decoded || !decoded.visitId || !decoded.restaurantId) {
      return res.status(403).json({ success: false, message: "Token formati yaroqsiz." });
    }

    // Har bir so'rovda tashrifning DB dagi joriy faol holatini tekshiramiz
    const visit = await prisma.visit.findFirst({
      where: {
        id: decoded.visitId,
        restaurantId: decoded.restaurantId,
        status: 'ACTIVE'
      },
      include: { table: true }
    });

    if (!visit) {
      return res.status(403).json({ success: false, message: "Tashrif allaqachon yopilgan yoki yaroqsiz. Yangi buyurtma berish taqiqlanadi." });
    }

    // req.clientVisit obyektiga ma'lumotlarni biriktiramiz
    req.clientVisit = {
      visitId: visit.id,
      restaurantId: visit.restaurantId,
      tableId: visit.tableId,
      tableNumber: visit.table.tableNumber,
      visit
    };

    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: "Avtorizatsiyada ichki xatolik: " + err.message });
  }
};

