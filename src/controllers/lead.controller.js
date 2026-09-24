const storage = require('../services/storage.service');
const socketService = require('../services/socket.service');

const leadController = {
  createLead(req, res) {
    const { restaurantName, ownerName, phone, plan, message } = req.body;
    if (!restaurantName || !phone) {
      return res.status(400).json({ success: false, message: "Restoran nomi va telefon raqami kiritilishi shart" });
    }

    const newLead = storage.createLead({
      restaurantName,
      ownerName,
      phone,
      plan,
      message
    });

    socketService.emitGlobal('super:new_lead', newLead);

    res.json({
      success: true,
      message: "Arizangiz muvaffaqiyatli qabul qilindi. Tez orada mutaxassisimiz siz bilan bog'lanadi!",
      lead: newLead
    });
  },

  getLeads(req, res) {
    const leads = storage.getLeads();
    res.json({ success: true, leads });
  }
};

module.exports = leadController;
