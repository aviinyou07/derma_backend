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

exports.previewOrder = async (req, res) => {
  try {
    const result = await service.previewOrder(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const result = await service.getMyOrders(req.user.id, req.query);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const result = await service.getOrderDetails(req.user.id, req.params.orderId);
    res.json(result);
  } catch (err) {
    const status = err.message === 'Order not found' ? 404 : 400;
    res.status(status).json({ message: err.message });
  }
};

exports.getOrderStatusHistory = async (req, res) => {
  try {
    const result = await service.getOrderStatusHistory(req.user.id, req.params.orderId);
    res.json(result);
  } catch (err) {
    const status = err.message === 'Order not found' ? 404 : 400;
    res.status(status).json({ message: err.message });
  }
};

exports.downloadInvoice = async (req, res) => {
  try {
    const result = await service.getOrderInvoice(req.user.id, req.params.orderId);
    const fileName = `invoice-${result.order_number || result.order_id}.html`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(result.html);
  } catch (err) {
    const status = err.message === 'Order not found' ? 404 : 400;
    res.status(status).json({ message: err.message });
  }
};

exports.createOrderFromCart = async (req, res) => {
  try {
    const result = await service.createOrderFromCart(req.user.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};