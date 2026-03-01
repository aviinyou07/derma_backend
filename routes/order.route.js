const express = require('express');
const controller = require('../controllers/order.controller');
const auth = require('../middlewares/auth.middleware');

const router = express.Router();

// Cart/checkout preview
router.post('/preview', controller.previewOrder);

// Create order (requires authentication)
router.post('/', auth, controller.createOrder);
router.post('/from-cart', auth, controller.createOrderFromCart);

// Verify payment (webhook/callback)
router.post('/verify-payment', controller.verifyPayment);

// Authenticated order history/detail
router.get('/mine', auth, controller.getMyOrders);
router.get('/mine/:orderId/status-history', auth, controller.getOrderStatusHistory);
router.get('/mine/:orderId/invoice', auth, controller.downloadInvoice);
router.get('/mine/:orderId', auth, controller.getOrderDetails);

module.exports = router;
