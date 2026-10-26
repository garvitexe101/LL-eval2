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

let memoryServer = null;

async function connectDB() {
  const isRemote = config.mongodbUri.includes('+srv') ||
    (process.env.MONGODB_URI &&
     !process.env.MONGODB_URI.includes('127.0.0.1') &&
     !process.env.MONGODB_URI.includes('localhost'));

  try {
    console.log(`Attempting MongoDB connection: ${config.mongodbUri.replace(/:([^:@]+)@/, ':****@')} ...`);
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 2500,
    });
    console.log('Connected to MongoDB successfully!');
    return;
  } catch (err) {
    if (isRemote) {
      console.error('Failed to connect to remote MongoDB URI:', err.message);
      return;
    }
    console.log('Local MongoDB daemon not detected. Initializing embedded local MongoDB...');
  }

  // Fallback to MongoMemoryServer for instant, zero-install localhost testing
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'lostlink',
      },
    });
    const memoryUri = memoryServer.getUri();
    await mongoose.connect(memoryUri);
    console.log('Embedded MongoDB engine connected successfully for localhost!');
  } catch (memErr) {
    console.error('Embedded MongoDB start error:', memErr.message);
  }
}

async function disconnectDB() {
  try {
    await mongoose.disconnect();
    if (memoryServer) {
      await memoryServer.stop();
    }
  } catch (err) {
    console.error('disconnectDB error:', err.message);
  }
}

module.exports = {
  mongoose,
  connectDB,
  disconnectDB,
  toIso,
};
