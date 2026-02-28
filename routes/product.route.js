const express = require('express');
const controller = require('../controllers/product.controller');

const router = express.Router();

router.get('/', controller.listProducts);
router.get('/:slug', controller.getProductDetails);

router.get('/trending', controller.trending);
router.get('/featured', controller.featured);
router.get('/search', controller.search);

module.exports = router;