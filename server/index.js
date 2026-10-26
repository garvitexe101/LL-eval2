const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const config = require('./config');
const db = require('./db');
const { loadUser } = require('./middleware');
const { ensureAdmin, seedDemoData } = require('./seed');

ensureAdmin();
seedDemoData();

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  next();
});

app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());
app.use('/api', loadUser);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
const { claimsRouter, adminRouter } = require('./routes/claims');
app.use('/api/admin', adminRouter);
app.use('/api', claimsRouter);
app.use('/api', require('./routes/misc'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.', code: 'not_found' }));

// The frontend lives in /public; nothing outside that folder is ever served.
app.use(express.static(path.join(__dirname, '..', 'public')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong on the server.', code: 'server_error' });
  }
  res.status(status).json({
    error: err.type === 'entity.parse.failed' ? 'Invalid request body.' : err.message,
    code: err.code || 'bad_request',
  });
});

const server = app.listen(config.port, () => {
  console.log(`LostLink running at http://localhost:${config.port}`);
  if (config.jwtSecretIsRandom) console.log('Note: JWT_SECRET not set - sessions reset on every restart.');
  if (!config.smtp.host) console.log('Note: SMTP not configured - emails are printed to this console.');
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
