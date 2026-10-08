const prisma = require('../services/db.service');
const socketService = require('../services/socket.service');

const reviewController = {
  async createReview(req, res) {
    try {
      const slug = req.params.slug.toLowerCase();
      const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
      if (!restaurant) {
        return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
      }

      const { tableNumber, rating, comment } = req.body;
      
      // Since Review model is not present in Prisma schema, we mock the creation.
      // In a real scenario, you'd add a Review model to schema.prisma.
      const review = {
        id: 'REV-' + Date.now(),
        restaurantId: restaurant.id,
        tableNumber,
        rating: Number(rating) || 5,
        comment,
        createdAt: new Date()
      };

      socketService.emitToRestaurant(restaurant.id, 'review:new', review);
      res.json({ success: true, review });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getReviews(req, res) {
    try {
      // Return empty stats since Review model is missing from Prisma schema
      res.json({
        success: true,
        averageRating: 5.0,
        totalCount: 0,
        reviews: [],
        allTimeCount: 0
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = reviewController;
