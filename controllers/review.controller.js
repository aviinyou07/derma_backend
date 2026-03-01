const service = require('../services/review.service');

exports.getProductReviews = async (req, res) => {
  try {
    const result = await service.getProductReviewsBySlug(req.params.slug, req.query);
    res.json(result);
  } catch (error) {
    const status = error.message === 'Product not found' ? 404 : 400;
    res.status(status).json({ message: error.message });
  }
};

exports.createReview = async (req, res) => {
  try {
    const result = await service.createReview(req.user.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const result = await service.updateReview(req.user.id, req.params.reviewId, req.body);
    res.json(result);
  } catch (error) {
    const status = error.message === 'Review not found' ? 404 : 400;
    res.status(status).json({ message: error.message });
  }
};

exports.getMyReviews = async (req, res) => {
  try {
    const result = await service.getMyReviews(req.user.id, req.query);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
