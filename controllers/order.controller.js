const service = require('../services/order.service');

exports.createOrder = async (req, res) => {
  try {
    const result = await service.createOrder(
      req.user.id,
      req.body
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const result = await service.verifyPayment(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};