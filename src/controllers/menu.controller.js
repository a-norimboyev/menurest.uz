const prisma = require('../services/db.service');
const socketService = require('../services/socket.service');

const menuController = {
  async getMenu(req, res) {
    try {
      const items = await prisma.menuItem.findMany({
        where: { restaurantId: req.params.restaurantId }
      });
      const mappedItems = items.map(item => ({
        ...item,
        price: Number(item.price)
      }));
      res.json({ success: true, menuItems: mappedItems });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createMenuItem(req, res) {
    try {
      const {
        restaurantId, categoryId, nameUz, nameRu, nameEn, price,
        imageUrl, descriptionUz, descriptionRu, descriptionEn, weight, isPopular
      } = req.body;

      if (!restaurantId || !nameUz || !price) {
        return res.status(400).json({ success: false, message: "Taom nomi va narxi majburiy" });
      }

      let image = imageUrl || '/images/default-dish.jpg';
      if (req.file) {
        image = '/uploads/' + req.file.filename;
      }

      const item = await prisma.menuItem.create({
        data: {
          restaurantId,
          categoryId,
          nameUz,
          nameRu,
          nameEn,
          price: Number(price),
          image,
          descriptionUz,
          descriptionRu,
          descriptionEn,
          weight,
          isPopular: isPopular === 'true' || isPopular === true
        }
      });

      res.json({ success: true, menuItem: { ...item, price: Number(item.price) } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateMenuItem(req, res) {
    try {
      const updateData = { ...req.body };
      if (updateData.price) updateData.price = Number(updateData.price);
      if (req.file) {
        updateData.image = '/uploads/' + req.file.filename;
      }
      if (updateData.isPopular !== undefined) {
        updateData.isPopular = updateData.isPopular === 'true' || updateData.isPopular === true;
      }
      if (updateData.isAvailable !== undefined) {
        updateData.isAvailable = updateData.isAvailable === 'true' || updateData.isAvailable === true;
      }
      
      // Remove any non-schema fields that might come in req.body
      delete updateData.id;
      delete updateData.restaurantId;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      const item = await prisma.menuItem.update({
        where: { id: req.params.id },
        data: updateData
      });

      res.json({ success: true, menuItem: { ...item, price: Number(item.price) } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async toggleAvailability(req, res) {
    try {
      const item = await prisma.menuItem.findUnique({
        where: { id: req.params.id }
      });
      if (!item) return res.status(404).json({ success: false, message: 'Taom topilmadi' });
      
      const newStatus = req.body.isAvailable !== undefined ? req.body.isAvailable : !item.isAvailable;
      
      const updated = await prisma.menuItem.update({
        where: { id: req.params.id },
        data: { isAvailable: newStatus }
      });

      const mappedUpdated = { ...updated, price: Number(updated.price) };
      socketService.emitToRestaurant(item.restaurantId, 'menu:updated', mappedUpdated);
      res.json({ success: true, menuItem: mappedUpdated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteMenuItem(req, res) {
    try {
      await prisma.menuItem.delete({
        where: { id: req.params.id }
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = menuController;
