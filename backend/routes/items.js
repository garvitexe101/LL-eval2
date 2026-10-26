const express = require('express');
const itemController = require('../controllers/itemController');
const { requireAuth } = require('../middleware');

const router = express.Router();

router.get('/', itemController.getItems);
router.get('/returned', itemController.getReturnedItems);
router.get('/mine', requireAuth, itemController.getMyItems);
router.post('/', requireAuth, itemController.createItem);
router.get('/:id', itemController.getItemById);
router.get('/:id/image', itemController.getItemImage);
router.get('/:id/matches', requireAuth, itemController.getItemMatches);

module.exports = router;
