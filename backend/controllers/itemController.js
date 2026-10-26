const { Item, Claim, Match } = require('../models');
const config = require('../config/config');
const { HttpError, str } = require('../http');
const { publicItem, getItem } = require('../itemModel');
const { processNewItem } = require('../matching');

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

exports.getItems = async (req, res, next) => {
  try {
    const filter = { status: { $ne: 'Returned' } };

    const type = str(req.query.type, 10);
    if (type === 'lost' || type === 'found') filter.type = type;

    const category = str(req.query.category, 40);
    if (category) filter.category = category;

    const zone = str(req.query.zone, 60);
    if (zone) filter.zone = zone;

    const q = str(req.query.q, 80);
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: regex },
        { description: regex },
        { zone: regex },
        { colour: regex },
      ];
    }

    const rows = await Item.find(filter)
      .select('-image')
      .sort({ createdAt: -1, _id: -1 })
      .limit(500);

    res.json({ items: rows.map((r) => publicItem(r, req.user)) });
  } catch (err) {
    next(err);
  }
};

exports.getReturnedItems = async (req, res, next) => {
  try {
    const rows = await Item.find({ status: 'Returned' })
      .select('-image')
      .sort({ createdAt: -1, _id: -1 })
      .limit(12);
    res.json({ items: rows.map((r) => publicItem(r, req.user)) });
  } catch (err) {
    next(err);
  }
};

exports.getMyItems = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const rows = await Item.find({ userId })
      .select('-image')
      .sort({ createdAt: -1, _id: -1 });
    res.json({ items: rows.map((r) => publicItem(r, req.user)) });
  } catch (err) {
    next(err);
  }
};

exports.createItem = async (req, res, next) => {
  try {
    const d = validateReport(req.body || {});
    const userId = req.user._id || req.user.id;

    const created = await Item.create({
      userId,
      ...d,
    });

    const matches = await processNewItem(created);
    const fresh = await getItem(created._id);

    const topMatches = [];
    for (const m of matches.slice(0, 5)) {
      const otherItem = await getItem(m.other._id || m.other.id);
      if (otherItem) {
        topMatches.push({
          score: m.score,
          reasons: m.reasons,
          item: publicItem(otherItem, req.user),
        });
      }
    }

    res.status(201).json({
      item: publicItem(fresh, req.user),
      matches: topMatches,
    });
  } catch (err) {
    next(err);
  }
};

exports.getItemById = async (req, res, next) => {
  try {
    const row = await getItem(req.params.id);
    if (!row) throw new HttpError(404, 'Item not found.', 'not_found');

    const item = publicItem(row, req.user);
    if (req.user) {
      const userId = req.user._id || req.user.id;
      const claim = await Claim.findOne({ itemId: row._id, userId }).sort({ createdAt: -1 });
      if (claim) item.myClaim = { status: claim.status };
    }
    res.json({ item });
  } catch (err) {
    next(err);
  }
};

exports.getItemImage = async (req, res, next) => {
  try {
    const row = await Item.findById(req.params.id).select('image');
    const m = row && row.image ? IMAGE_RE.exec(row.image) : null;
    if (!m) throw new HttpError(404, 'No photo for this item.', 'not_found');
    res.set('Cache-Control', 'public, max-age=300');
    res.type(m[1]).send(Buffer.from(m[2], 'base64'));
  } catch (err) {
    next(err);
  }
};

exports.getItemMatches = async (req, res, next) => {
  try {
    const row = await getItem(req.params.id);
    if (!row) throw new HttpError(404, 'Item not found.', 'not_found');

    const ownerId = (row.userId?._id || row.userId || row.user_id)?.toString();
    const reqUserId = (req.user._id || req.user.id)?.toString();
    if (ownerId !== reqUserId && req.user.role !== 'admin') {
      throw new HttpError(403, 'You can only view matches for your own reports.', 'forbidden');
    }

    const isLost = row.type === 'lost';
    const query = isLost ? { lostId: row._id } : { foundId: row._id };
    const matches = await Match.find(query).sort({ score: -1 });

    const out = [];
    for (const m of matches) {
      const otherId = isLost ? m.foundId : m.lostId;
      const other = await getItem(otherId);
      if (!other || other.status === 'Returned') continue;
      out.push({
        score: m.score,
        reasons: Array.isArray(m.reasons) ? m.reasons : JSON.parse(m.reasons || '[]'),
        item: publicItem(other, req.user),
      });
    }
    res.json({ matches: out });
  } catch (err) {
    next(err);
  }
};
