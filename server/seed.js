const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./db');
const config = require('./config');

function ensureAdmin() {
  const { email, password, name } = config.admin;
  const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);
  if (!existing) {
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
      name,
      email,
      bcrypt.hashSync(password, 10),
      'admin'
    );
    console.log(`Created admin account: ${email}`);
  } else if (existing.role !== 'admin') {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
  }
}

function seedDemoData() {
  if (!config.seedDemoData) return;
  if (db.prepare('SELECT COUNT(*) AS n FROM items').get().n > 0) return;

  const demoEmail = 'lostlink.demo@chitkara.invalid';
  let demo = db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail);
  if (!demo) {
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run('Demo Student', demoEmail, bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10), 'student');
    demo = { id: info.lastInsertRowid };
  }

  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const rows = [
    ['found', 'AirPods Pro Case', 'Electronics', 'White', 'Rockfellar', daysAgo(2),
      'White charging case with a small mark near the hinge.', 'tiny sticker inside', 'Security Office', 'Open'],
    ['found', 'Black Leather Wallet', 'Bags', 'Black', 'Square One', daysAgo(2),
      'Slim black wallet found close to the seating area.', 'three cards inside', 'With finder', 'Open'],
    ['lost', 'University ID Card', 'ID / Card', 'Blue', 'Martin Luther', daysAgo(3),
      'Blue lanyard with an engineering student ID card.', 'roll number begins 22', null, 'Open'],
    ['found', 'Set of Keys', 'Keys', 'Other / Multicolour', 'Sportorium', daysAgo(3),
      'Three keys and a bright yellow key ring.', 'yellow rubber duck keychain', 'Reception', 'Open'],
    ['found', 'Blue Water Bottle', 'Other', 'Blue', 'Alpha Zone', daysAgo(6),
      'Steel water bottle with a dented base.', 'initials scratched under the lid', 'Security Office', 'Returned'],
  ];

  const insert = db.prepare(
    `INSERT INTO items (user_id, type, name, category, colour, zone, date, description, private_detail, deposit, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  db.transaction(() => rows.forEach((r) => insert.run(demo.id, ...r)))();
  console.log('Seeded demo reports.');
}

module.exports = { ensureAdmin, seedDemoData };
