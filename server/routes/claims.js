const express = require('express');
const db = require('../db');
const config = require('../config');
const { HttpError, str } = require('../http');
const { requireAuth, requireAdmin } = require('../middleware');
const { COLS_I, publicItem, getItem } = require('../itemModel');
const { notifyUser } = require('../notify');

const COLLECTION_NOTE =
  'Please carry your valid Student ID while visiting the Security Office to collect the item.';

/* ---------- Student-facing: submit and list own claims ---------- */

const claimsRouter = express.Router();

claimsRouter.post('/items/:id(\\d+)/claims', requireAuth, (req, res) => {
  const item = getItem(Number(req.params.id));
  if (!item) throw new HttpError(404, 'Item not found.', 'not_found');
  if (item.type !== 'found') throw new HttpError(400, 'Only found items can be claimed.', 'validation');
  if (item.status === 'Returned') throw new HttpError(400, 'This item has already been returned.', 'validation');
  if (item.user_id === req.user.id) throw new HttpError(400, 'You cannot claim your own report.', 'validation');

  const pending = db
    .prepare("SELECT 1 FROM claims WHERE item_id = ? AND user_id = ? AND status = 'pending'")
    .get(item.id, req.user.id);
  if (pending) throw new HttpError(409, 'You already have a claim waiting for review.', 'claim_exists');

  const answers = {
    colour: str(req.body.colour, 200),
    location: str(req.body.location, 200),
    privateFeature: str(req.body.privateFeature, 200),
    descriptionWord: str(req.body.descriptionWord, 200),
  };
  if (Object.values(answers).some((v) => !v)) {
    throw new HttpError(400, 'Please answer all verification questions.', 'validation');
  }

  const info = db
    .prepare('INSERT INTO claims (item_id, user_id, answers) VALUES (?, ?, ?)')
    .run(item.id, req.user.id, JSON.stringify(answers));

  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
  admins.forEach((a) =>
    notifyUser(a.id, {
      type: 'info',
      title: 'New claim to review',
      message: `${req.user.name} submitted a claim for "${item.name}".`,
      link: `${config.publicUrl}/admin.html`,
    })
  );

  res.status(201).json({ claim: { id: info.lastInsertRowid, status: 'pending' } });
});

claimsRouter.get('/claims/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT id, item_id, status, created_at, decided_at FROM claims WHERE user_id = ? ORDER BY id DESC')
    .all(req.user.id);
  res.json({
    claims: rows.map((r) => ({
      id: r.id,
      itemId: r.item_id,
      status: r.status,
      createdAt: db.toIso(r.created_at),
      decidedAt: db.toIso(r.decided_at),
    })),
  });
});

/* ---------- Admin: every route below is checked on the server ---------- */

const adminRouter = express.Router();
adminRouter.use(requireAdmin);

adminRouter.get('/overview', (req, res) => {
  const count = (sql) => db.prepare(sql).get().n;
  res.json({
    activeReports: count("SELECT COUNT(*) AS n FROM items WHERE status != 'Returned'"),
    returnedItems: count("SELECT COUNT(*) AS n FROM items WHERE status = 'Returned'"),
    possibleMatches: count("SELECT COUNT(*) AS n FROM items WHERE status = 'Possible match'"),
    pendingClaims: count("SELECT COUNT(*) AS n FROM claims WHERE status = 'pending'"),
  });
});

adminRouter.get('/claims', (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const rows = db
    .prepare(
      `SELECT c.id, c.status, c.answers, c.created_at, c.item_id,
              cu.name AS claimant_name, cu.email AS claimant_email
       FROM claims c JOIN users cu ON cu.id = c.user_id
       WHERE c.status = ? ORDER BY c.created_at ASC, c.id ASC`
    )
    .all(status);

  const claims = rows.map((r) => {
    const item = db
      .prepare(
        `SELECT ${COLS_I},
                u.name AS finder_name, u.email AS finder_email
         FROM items i JOIN users u ON u.id = i.user_id WHERE i.id = ?`
      )
      .get(r.item_id);
    return {
      id: r.id,
      status: r.status,
      createdAt: db.toIso(r.created_at),
      answers: JSON.parse(r.answers),
      claimant: { name: r.claimant_name, email: r.claimant_email },
      item: item
        ? {
            ...publicItem(item, req.user),
            privateDetail: item.private_detail || '',
            finder: { name: item.finder_name, email: item.finder_email },
          }
        : null,
    };
  });
  res.json({ claims });
});

adminRouter.post('/claims/:id(\\d+)/decision', (req, res) => {
  const decision = str(req.body.decision, 10);
  if (!['approve', 'reject'].includes(decision)) {
    throw new HttpError(400, 'Decision must be approve or reject.', 'validation');
  }

  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(Number(req.params.id));
  if (!claim) throw new HttpError(404, 'Claim not found.', 'not_found');
  if (claim.status !== 'pending') throw new HttpError(409, 'This claim has already been decided.', 'already_decided');
  const item = getItem(claim.item_id);

  const notices = [];
  db.transaction(() => {
    const decide = db.prepare(
      "UPDATE claims SET status = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ?"
    );

    if (decision === 'approve') {
      decide.run('approved', req.user.id, claim.id);
      db.prepare("UPDATE items SET status = 'Returned' WHERE id = ?").run(item.id);

      // Everyone else waiting on this item is turned down.
      const others = db
        .prepare("SELECT id, user_id FROM claims WHERE item_id = ? AND status = 'pending' AND id != ?")
        .all(item.id, claim.id);
      others.forEach((o) => {
        decide.run('rejected', req.user.id, o.id);
        notices.push([o.user_id, {
          type: 'claim-rejected',
          title: 'Claim not approved',
          message: `The item "${item.name}" has been returned to another claimant, so your claim was closed.`,
          note: 'If you believe this decision was incorrect, please contact the campus lost-and-found team.',
        }]);
      });

      notices.push([claim.user_id, {
        type: 'claim-approved',
        title: 'Claim approved',
        message: `Your claim for "${item.name}" was approved. Collection location: Security Office behind Turing Block.`,
        note: COLLECTION_NOTE,
      }]);
      notices.push([item.user_id, {
        type: 'info',
        title: 'Item returned',
        message: `The "${item.name}" you reported was verified and is being returned to its owner. Thank you for helping!`,
      }]);
    } else {
      decide.run('rejected', req.user.id, claim.id);
      notices.push([claim.user_id, {
        type: 'claim-rejected',
        title: 'Claim not approved',
        message: `Your claim for "${item.name}" could not be verified.`,
        note: 'If you believe this decision was incorrect, please contact the campus lost-and-found team.',
      }]);
    }
  })();

  // Emails go out after the database change is committed.
  notices.forEach(([userId, n]) => notifyUser(userId, n));
  res.json({ ok: true, status: decision === 'approve' ? 'approved' : 'rejected' });
});

adminRouter.get('/items', (req, res) => {
  const rows = db
    .prepare(
      `SELECT ${COLS_I},
              u.email AS owner_email
       FROM items i JOIN users u ON u.id = i.user_id ORDER BY i.created_at DESC, i.id DESC`
    )
    .all();
  res.json({ items: rows.map((r) => ({ ...publicItem(r, req.user), ownerEmail: r.owner_email })) });
});

adminRouter.delete('/items/:id(\\d+)', (req, res) => {
  const info = db.prepare('DELETE FROM items WHERE id = ?').run(Number(req.params.id));
  if (!info.changes) throw new HttpError(404, 'Item not found.', 'not_found');
  res.json({ ok: true });
});

module.exports = { claimsRouter, adminRouter };
