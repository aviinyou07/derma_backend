const express = require('express');
const controller = require('../controllers/wishlist.controller');
const auth = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(auth);

router.get('/', controller.getMyWishlist);
router.post('/items', controller.addToWishlist);
router.delete('/items/:productId', controller.removeFromWishlist);

module.exports = router;
