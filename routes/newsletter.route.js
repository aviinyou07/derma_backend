const express = require('express');
const controller = require('../controllers/newsletter.controller');

const router = express.Router();

router.post('/subscribe', controller.subscribe);
router.post('/unsubscribe', controller.unsubscribe);

module.exports = router;
