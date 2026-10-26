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

async function connectDB() {
  try {
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`Connected to MongoDB at ${config.mongodbUri}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    console.error('Make sure MongoDB is running locally or set MONGODB_URI in .env');
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
};
