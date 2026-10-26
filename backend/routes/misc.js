const express = require('express');
const miscController = require('../controllers/miscController');
const { requireAuth } = require('../middleware');

const router = express.Router();

router.get('/meta', miscController.getMeta);
router.get('/map', miscController.getMapData);
router.get('/notifications', requireAuth, miscController.getNotifications);
router.post('/notifications/read-all', requireAuth, miscController.readAllNotifications);
router.get('/matches/mine', requireAuth, miscController.getMyMatches);

module.exports = router;
