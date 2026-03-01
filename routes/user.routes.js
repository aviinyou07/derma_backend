const express = require('express');
const controller = require('../controllers/user.controller');
const reviewController = require('../controllers/review.controller');
const auth = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/signup', controller.signup);
router.post('/verify-email', controller.verifyEmail);
router.post('/resend-verification-otp', controller.resendVerificationOtp);
router.post('/login', controller.login);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);

router.get('/profile', auth, controller.getProfile);
router.put('/profile', auth, controller.updateProfile);
router.get('/reviews', auth, reviewController.getMyReviews);
router.get('/addresses', auth, controller.listAddresses);
router.post('/addresses', auth, controller.addAddress);
router.put('/addresses/:addressId', auth, controller.updateAddress);
router.delete('/addresses/:addressId', auth, controller.deleteAddress);
router.patch('/addresses/:addressId/default', auth, controller.setDefaultAddress);

module.exports = router;