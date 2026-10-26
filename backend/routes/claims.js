const express = require('express');
const claimController = require('../controllers/claimController');
const { requireAuth, requireAdmin } = require('../middleware');

const claimsRouter = express.Router();
claimsRouter.post('/items/:id/claims', requireAuth, claimController.submitClaim);
claimsRouter.get('/claims/mine', requireAuth, claimController.getMyClaims);

const adminRouter = express.Router();
adminRouter.use(requireAdmin);
adminRouter.get('/overview', claimController.getAdminOverview);
adminRouter.get('/claims', claimController.getAdminClaims);
adminRouter.post('/claims/:id/decision', claimController.decideClaim);
adminRouter.get('/items', claimController.getAdminItems);
adminRouter.delete('/items/:id', claimController.deleteAdminItem);

module.exports = { claimsRouter, adminRouter };
