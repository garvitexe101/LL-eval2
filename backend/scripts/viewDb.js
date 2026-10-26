const { mongoose, connectDB, disconnectDB } = require('../config/db');
const { User, Item, Claim, Match, Notification } = require('../models');

async function viewDatabase() {
  console.log('Connecting to database...\n');
  await connectDB();

  console.log('==================================================');
  console.log('             LOSTLINK DATABASE OVERVIEW           ');
  console.log('==================================================\n');

  // 1. Users
  const users = await User.find().select('-passwordHash');
  console.log(`📌 USERS COLLECTION (${users.length} documents):`);
  console.table(users.map(u => ({
    ID: u._id.toString(),
    Name: u.name,
    Email: u.email,
    Role: u.role,
    Created: u.createdAt ? u.createdAt.toISOString().slice(0, 10) : ''
  })));

  // 2. Items
  const items = await Item.find().select('-image');
  console.log(`\n📌 ITEMS COLLECTION (${items.length} documents):`);
  console.table(items.map(i => ({
    ID: i._id.toString(),
    Type: i.type,
    Name: i.name,
    Category: i.category,
    Colour: i.colour,
    Zone: i.zone,
    Status: i.status
  })));

  // 3. Claims
  const claims = await Claim.find();
  console.log(`\n📌 CLAIMS COLLECTION (${claims.length} documents):`);
  if (claims.length === 0) {
    console.log('  (No claims submitted yet)');
  } else {
    console.table(claims.map(c => ({
      ID: c._id.toString(),
      ItemID: c.itemId.toString(),
      UserID: c.userId.toString(),
      Status: c.status
    })));
  }

  // 4. Matches
  const matches = await Match.find();
  console.log(`\n📌 MATCHES COLLECTION (${matches.length} documents):`);
  if (matches.length === 0) {
    console.log('  (No matches calculated yet)');
  } else {
    console.table(matches.map(m => ({
      ID: m._id.toString(),
      LostID: m.lostId.toString(),
      FoundID: m.foundId.toString(),
      Score: `${m.score}%`,
      Reasons: Array.isArray(m.reasons) ? m.reasons.join(', ') : m.reasons
    })));
  }

  // 5. Notifications
  const notifications = await Notification.find();
  console.log(`\n📌 NOTIFICATIONS COLLECTION (${notifications.length} documents):`);
  if (notifications.length === 0) {
    console.log('  (No notifications sent yet)');
  } else {
    console.table(notifications.map(n => ({
      ID: n._id.toString(),
      UserID: n.userId.toString(),
      Type: n.type,
      Title: n.title,
      Read: n.isRead ? 'Yes' : 'No'
    })));
  }

  console.log('\n==================================================\n');
  await disconnectDB();
}

viewDatabase().catch(err => {
  console.error('Database view error:', err);
  process.exit(1);
});
