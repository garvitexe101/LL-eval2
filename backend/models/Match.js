const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    lostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    foundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    score: { type: Number, required: true },
    reasons: { type: mongoose.Schema.Types.Mixed, default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

matchSchema.index({ lostId: 1, foundId: 1 }, { unique: true });

matchSchema.virtual('lost_id').get(function () {
  return this.lostId ? this.lostId.toString() : null;
}).set(function (v) {
  this.lostId = v;
});

matchSchema.virtual('found_id').get(function () {
  return this.foundId ? this.foundId.toString() : null;
}).set(function (v) {
  this.foundId = v;
});

module.exports = mongoose.models.Match || mongoose.model('Match', matchSchema);
