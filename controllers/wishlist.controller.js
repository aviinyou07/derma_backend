const service = require('../services/wishlist.service');

exports.getMyWishlist = async (req, res) => {
  try {
    const result = await service.getMyWishlist(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.addToWishlist = async (req, res) => {
  try {
    const result = await service.addToWishlist(req.user.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const result = await service.removeFromWishlist(req.user.id, req.params.productId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
