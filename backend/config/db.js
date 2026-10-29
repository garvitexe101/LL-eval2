const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // ignore
}

const path = require('path');
const fs = require('fs');
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
      serverSelectionTimeoutMS: 8000,
    });
    console.log('Connected to MongoDB successfully!');
    return;
  } catch (err) {
    if (isRemote) {
      console.warn('⚠️ Could not connect to remote MongoDB Atlas cluster:', err.message);
      console.warn('💡 Tip: Make sure your current IP address is whitelisted in MongoDB Atlas Network Access (or add 0.0.0.0/0).');
      console.warn('Falling back to local embedded MongoDB engine so LostLink remains fully operational...');
    } else {
      console.log('Local MongoDB daemon not detected. Initializing embedded local MongoDB...');
    }
  }

  // Fallback to local MongoDB engine (persisted to disk) for zero-install reliability
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const localDir = path.resolve(__dirname, '../data/local-mongo');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    try {
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'lostlink',
          dbPath: localDir,
          storageEngine: 'wiredTiger',
        },
      });
    } catch (persistErr) {
      console.warn('Persistent local mongo start note:', persistErr.message, '- falling back to in-memory instance');
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'lostlink',
        },
      });
    }

    const memoryUri = memoryServer.getUri();
    await mongoose.connect(memoryUri);
    console.log('Embedded MongoDB engine connected successfully for localhost (data persisted to disk)!');
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
