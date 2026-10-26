const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    firebaseUid: { type: String, default: null, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.virtual('password_hash').get(function () {
  return this.passwordHash;
}).set(function (v) {
  this.passwordHash = v;
});

userSchema.virtual('firebase_uid').get(function () {
  return this.firebaseUid;
}).set(function (v) {
  this.firebaseUid = v;
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
