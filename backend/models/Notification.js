const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    note: { type: String, default: null },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

notificationSchema.virtual('user_id').get(function () {
  return this.userId ? this.userId.toString() : null;
}).set(function (v) {
  this.userId = v;
});

notificationSchema.virtual('is_read').get(function () {
  return this.isRead ? 1 : 0;
}).set(function (v) {
  this.isRead = Boolean(v);
});

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
