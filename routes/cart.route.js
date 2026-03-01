const express = require('express');
const controller = require('../controllers/cart.controller');
const auth = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(auth);

router.get('/', controller.getCart);
router.post('/items', controller.addToCart);
router.put('/items/:itemId', controller.updateCartItem);
router.delete('/items/:itemId', controller.removeCartItem);
router.delete('/', controller.clearCart);

module.exports = router;
