const express = require('express');
const controller = require('../controllers/auth.controller');

const router = express.Router();

router.post('/signup', controller.signup);
router.post('/verify-email', controller.verifyEmail);
router.post('/login', controller.login);
router.post('/resend-otp', controller.resendOTP);
router.post('/request-password-reset', controller.requestPasswordReset);
router.post('/reset-password', controller.resetPassword);

module.exports = router;