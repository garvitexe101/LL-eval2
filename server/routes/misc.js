const express = require('express');
const db = require('../db');
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
router.get('/map', (req, res) => {
  const rows = db
    .prepare("SELECT id, type, name, zone FROM items WHERE status != 'Returned' ORDER BY created_at DESC, id DESC")
    .all();
  const zones = config.zones.map((z) => {
    const inZone = rows.filter((r) => r.zone === z.name);
    return {
      name: z.name,
      lat: z.lat,
      lng: z.lng,
      lost: inZone.filter((r) => r.type === 'lost').length,
      found: inZone.filter((r) => r.type === 'found').length,
      items: inZone.slice(0, 8).map((r) => ({ id: r.id, type: r.type, name: r.name })),
    };
  });
  res.json({ center: config.campusCenter, zones });
});

router.get('/notifications', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50')
    .all(req.user.id);
  res.json({
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      note: n.note,
      read: Boolean(n.is_read),
      createdAt: db.toIso(n.created_at),
    })),
  });
});

router.post('/notifications/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

// Every potential match across all of my reports (for the profile page).
router.get('/matches/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.lost_id, m.found_id, m.score, m.reasons
       FROM matches m
       JOIN items l ON l.id = m.lost_id
       JOIN items f ON f.id = m.found_id
       WHERE (l.user_id = ? OR f.user_id = ?) AND l.status != 'Returned' AND f.status != 'Returned'
       ORDER BY m.score DESC LIMIT 20`
    )
    .all(req.user.id, req.user.id);

  const matches = rows.map((m) => {
    const lost = getItem(m.lost_id);
    const found = getItem(m.found_id);
    const iOwnLost = lost.user_id === req.user.id;
    return {
      score: m.score,
      reasons: JSON.parse(m.reasons),
      mine: publicItem(iOwnLost ? lost : found, req.user),
      other: publicItem(iOwnLost ? found : lost, req.user),
    };
  });
  res.json({ matches });
});

module.exports = router;
