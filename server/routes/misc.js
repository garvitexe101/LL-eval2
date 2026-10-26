const express = require('express');
const { Item, Notification, Match, toIso } = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware');
const { publicItem, getItem } = require('../itemModel');

const router = express.Router();

// Dropdown values and map zones, so the frontend never hard-codes them.
router.get('/meta', (req, res) => {
  res.json({
    zones: config.zones,
    categories: config.categories,
    colours: config.colours,
    deposits: config.deposits,
    campusCenter: config.campusCenter,
  });
});

// Zone-level map data. Only public fields are exposed; no private details or exact spots.
router.get('/map', async (req, res, next) => {
  try {
    const rows = await Item.find({ status: { $ne: 'Returned' } })
      .select('type name zone')
      .sort({ createdAt: -1, _id: -1 });

    const zones = config.zones.map((z) => {
      const inZone = rows.filter((r) => r.zone === z.name);
      return {
        name: z.name,
        lat: z.lat,
        lng: z.lng,
        lost: inZone.filter((r) => r.type === 'lost').length,
        found: inZone.filter((r) => r.type === 'found').length,
        items: inZone.slice(0, 8).map((r) => ({
          id: r.id || r._id.toString(),
          type: r.type,
          name: r.name,
        })),
      };
    });

    res.json({ center: config.campusCenter, zones });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const rows = await Notification.find({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(50);

    res.json({
      notifications: rows.map((n) => ({
        id: n.id || n._id.toString(),
        type: n.type,
        title: n.title,
        message: n.message,
        note: n.note,
        read: Boolean(n.isRead),
        createdAt: toIso(n.createdAt),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    await Notification.updateMany({ userId }, { $set: { isRead: true } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Every potential match across all of my reports (for the profile page).
router.get('/matches/mine', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;

    // Find all active items owned by this user
    const myItems = await Item.find({ userId, status: { $ne: 'Returned' } }).select('_id');
    const myItemIds = myItems.map((i) => i._id);

    const rows = await Match.find({
      $or: [{ lostId: { $in: myItemIds } }, { foundId: { $in: myItemIds } }],
    })
      .sort({ score: -1 })
      .limit(20);

    const matches = [];
    for (const m of rows) {
      const lost = await getItem(m.lostId);
      const found = await getItem(m.foundId);
      if (!lost || !found || lost.status === 'Returned' || found.status === 'Returned') continue;

      const lostOwnerId = (lost.userId?._id || lost.userId || lost.user_id)?.toString();
      const iOwnLost = lostOwnerId === userId.toString();

      matches.push({
        score: m.score,
        reasons: Array.isArray(m.reasons) ? m.reasons : JSON.parse(m.reasons || '[]'),
        mine: publicItem(iOwnLost ? lost : found, req.user),
        other: publicItem(iOwnLost ? found : lost, req.user),
      });
    }

    res.json({ matches });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
