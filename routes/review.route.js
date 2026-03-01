const express = require('express');
const controller = require('../controllers/review.controller');
const auth = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/mine', auth, controller.getMyReviews);
router.post('/', auth, controller.createReview);
router.patch('/:reviewId', auth, controller.updateReview);

module.exports = router;
