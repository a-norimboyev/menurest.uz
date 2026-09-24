const storage = require('../services/storage.service');
const socketService = require('../services/socket.service');

const reviewController = {
  createReview(req, res) {
    const slug = req.params.slug.toLowerCase();
    const restaurant = storage.getRestaurantBySlug(slug);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restoran topilmadi' });
    }

    const { tableNumber, rating, comment } = req.body;
    const review = storage.createReview({
      restaurantId: restaurant.id,
      tableNumber,
      rating,
      comment
    });

    socketService.emitToRestaurant(restaurant.id, 'review:new', review);
    res.json({ success: true, review });
  },

  getReviews(req, res) {
    const stats = storage.getReviewsStats(req.params.restaurantId);
    res.json({ success: true, ...stats });
  }
};

module.exports = reviewController;
