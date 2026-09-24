const storage = require('../services/storage.service');

const categoryController = {
  getCategories(req, res) {
    const menuItems = storage.getMenuItems(req.params.restaurantId);
    const cats = storage.getCategories(req.params.restaurantId).map(c => ({
      ...c,
      dishesCount: menuItems.filter(m => m.categoryId === c.id).length
    }));
    res.json({ success: true, categories: cats });
  },

  createCategory(req, res) {
    const { restaurantId, nameUz, nameRu, nameEn, icon, sortOrder, isActive } = req.body;
    if (!restaurantId || !nameUz) {
      return res.status(400).json({ success: false, message: "Kategoriya nomi kiritilmadi" });
    }
    const cat = storage.createCategory({
      restaurantId,
      nameUz,
      nameRu,
      nameEn,
      icon,
      sortOrder,
      isActive: isActive !== false
    });
    res.json({ success: true, category: cat });
  },

  updateCategory(req, res) {
    const cat = storage.updateCategory(req.params.id, req.body);
    if (!cat) return res.status(404).json({ success: false, message: 'Kategoriya topilmadi' });
    res.json({ success: true, category: cat });
  },

  reorderCategories(req, res) {
    const { categoryId, direction, restaurantId } = req.body;
    if (!categoryId || !direction || !restaurantId) {
      return res.status(400).json({ success: false, message: "Ma'lumotlar to'liq emas" });
    }
    let cats = storage.getCategories(restaurantId);
    cats.forEach((c, idx) => { c.sortOrder = (idx + 1) * 10; });
    const idx = cats.findIndex(c => c.id === categoryId);
    if (idx === -1) return res.status(404).json({ success: false, message: "Kategoriya topilmadi" });

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < cats.length) {
      const temp = cats[idx].sortOrder;
      cats[idx].sortOrder = cats[targetIdx].sortOrder;
      cats[targetIdx].sortOrder = temp;
    }

    cats.forEach(c => { storage.updateCategory(c.id, { sortOrder: c.sortOrder }); });
    const menuItems = storage.getMenuItems(restaurantId);
    const updatedCats = storage.getCategories(restaurantId).map(c => ({
      ...c,
      dishesCount: menuItems.filter(m => m.categoryId === c.id).length
    }));
    res.json({ success: true, categories: updatedCats });
  },

  toggleStatus(req, res) {
    const cat = storage.getCategoryById(req.params.id);
    if (!cat) return res.status(404).json({ success: false, message: "Kategoriya topilmadi" });
    const newStatus = cat.isActive === false ? true : false;
    const updated = storage.updateCategory(cat.id, { isActive: newStatus });
    res.json({ success: true, category: updated });
  },

  deleteCategory(req, res) {
    storage.deleteCategory(req.params.id);
    res.json({ success: true });
  }
};

module.exports = categoryController;
