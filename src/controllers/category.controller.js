const prisma = require('../services/db.service');

const categoryController = {
  async getCategories(req, res) {
    try {
      const categories = await prisma.category.findMany({
        where: { restaurantId: req.params.restaurantId },
        include: { _count: { select: { menuItems: true } } },
        orderBy: { sortOrder: 'asc' }
      });
      const cats = categories.map(c => ({
        ...c,
        dishesCount: c._count.menuItems
      }));
      res.json({ success: true, categories: cats });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createCategory(req, res) {
    try {
      const { restaurantId, nameUz, nameRu, nameEn, icon, sortOrder, isActive } = req.body;
      if (!restaurantId || !nameUz) {
        return res.status(400).json({ success: false, message: "Kategoriya nomi kiritilmadi" });
      }
      const cat = await prisma.category.create({
        data: {
          restaurantId,
          nameUz,
          nameRu: nameRu || null,
          nameEn: nameEn || null,
          icon: icon || null,
          sortOrder: sortOrder || 0,
          isActive: isActive !== false
        }
      });
      res.json({ success: true, category: cat });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const { restaurantId, nameUz, nameRu, nameEn, icon, sortOrder, isActive } = req.body;
      const dataToUpdate = {};
      if (restaurantId !== undefined) dataToUpdate.restaurantId = restaurantId;
      if (nameUz !== undefined) dataToUpdate.nameUz = nameUz;
      if (nameRu !== undefined) dataToUpdate.nameRu = nameRu;
      if (nameEn !== undefined) dataToUpdate.nameEn = nameEn;
      if (icon !== undefined) dataToUpdate.icon = icon;
      if (sortOrder !== undefined) dataToUpdate.sortOrder = sortOrder;
      if (isActive !== undefined) dataToUpdate.isActive = isActive;
      
      const cat = await prisma.category.update({
        where: { id },
        data: dataToUpdate
      });
      res.json({ success: true, category: cat });
    } catch (error) {
      res.status(404).json({ success: false, message: 'Kategoriya topilmadi' });
    }
  },

  async reorderCategories(req, res) {
    try {
      const { categoryId, direction, restaurantId } = req.body;
      if (!categoryId || !direction || !restaurantId) {
        return res.status(400).json({ success: false, message: "Ma'lumotlar to'liq emas" });
      }
      let cats = await prisma.category.findMany({
        where: { restaurantId },
        orderBy: { sortOrder: 'asc' }
      });
      cats.forEach((c, idx) => { c.sortOrder = (idx + 1) * 10; });
      const idx = cats.findIndex(c => c.id === categoryId);
      if (idx === -1) return res.status(404).json({ success: false, message: "Kategoriya topilmadi" });

      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx >= 0 && targetIdx < cats.length) {
        const temp = cats[idx].sortOrder;
        cats[idx].sortOrder = cats[targetIdx].sortOrder;
        cats[targetIdx].sortOrder = temp;
      }

      await prisma.$transaction(
        cats.map(c => prisma.category.update({
          where: { id: c.id },
          data: { sortOrder: c.sortOrder }
        }))
      );

      const updatedCats = await prisma.category.findMany({
        where: { restaurantId },
        include: { _count: { select: { menuItems: true } } },
        orderBy: { sortOrder: 'asc' }
      });
      const formattedCats = updatedCats.map(c => ({
        ...c,
        dishesCount: c._count.menuItems
      }));
      res.json({ success: true, categories: formattedCats });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async toggleStatus(req, res) {
    try {
      const cat = await prisma.category.findUnique({ where: { id: req.params.id } });
      if (!cat) return res.status(404).json({ success: false, message: "Kategoriya topilmadi" });
      const newStatus = cat.isActive === false ? true : false;
      const updated = await prisma.category.update({
        where: { id: cat.id },
        data: { isActive: newStatus }
      });
      res.json({ success: true, category: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async deleteCategory(req, res) {
    try {
      await prisma.category.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = categoryController;
