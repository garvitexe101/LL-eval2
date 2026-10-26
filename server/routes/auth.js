const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { HttpError, str } = require('../http');
const { issueToken, clearToken, rateLimit } = require('../middleware');
const { verifyFirebaseIdToken, getClientConfig } = require('../firebase');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[\p{L}][\p{L} .'-]*$/u;

const sessionUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

function cleanEmail(value) {
  const email = str(value, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address.', 'invalid_email');
  if (config.restrictEmailDomain) {
    const domain = email.split('@')[1];
    if (!config.allowedEmailDomains.includes(domain)) {
      throw new HttpError(400, 'Use your Chitkara University email.', 'invalid_email');
    }
  }
  return email;
}

router.get('/me', (req, res) => {
  res.json({ user: req.user ? sessionUser(req.user) : null });
});

router.get('/firebase-config', (req, res) => {
  res.json(getClientConfig());
});

router.post('/firebase-login', limiter, async (req, res, next) => {
  try {
    const idToken = req.body && req.body.idToken;
    if (!idToken) throw new HttpError(400, 'Missing Firebase ID token.', 'missing_token');

    const decoded = await verifyFirebaseIdToken(idToken);
    if (!decoded || !decoded.email) {
      throw new HttpError(400, 'Firebase user must have an email associated.', 'no_email');
    }

    const email = cleanEmail(decoded.email);
    const displayName = str(req.body.name || decoded.name || email.split('@')[0], 60);

    // Look for existing user by firebase_uid or email
    let user = db
      .prepare('SELECT id, name, email, role, firebase_uid FROM users WHERE firebase_uid = ? OR email = ?')
      .get(decoded.uid, email);

    if (user) {
      const updates = [];
      const params = [];
      if (!user.firebase_uid) {
        updates.push('firebase_uid = ?');
        params.push(decoded.uid);
      }
      if (displayName && (!user.name || user.name === 'Campus User')) {
        updates.push('name = ?');
        params.push(displayName);
      }
      if (email === config.admin.email && user.role !== 'admin') {
        updates.push("role = 'admin'");
      }
      if (updates.length > 0) {
        params.push(user.id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(user.id);
      }
    } else {
      const role = email === config.admin.email ? 'admin' : 'student';
      const info = db
        .prepare('INSERT INTO users (name, email, password_hash, role, firebase_uid) VALUES (?, ?, ?, ?, ?)')
        .run(displayName, email, 'FIREBASE_AUTH', role, decoded.uid);
      user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(info.lastInsertRowid);
    }

    issueToken(res, user);
    res.json({ user: sessionUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/register', limiter, (req, res) => {
  const name = str(req.body.name, 60);
  const email = cleanEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (name.length < 3 || !NAME_RE.test(name)) {
    throw new HttpError(400, 'Name must be at least 3 letters (letters and spaces only).', 'invalid_name');
  }
  if (password.length < 6 || password.length > 72) {
    throw new HttpError(400, 'Password must be between 6 and 72 characters.', 'invalid_password');
  }
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw new HttpError(409, 'An account with this email already exists. Sign in instead.', 'email_taken');
  }

  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email, bcrypt.hashSync(password, 10), 'student');
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(info.lastInsertRowid);

  issueToken(res, user);
  res.status(201).json({ user: sessionUser(user) });
});

router.post('/login', limiter, (req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) throw new HttpError(400, 'Email and password are required.', 'invalid_credentials');

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row) throw new HttpError(404, 'No account found for this email.', 'no_account');
  if (!bcrypt.compareSync(password, row.password_hash)) {
    throw new HttpError(401, 'Incorrect email or password.', 'invalid_credentials');
  }

  issueToken(res, row);
  res.json({ user: sessionUser(row) });
});

router.post('/logout', (req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

module.exports = router;
