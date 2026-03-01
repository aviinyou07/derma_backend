const express = require('express');
const controller = require('../controllers/user.controller');
const auth = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/signup', controller.signup);
router.post('/verify-email', controller.verifyEmail);
router.post('/login', controller.login);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);

router.get('/profile', auth, controller.getProfile);
router.put('/profile', auth, controller.updateProfile);

module.exports = router;