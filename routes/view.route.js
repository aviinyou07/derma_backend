const express = require('express');
const controller = require('../controllers/view.controller');

const router = express.Router();

router.get('/', controller.home);
router.get('/productlist', controller.productListPage);
router.get('/checkout', controller.checkoutPage);
router.get('/orderhistory', controller.orderHistoryPage);
router.get('/productdetails', controller.productDetailsPage);
router.get('/productdetails/:slug', controller.productDetailsPage);
router.get('/orderdetails', controller.orderDetailsPage);
router.get('/orderdetails/:orderId', controller.orderDetailsPage);
router.get('/cart', controller.cartPage);

module.exports = router;
