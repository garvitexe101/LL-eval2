const express = require('express');
const db = require('../db');
const config = require('../config');
const { HttpError, str } = require('../http');
const { requireAuth } = require('../middleware');
const { COLS, publicItem, getItem } = require('../itemModel');
const { processNewItem } = require('../matching');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_RE = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function validateReport(body) {
  const type = str(body.type, 10);
  const name = str(body.name, 60);
  const category = str(body.category, 40);
  const colour = str(body.colour, 40);
  const zone = str(body.zone, 60);
  const date = str(body.date, 10);
  const time = str(body.time, 12);
  const description = str(body.description, 280);
  const privateDetail = str(body.privateDetail, 100);
  const deposit = str(body.deposit, 40);
  const image = typeof body.image === 'string' ? body.image : '';

  const fail = (msg) => {
    throw new HttpError(400, msg, 'validation');
  };

  if (!['lost', 'found'].includes(type)) fail('Report type must be lost or found.');
  if (!name) fail('Item name is required.');
  if (!config.categories.includes(category)) fail('Choose a valid category.');
  if (!colour || colour.length < 2) fail('Colour is required.');
  if (!config.zones.some((z) => z.name === zone)) fail('Choose a valid campus location.');
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) fail('Enter a valid date.');
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (date > tomorrow) fail('The date cannot be in the future.');
  if (date < '2000-01-01') fail('Enter a valid date.');
  if (!description) fail('Description is required.');
  if (type === 'found' && !config.deposits.includes(deposit)) fail('Choose where the item is now.');

  let storedImage = null;
  if (image) {
    const m = IMAGE_RE.exec(image);
    if (!m) fail('Photo must be a PNG, JPEG, GIF or WebP image.');
    if (Buffer.byteLength(m[2], 'base64') > MAX_IMAGE_BYTES) fail('Photo must be 2 MB or smaller.');
    storedImage = image;
  }

  return {
    type,
    name,
    category,
    colour,
    zone,
    date,
    time: time || null,
    description,
    privateDetail: privateDetail || null,
    deposit: type === 'found' ? deposit : null,
    image: storedImage,
  };
}

const likeEscape = (s) => s.replace(/[\\%_]/g, '\\$&');

// Public list of active (not yet returned) reports.
router.get('/', (req, res) => {
  const where = ["status != 'Returned'"];
  const params = [];

  const type = str(req.query.type, 10);
  if (type === 'lost' || type === 'found') {
    where.push('type = ?');
    params.push(type);
  }
  const category = str(req.query.category, 40);
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  const zone = str(req.query.zone, 60);
  if (zone) {
    where.push('zone = ?');
    params.push(zone);
  }
  const q = str(req.query.q, 80);
  if (q) {
    const like = `%${likeEscape(q.toLowerCase())}%`;
    where.push(
      `(LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(description) LIKE ? ESCAPE '\\'
        OR LOWER(zone) LIKE ? ESCAPE '\\' OR LOWER(colour) LIKE ? ESCAPE '\\')`
    );
    params.push(like, like, like, like);
  }

  const rows = db
    .prepare(`SELECT ${COLS} FROM items WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT 500`)
    .all(...params);
  res.json({ items: rows.map((r) => publicItem(r, req.user)) });
});

router.get('/returned', (req, res) => {
  const rows = db
    .prepare(`SELECT ${COLS} FROM items WHERE status = 'Returned' ORDER BY created_at DESC, id DESC LIMIT 12`)
    .all();
  res.json({ items: rows.map((r) => publicItem(r, req.user)) });
});

router.get('/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare(`SELECT ${COLS} FROM items WHERE user_id = ? ORDER BY created_at DESC, id DESC`)
    .all(req.user.id);
  res.json({ items: rows.map((r) => publicItem(r, req.user)) });
});

router.post('/', requireAuth, (req, res) => {
  const d = validateReport(req.body || {});
  const info = db
    .prepare(
      `INSERT INTO items (user_id, type, name, category, colour, zone, date, time, description, private_detail, deposit, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, d.type, d.name, d.category, d.colour, d.zone, d.date, d.time, d.description, d.privateDetail, d.deposit, d.image);

  const created = getItem(info.lastInsertRowid);
  const matches = processNewItem(created);
  const fresh = getItem(created.id); // status may have changed to "Possible match"

  res.status(201).json({
    item: publicItem(fresh, req.user),
    matches: matches.slice(0, 5).map((m) => ({
      score: m.score,
      reasons: m.reasons,
      item: publicItem(getItem(m.other.id), req.user),
    })),
  });
});

router.get('/:id(\\d+)', (req, res) => {
  const row = getItem(Number(req.params.id));
  if (!row) throw new HttpError(404, 'Item not found.', 'not_found');

  const item = publicItem(row, req.user);
  if (req.user) {
    const claim = db
      .prepare('SELECT status FROM claims WHERE item_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1')
      .get(row.id, req.user.id);
    if (claim) item.myClaim = { status: claim.status };
  }
  res.json({ item });
});

router.get('/:id(\\d+)/image', (req, res) => {
  const row = db.prepare('SELECT image FROM items WHERE id = ?').get(Number(req.params.id));
  const m = row && row.image ? IMAGE_RE.exec(row.image) : null;
  if (!m) throw new HttpError(404, 'No photo for this item.', 'not_found');
  res.set('Cache-Control', 'public, max-age=300');
  res.type(m[1]).send(Buffer.from(m[2], 'base64'));
});

// Potential matches for one of my reports (admins can view any).
router.get('/:id(\\d+)/matches', requireAuth, (req, res) => {
  const row = getItem(Number(req.params.id));
  if (!row) throw new HttpError(404, 'Item not found.', 'not_found');
  if (row.user_id !== req.user.id && req.user.role !== 'admin') {
    throw new HttpError(403, 'You can only view matches for your own reports.', 'forbidden');
  }

  const col = row.type === 'lost' ? 'lost_id' : 'found_id';
  const otherCol = row.type === 'lost' ? 'found_id' : 'lost_id';
  const matches = db
    .prepare(`SELECT ${otherCol} AS other_id, score, reasons FROM matches WHERE ${col} = ? ORDER BY score DESC`)
    .all(row.id);

  const out = [];
  for (const m of matches) {
    const other = getItem(m.other_id);
    if (!other || other.status === 'Returned') continue;
    out.push({ score: m.score, reasons: JSON.parse(m.reasons), item: publicItem(other, req.user) });
  }
  res.json({ matches: out });
});

module.exports = router;
