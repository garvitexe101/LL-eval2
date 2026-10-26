const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const env = process.env;
const bool = (v, fallback) => (v === undefined || v === '' ? fallback : String(v).toLowerCase() === 'true');
const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : fallback);

// Approximate zone-level coordinates for Chitkara University, Rajpura.
// Markers are intentionally zone-level (not exact spots). Adjust freely.
const zones = [
  { name: 'Square One', lat: 30.5163, lng: 76.6602 },
  { name: 'Tesla Block', lat: 30.5171, lng: 76.6589 },
  { name: 'Turing Block', lat: 30.5176, lng: 76.6610 },
  { name: 'Hostel Area', lat: 30.5149, lng: 76.6624 },
  { name: 'Martin Luther', lat: 30.5158, lng: 76.6585 },
  { name: 'Rockfellar', lat: 30.5167, lng: 76.6617 },
  { name: 'Alpha Zone', lat: 30.5154, lng: 76.6598 },
  { name: 'Omega Zone', lat: 30.5146, lng: 76.6607 },
  { name: 'Sportorium', lat: 30.5139, lng: 76.6591 },
  { name: 'Explotorium', lat: 30.5180, lng: 76.6599 },
];

module.exports = {
  port: num(env.PORT, 3000),
  publicUrl: (env.PUBLIC_URL || `http://localhost:${num(env.PORT, 3000)}`).replace(/\/$/, ''),
  dbPath: path.resolve(env.DB_PATH || path.join(__dirname, '..', 'data', 'lostlink.db')),
  jwtSecret: env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  jwtSecretIsRandom: !env.JWT_SECRET,
  secureCookies: bool(env.COOKIE_SECURE, false),
  admin: {
    email: (env.ADMIN_EMAIL || 'admin@chitkara.edu').trim().toLowerCase(),
    password: env.ADMIN_PASSWORD || 'admin123',
    name: env.ADMIN_NAME || 'Campus Admin',
  },
  seedDemoData: bool(env.SEED_DEMO_DATA, true),
  match: {
    min: num(env.MATCH_MIN_SCORE, 50),
    strong: num(env.MATCH_STRONG_SCORE, 70),
    weights: {
      category: num(env.MATCH_WEIGHT_CATEGORY, 25),
      zone: num(env.MATCH_WEIGHT_ZONE, 25),
      colour: num(env.MATCH_WEIGHT_COLOUR, 15),
      date: num(env.MATCH_WEIGHT_DATE, 15),
      text: num(env.MATCH_WEIGHT_TEXT, 20),
    },
  },
  smtp: {
    host: (env.SMTP_HOST || '').trim(),
    port: num(env.SMTP_PORT, 587),
    secure: bool(env.SMTP_SECURE, false),
    user: (env.SMTP_USER || '').trim(),
    pass: (env.SMTP_PASS || '').trim(),
    from: (env.MAIL_FROM || '').trim() || ((env.SMTP_USER || '').trim() ? `LostLink <${(env.SMTP_USER || '').trim()}>` : 'LostLink <no-reply@lostlink.local>'),
  },
  allowedEmailDomains: ['chitkara.edu', 'chitkara.edu.in'],
  restrictEmailDomain: bool(env.RESTRICT_EMAIL_DOMAIN, false),
  firebase: {
    // Client-side web config (accessible by frontend)
    apiKey: env.FIREBASE_API_KEY || '',
    authDomain: env.FIREBASE_AUTH_DOMAIN || '',
    projectId: env.FIREBASE_PROJECT_ID || '',
    storageBucket: env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.FIREBASE_APP_ID || '',

    // Server-side Admin SDK credentials (optional / fallback)
    serviceAccountPath: env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
    clientEmail: env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  },
  zones,
  campusCenter: { lat: 30.5159, lng: 76.6601 },
  categories: ['Electronics', 'ID / Card', 'Bags', 'Keys', 'Clothing', 'Books', 'Other'],
  colours: ['Black', 'White', 'Blue', 'Brown', 'Red', 'Other / Multicolour'],
  deposits: ['With finder', 'Security Office', 'Reception'],
};
