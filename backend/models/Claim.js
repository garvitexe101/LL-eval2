const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

claimSchema.virtual('item_id').get(function () {
  return this.itemId ? this.itemId.toString() : null;
}).set(function (v) {
  this.itemId = v;
});

claimSchema.virtual('user_id').get(function () {
  return this.userId ? this.userId.toString() : null;
}).set(function (v) {
  this.userId = v;
});

claimSchema.virtual('decided_by').get(function () {
  return this.decidedBy ? this.decidedBy.toString() : null;
}).set(function (v) {
  this.decidedBy = v;
});

claimSchema.virtual('decided_at').get(function () {
  return this.decidedAt;
}).set(function (v) {
  this.decidedAt = v;
});

module.exports = mongoose.models.Claim || mongoose.model('Claim', claimSchema);
