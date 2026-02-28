const service = require('../services/product.service');

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