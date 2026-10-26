const express = require('express');
const authController = require('../controllers/authController');
const { rateLimit } = require('../middleware');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40 });

router.get('/me', authController.getMe);
router.get('/firebase-config', authController.getFirebaseConfig);
router.post('/firebase-login', limiter, authController.firebaseLogin);
router.post('/register', limiter, authController.register);
router.post('/login', limiter, authController.login);
router.post('/logout', authController.logout);

module.exports = router;
