const express = require('express');
const { Item, Claim, User, toIso, Match } = require('../db');
const config = require('../config');
const { HttpError, str } = require('../http');
const { requireAuth, requireAdmin } = require('../middleware');
const { publicItem, getItem } = require('../itemModel');
const { notifyUser } = require('../notify');

const COLLECTION_NOTE =
  'Please carry your valid Student ID while visiting the Security Office to collect the item.';

/* ---------- Student-facing: submit and list own claims ---------- */

const claimsRouter = express.Router();

claimsRouter.post('/items/:id/claims', requireAuth, async (req, res, next) => {
  try {
    const item = await getItem(req.params.id);
    if (!item) throw new HttpError(404, 'Item not found.', 'not_found');
    if (item.type !== 'found') throw new HttpError(400, 'Only found items can be claimed.', 'validation');
    if (item.status === 'Returned') throw new HttpError(400, 'This item has already been returned.', 'validation');

    const itemUserId = (item.userId?._id || item.userId || item.user_id)?.toString();
    const reqUserId = (req.user._id || req.user.id)?.toString();
    if (itemUserId === reqUserId) throw new HttpError(400, 'You cannot claim your own report.', 'validation');

    const pending = await Claim.findOne({
      itemId: item._id,
      userId: req.user._id,
      status: 'pending',
    });
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

    const claim = await Claim.create({
      itemId: item._id,
      userId: req.user._id,
      answers,
    });

    const admins = await User.find({ role: 'admin' });
    admins.forEach((a) =>
      notifyUser(a._id, {
        type: 'info',
        title: 'New claim to review',
        message: `${req.user.name} submitted a claim for "${item.name}".`,
        link: `${config.publicUrl}/admin.html`,
      })
    );

    res.status(201).json({ claim: { id: claim.id, status: 'pending' } });
  } catch (err) {
    next(err);
  }
});

claimsRouter.get('/claims/mine', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const rows = await Claim.find({ userId }).sort({ createdAt: -1, _id: -1 });

    res.json({
      claims: rows.map((r) => ({
        id: r.id,
        itemId: r.itemId ? r.itemId.toString() : null,
        status: r.status,
        createdAt: toIso(r.createdAt),
        decidedAt: toIso(r.decidedAt),
      })),
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- Admin: every route below is checked on the server ---------- */

const adminRouter = express.Router();
adminRouter.use(requireAdmin);

adminRouter.get('/overview', async (req, res, next) => {
  try {
    const [activeReports, returnedItems, possibleMatches, pendingClaims] = await Promise.all([
      Item.countDocuments({ status: { $ne: 'Returned' } }),
      Item.countDocuments({ status: 'Returned' }),
      Item.countDocuments({ status: 'Possible match' }),
      Claim.countDocuments({ status: 'pending' }),
    ]);

    res.json({
      activeReports,
      returnedItems,
      possibleMatches,
      pendingClaims,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/claims', async (req, res, next) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const rows = await Claim.find({ status })
      .populate('userId')
      .populate({
        path: 'itemId',
        populate: { path: 'userId' },
      })
      .sort({ createdAt: 1, _id: 1 });

    const claims = rows.map((r) => {
      const item = r.itemId;
      const claimant = r.userId;
      const finder = item && item.userId;

      return {
        id: r.id,
        status: r.status,
        createdAt: toIso(r.createdAt),
        answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers,
        claimant: claimant ? { name: claimant.name, email: claimant.email } : { name: 'Unknown', email: '' },
        item: item
          ? {
              ...publicItem(item, req.user),
              privateDetail: item.privateDetail || item.private_detail || '',
              finder: finder ? { name: finder.name, email: finder.email } : { name: 'Unknown', email: '' },
            }
          : null,
      };
    });

    res.json({ claims });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/claims/:id/decision', async (req, res, next) => {
  try {
    const decision = str(req.body.decision, 10);
    if (!['approve', 'reject'].includes(decision)) {
      throw new HttpError(400, 'Decision must be approve or reject.', 'validation');
    }

    const claim = await Claim.findById(req.params.id);
    if (!claim) throw new HttpError(404, 'Claim not found.', 'not_found');
    if (claim.status !== 'pending') throw new HttpError(409, 'This claim has already been decided.', 'already_decided');

    const item = await Item.findById(claim.itemId);
    if (!item) throw new HttpError(404, 'Associated item not found.', 'not_found');

    const adminId = req.user._id || req.user.id;
    const notices = [];

    if (decision === 'approve') {
      claim.status = 'approved';
      claim.decidedBy = adminId;
      claim.decidedAt = new Date();
      await claim.save();

      item.status = 'Returned';
      await item.save();

      // Reject all other pending claims on this item
      const others = await Claim.find({
        itemId: item._id,
        status: 'pending',
        _id: { $ne: claim._id },
      });

      for (const o of others) {
        o.status = 'rejected';
        o.decidedBy = adminId;
        o.decidedAt = new Date();
        await o.save();

        notices.push([
          o.userId,
          {
            type: 'claim-rejected',
            title: 'Claim not approved',
            message: `The item "${item.name}" has been returned to another claimant, so your claim was closed.`,
            note: 'If you believe this decision was incorrect, please contact the campus lost-and-found team.',
          },
        ]);
      }

      notices.push([
        claim.userId,
        {
          type: 'claim-approved',
          title: 'Claim approved',
          message: `Your claim for "${item.name}" was approved. Collection location: Security Office behind Turing Block.`,
          note: COLLECTION_NOTE,
        },
      ]);

      notices.push([
        item.userId,
        {
          type: 'info',
          title: 'Item returned',
          message: `The "${item.name}" you reported was verified and is being returned to its owner. Thank you for helping!`,
        },
      ]);
    } else {
      claim.status = 'rejected';
      claim.decidedBy = adminId;
      claim.decidedAt = new Date();
      await claim.save();

      notices.push([
        claim.userId,
        {
          type: 'claim-rejected',
          title: 'Claim not approved',
          message: `Your claim for "${item.name}" could not be verified.`,
          note: 'If you believe this decision was incorrect, please contact the campus lost-and-found team.',
        },
      ]);
    }

    // Send notifications after saving
    notices.forEach(([userId, n]) => notifyUser(userId, n));

    res.json({ ok: true, status: decision === 'approve' ? 'approved' : 'rejected' });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/items', async (req, res, next) => {
  try {
    const rows = await Item.find().populate('userId').sort({ createdAt: -1, _id: -1 });

    res.json({
      items: rows.map((r) => ({
        ...publicItem(r, req.user),
        ownerEmail: r.userId ? r.userId.email : '',
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/items/:id', async (req, res, next) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) throw new HttpError(404, 'Item not found.', 'not_found');

    await Claim.deleteMany({ itemId: req.params.id });
    await Match.deleteMany({ $or: [{ lostId: req.params.id }, { foundId: req.params.id }] });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = { claimsRouter, adminRouter };
