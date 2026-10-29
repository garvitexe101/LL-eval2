const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, Item } = require('./db');
const config = require('./config');

async function ensureAdmin() {
  const { email, password, name } = config.admin;
  try {
    const existing = await User.findOne({ email });
    if (!password) {
      console.warn('ADMIN_PASSWORD is not set; set it in the environment before creating or rotating the admin password.');
      if (existing && existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save();
      }
      return;
    }

    if (!existing) {
      await User.create({
        name,
        email,
        passwordHash: bcrypt.hashSync(password, 10),
        role: 'admin',
      });
      console.log('Created admin account: ' + email);
    } else {
      let changed = false;
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        changed = true;
      }
      const passwordMatches = existing.passwordHash &&
        existing.passwordHash !== 'FIREBASE_AUTH' &&
        bcrypt.compareSync(password, existing.passwordHash);
      if (!passwordMatches) {
        existing.passwordHash = bcrypt.hashSync(password, 10);
        changed = true;
      }
      if (changed) await existing.save();
    }
  } catch (err) {
    console.error(`ensureAdmin error: ${err.message}`);
  }
}

async function seedDemoData() {
  if (!config.seedDemoData) return;
  try {
    const count = await Item.countDocuments();
    if (count > 0) return;

    const demoEmail = 'lostlink.demo@chitkara.invalid';
    let demo = await User.findOne({ email: demoEmail });
    if (!demo) {
      demo = await User.create({
        name: 'Demo Student',
        email: demoEmail,
        passwordHash: bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10),
        role: 'student',
      });
    }

    const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const demoItems = [
      {
        userId: demo._id,
        type: 'found',
        name: 'AirPods Pro Case',
        category: 'Electronics',
        colour: 'White',
        zone: 'Rockfellar',
        date: daysAgo(2),
        description: 'White charging case with a small mark near the hinge.',
        privateDetail: 'tiny sticker inside',
        deposit: 'Security Office',
        status: 'Open',
      },
      {
        userId: demo._id,
        type: 'found',
        name: 'Black Leather Wallet',
        category: 'Bags',
        colour: 'Black',
        zone: 'Square One',
        date: daysAgo(2),
        description: 'Slim black wallet found close to the seating area.',
        privateDetail: 'three cards inside',
        deposit: 'With finder',
        status: 'Open',
      },
      {
        userId: demo._id,
        type: 'lost',
        name: 'University ID Card',
        category: 'ID / Card',
        colour: 'Blue',
        zone: 'Martin Luther',
        date: daysAgo(3),
        description: 'Blue lanyard with an engineering student ID card.',
        privateDetail: 'roll number begins 22',
        deposit: null,
        status: 'Open',
      },
      {
        userId: demo._id,
        type: 'found',
        name: 'Set of Keys',
        category: 'Keys',
        colour: 'Other / Multicolour',
        zone: 'Sportorium',
        date: daysAgo(3),
        description: 'Three keys and a bright yellow key ring.',
        privateDetail: 'yellow rubber duck keychain',
        deposit: 'Reception',
        status: 'Open',
      },
      {
        userId: demo._id,
        type: 'found',
        name: 'Blue Water Bottle',
        category: 'Other',
        colour: 'Blue',
        zone: 'Alpha Zone',
        date: daysAgo(6),
        description: 'Steel water bottle with a dented base.',
        privateDetail: 'initials scratched under the lid',
        deposit: 'Security Office',
        status: 'Returned',
      },
    ];

    await Item.insertMany(demoItems);
    console.log('Seeded demo reports.');
  } catch (err) {
    console.error(`seedDemoData error: ${err.message}`);
  }
}

module.exports = { ensureAdmin, seedDemoData };
