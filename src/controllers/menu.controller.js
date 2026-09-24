const storage = require('../services/storage.service');
const socketService = require('../services/socket.service');

const menuController = {
  getMenu(req, res) {
    const items = storage.getMenuItems(req.params.restaurantId);
    res.json({ success: true, menuItems: items });
  },

  createMenuItem(req, res) {
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

      const item = storage.createMenuItem({
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
      });

      res.json({ success: true, menuItem: item });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  updateMenuItem(req, res) {
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

      const item = storage.updateMenuItem(req.params.id, updateData);
      if (!item) return res.status(404).json({ success: false, message: 'Taom topilmadi' });
      res.json({ success: true, menuItem: item });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  toggleAvailability(req, res) {
    const item = storage.getMenuItemById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Taom topilmadi' });
    const newStatus = req.body.isAvailable !== undefined ? req.body.isAvailable : !item.isAvailable;
    const updated = storage.updateMenuItem(req.params.id, { isAvailable: newStatus });
    socketService.emitToRestaurant(item.restaurantId, 'menu:updated', updated);
    res.json({ success: true, menuItem: updated });
  },

  deleteMenuItem(req, res) {
    storage.deleteMenuItem(req.params.id);
    res.json({ success: true });
  }
};

module.exports = menuController;
