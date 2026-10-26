const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  firebase_uid  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('lost', 'found')),
  name           TEXT NOT NULL,
  category       TEXT NOT NULL,
  colour         TEXT NOT NULL,
  zone           TEXT NOT NULL,
  date           TEXT NOT NULL,
  time           TEXT,
  description    TEXT NOT NULL,
  private_detail TEXT,
  deposit        TEXT,
  image          TEXT,
  status         TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Possible match', 'Returned')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_items_type_status ON items(type, status);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);

CREATE TABLE IF NOT EXISTS claims (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_claims_item ON claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_user ON claims(user_id);

CREATE TABLE IF NOT EXISTS matches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lost_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  found_id   INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL,
  reasons    TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (lost_id, found_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  note       TEXT,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
`);

// Safe column addition for existing databases
try {
  const cols = db.pragma('table_info(users)').map((c) => c.name);
  if (!cols.includes('firebase_uid')) {
    db.exec('ALTER TABLE users ADD COLUMN firebase_uid TEXT');
  }
} catch (e) {
  // Ignore migration error if already present
}

db.exec('CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);');

// SQLite stores datetime('now') as "YYYY-MM-DD HH:MM:SS" in UTC.
db.toIso = (s) => (s ? `${String(s).replace(' ', 'T')}Z` : null);

module.exports = db;
