const service = require('../services/product.service');
const reviewService = require('../services/review.service');

exports.listProducts = async (req, res) => {
  try {
    const result = await service.listProducts(req.query);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getProductDetails = async (req, res) => {
  try {
    const result = await service.getProductDetails(req.params.slug);
    res.json(result);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

exports.trending = async (req, res) => {
  try {
    const result = await service.getTrending(req.query.limit);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.featured = async (req, res) => {
  try {
    const result = await service.getFeatured(req.query.limit);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.search = async (req, res) => {
  try {
    const result = await service.search(
      req.query.q,
      req.query.limit
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getVariationById = async (req, res) => {
  try {
    const result = await service.getVariationById(req.params.variationId);
    res.json(result);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

exports.getProductReviews = async (req, res) => {
  try {
    const result = await reviewService.getProductReviewsBySlug(req.params.slug, req.query);
    res.json(result);
  } catch (err) {
    const status = err.message === 'Product not found' ? 404 : 400;
    res.status(status).json({ message: err.message });
  }
};

exports.getFacets = async (_req, res) => {
  try {
    const result = await service.getFacets();
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};