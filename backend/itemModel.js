const { Item, toIso } = require('./db');

/** Shape sent to everyone. Private ownership details are only added for the owner or an admin. */
function publicItem(doc, viewer) {
  if (!doc) return null;
  const rawId = doc.id || (doc._id ? doc._id.toString() : null);
  const ownerId = (doc.userId?._id ? doc.userId._id.toString() : (doc.userId ? doc.userId.toString() : doc.user_id));
  const viewerId = viewer ? (viewer.id ? viewer.id.toString() : viewer._id?.toString()) : null;
  const mine = Boolean(viewerId && ownerId === viewerId);

  const out = {
    id: rawId,
    type: doc.type,
    name: doc.name,
    category: doc.category,
    colour: doc.colour,
    zone: doc.zone,
    date: doc.date,
    time: doc.time || '',
    description: doc.description,
    deposit: doc.type === 'found' ? doc.deposit : null,
    hasImage: Boolean(doc.image || doc.has_image || doc.hasImage),
    status: doc.status,
    createdAt: toIso(doc.createdAt || doc.created_at),
    mine,
  };

  if (mine || (viewer && viewer.role === 'admin')) {
    out.privateDetail = doc.privateDetail || doc.private_detail || '';
  }
  return out;
}

async function getItem(id) {
  try {
    return await Item.findById(id);
  } catch {
    return null;
  }
}

module.exports = { publicItem, getItem };
