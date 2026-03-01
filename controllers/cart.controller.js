const service = require('../services/cart.service');

exports.getCart = async (req, res) => {
  try {
    const result = await service.getCart(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const result = await service.addToCart(req.user.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const result = await service.updateCartItem(req.user.id, req.params.itemId, req.body);
    res.json(result);
  } catch (error) {
    const status = error.message === 'Cart item not found' ? 404 : 400;
    res.status(status).json({ message: error.message });
  }
};

exports.removeCartItem = async (req, res) => {
  try {
    const result = await service.removeCartItem(req.user.id, req.params.itemId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const result = await service.clearCart(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
