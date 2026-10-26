const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['lost', 'found'], required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    colour: { type: String, required: true, trim: true },
    zone: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    time: { type: String, default: null },
    description: { type: String, required: true },
    privateDetail: { type: String, default: null },
    deposit: { type: String, default: null },
    image: { type: String, default: null },
    status: { type: String, enum: ['Open', 'Possible match', 'Returned'], default: 'Open', index: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

itemSchema.virtual('user_id').get(function () {
  return this.userId ? this.userId.toString() : null;
}).set(function (v) {
  this.userId = v;
});

itemSchema.virtual('private_detail').get(function () {
  return this.privateDetail;
}).set(function (v) {
  this.privateDetail = v;
});

itemSchema.virtual('has_image').get(function () {
  return Boolean(this.image);
});

module.exports = mongoose.models.Item || mongoose.model('Item', itemSchema);
