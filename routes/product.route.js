const express = require('express');
const controller = require('../controllers/product.controller');

const router = express.Router();

router.get('/trending', controller.trending);
router.get('/featured', controller.featured);
router.get('/search', controller.search);
router.get('/variation/:variationId', controller.getVariationById);
router.get('/facets', controller.getFacets);
router.get('/:slug/reviews', controller.getProductReviews);
router.get('/', controller.listProducts);
router.get('/:slug', controller.getProductDetails);

module.exports = router;