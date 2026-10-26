const nodemailer = require('nodemailer');
const config = require('./config');

const useSmtp = Boolean(config.smtp.host || config.smtp.user);

function createTransporter() {
  if (!useSmtp) return null;

  const host = (config.smtp.host || '').toLowerCase();
  const user = (config.smtp.user || '').toLowerCase();
  const rawPass = config.smtp.pass || '';
  const cleanPass = rawPass.includes(' ') && rawPass.length === 19 ? rawPass.replace(/\s+/g, '') : rawPass;
  const isGmail = host.includes('gmail') || user.endsWith('@gmail.com');

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.smtp.user,
        pass: cleanPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: cleanPass } : undefined,
    tls: {
      rejectUnauthorized: false,
    },
  });
}

const transporter = createTransporter();

// Verify connection on startup if configured
if (transporter) {
  transporter.verify((err) => {
    if (err) {
      console.warn(`[email:warning] SMTP verification note: ${err.message}`);
    } else {
      console.log(`[email] SMTP transporter ready (sending via ${config.smtp.user || config.smtp.host})`);
    }
  });
}

/** Fire-and-forget email. Never throws; without SMTP settings it prints to the console. */
async function send(to, subject, text, html = null) {
  if (!to || /\.invalid$/i.test(to)) return false;

  const sender =
    config.smtp.from && !config.smtp.from.includes('.local')
      ? config.smtp.from
      : config.smtp.user
      ? `LostLink <${config.smtp.user}>`
      : 'LostLink <no-reply@chitkara.edu>';

  if (!transporter) {
    console.log(`[email:console] to=${to} subject="${subject}"\n${text}\n`);
    return true;
  }

  try {
    const mailOptions = {
      from: sender,
      to,
      subject,
      text,
    };
    if (html) {
      mailOptions.html = html;
    }
    const info = await transporter.sendMail(mailOptions);
    console.log(`[email:sent] to=${to} messageId=${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[email:error] Failed to send email to ${to}: ${err.message}`);
    console.log(`[email:fallback-console] to=${to} subject="${subject}"\n${text}\n`);
    return false;
  }
}

module.exports = { send, transporter };
