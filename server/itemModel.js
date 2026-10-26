const db = require('./db');

// The image blob is never selected in list queries; clients fetch it from /api/items/:id/image.
const FIELDS = ['id', 'user_id', 'type', 'name', 'category', 'colour', 'zone', 'date', 'time', 'description',
  'private_detail', 'deposit', 'status', 'created_at'];
const COLS = `${FIELDS.join(', ')}, (image IS NOT NULL) AS has_image`;
// Same columns prefixed with the alias "i", for queries that join other tables.
const COLS_I = `${FIELDS.map((f) => `i.${f}`).join(', ')}, (i.image IS NOT NULL) AS has_image`;

/** Shape sent to everyone. Private ownership details are only added for the owner or an admin. */
function publicItem(row, viewer) {
  const mine = Boolean(viewer && row.user_id === viewer.id);
  const out = {
    id: row.id,
    type: row.type,
    name: row.name,
    category: row.category,
    colour: row.colour,
    zone: row.zone,
    date: row.date,
    time: row.time || '',
    description: row.description,
    deposit: row.type === 'found' ? row.deposit : null,
    hasImage: Boolean(row.has_image),
    status: row.status,
    createdAt: db.toIso(row.created_at),
    mine,
  };
  if (mine || (viewer && viewer.role === 'admin')) out.privateDetail = row.private_detail || '';
  return out;
}

const getItem = (id) => db.prepare(`SELECT ${COLS} FROM items WHERE id = ?`).get(id);

module.exports = { COLS, COLS_I, publicItem, getItem };
