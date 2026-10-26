const bcrypt = require('bcryptjs');
const { User } = require('../models');
const config = require('../config/config');
const { HttpError, str } = require('../http');
const { issueToken, clearToken } = require('../middleware');
const { verifyFirebaseIdToken, getClientConfig } = require('../firebase');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[\p{L}][\p{L} .'-]*$/u;

const sessionUser = (u) => ({
  id: u.id || u._id?.toString(),
  name: u.name,
  email: u.email,
  role: u.role,
});

function cleanEmail(value) {
  const email = str(value, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address.', 'invalid_email');
  if (config.restrictEmailDomain) {
    const domain = email.split('@')[1];
    if (!config.allowedEmailDomains.includes(domain)) {
      throw new HttpError(400, 'Use your Chitkara University email (@chitkara.edu.in).', 'invalid_email');
    }
  }
  return email;
}

exports.getMe = (req, res) => {
  res.json({ user: req.user ? sessionUser(req.user) : null });
};

exports.getFirebaseConfig = (req, res) => {
  res.json(getClientConfig());
};

exports.firebaseLogin = async (req, res, next) => {
  try {
    const idToken = req.body && req.body.idToken;
    if (!idToken) throw new HttpError(400, 'Missing Firebase ID token.', 'missing_token');

    const decoded = await verifyFirebaseIdToken(idToken);
    if (!decoded || !decoded.email) {
      throw new HttpError(400, 'Firebase user must have an email associated.', 'no_email');
    }

    const email = cleanEmail(decoded.email);
    const displayName = str(req.body.name || decoded.name || email.split('@')[0], 60);

    let user = await User.findOne({
      $or: [{ firebaseUid: decoded.uid }, { email }],
    });

    if (user) {
      let modified = false;
      if (!user.firebaseUid) {
        user.firebaseUid = decoded.uid;
        modified = true;
      }
      if (displayName && (!user.name || user.name === 'Campus User')) {
        user.name = displayName;
        modified = true;
      }
      if (email === config.admin.email && user.role !== 'admin') {
        user.role = 'admin';
        modified = true;
      }
      if (modified) await user.save();
    } else {
      const role = email === config.admin.email ? 'admin' : 'student';
      user = await User.create({
        name: displayName,
        email,
        passwordHash: 'FIREBASE_AUTH',
        role,
        firebaseUid: decoded.uid,
      });
    }

    issueToken(res, user);
    res.json({ user: sessionUser(user) });
  } catch (err) {
    next(err);
  }
};

exports.register = async (req, res, next) => {
  try {
    const name = str(req.body.name, 60);
    const email = cleanEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (name.length < 3 || !NAME_RE.test(name)) {
      throw new HttpError(400, 'Name must be at least 3 letters (letters and spaces only).', 'invalid_name');
    }
    if (password.length < 6 || password.length > 72) {
      throw new HttpError(400, 'Password must be between 6 and 72 characters.', 'invalid_password');
    }

    const existing = await User.findOne({ email });
    if (existing) {
      throw new HttpError(409, 'An account with this email already exists. Sign in instead.', 'email_taken');
    }

    const user = await User.create({
      name,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'student',
    });

    issueToken(res, user);
    res.status(201).json({ user: sessionUser(user) });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const email = str(req.body.email, 120).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) throw new HttpError(400, 'Email and password are required.', 'invalid_credentials');

    const user = await User.findOne({ email });
    if (!user) throw new HttpError(404, 'No account found for this email.', 'no_account');
    if (!bcrypt.compareSync(password, user.passwordHash)) {
      throw new HttpError(401, 'Incorrect email or password.', 'invalid_credentials');
    }

    issueToken(res, user);
    res.json({ user: sessionUser(user) });
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res) => {
  clearToken(res);
  res.json({ ok: true });
};
