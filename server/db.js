const mongoose = require('mongoose');
const config = require('./config');

const toIso = (d) => {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  try {
    return new Date(d).toISOString();
  } catch {
    return String(d);
  }
};

/* ----------------- User Schema ----------------- */
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

/* ----------------- Item Schema ----------------- */
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

/* ----------------- Claim Schema ----------------- */
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

/* ----------------- Match Schema ----------------- */
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

/* ----------------- Notification Schema ----------------- */
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

/* ----------------- Models ----------------- */
const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);
const Claim = mongoose.model('Claim', claimSchema);
const Match = mongoose.model('Match', matchSchema);
const Notification = mongoose.model('Notification', notificationSchema);

async function connectDB() {
  try {
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`Connected to MongoDB at ${config.mongodbUri}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    console.error('Make sure MongoDB is running locally or provide a valid MONGODB_URI in .env');
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = {
  mongoose,
  connectDB,
  disconnectDB,
  toIso,
  User,
  Item,
  Claim,
  Match,
  Notification,
};
