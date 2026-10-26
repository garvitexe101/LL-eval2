const db = require('./db');
const mailer = require('./mailer');
const config = require('./config');

/** Stores a general in-app notification and emails the user. */
function notifyUser(userId, { type, title, message, note = null, link = null }) {
  db.prepare(
    'INSERT INTO notifications (user_id, type, title, message, note) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, type, title, message, note);

  const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId);
  if (!user) return;

  const body = [`Hi ${user.name},`, '', message];
  if (note) body.push('', note);
  if (link) body.push('', link);
  body.push('', '— LostLink, Chitkara University');
  mailer.send(user.email, `LostLink: ${title}`, body.join('\n'));
}

/**
 * Sends detailed match notifications and emails to both the lost item owner and finder,
 * providing comprehensive report details, match reasons, and mutual contact info.
 */
function notifyMatch({ lost, found, score, reasons }) {
  const lostUser = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(lost.user_id);
  const foundUser = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(found.user_id);
  if (!lostUser || !foundUser) return;

  const itemUrl = `${config.publicUrl}/item.html?id=${found.id}`;
  const reasonsText = Array.isArray(reasons) ? reasons.join(' · ') : String(reasons);

  // ==========================================
  // 1. NOTIFY OWNER OF THE LOST ITEM
  // ==========================================
  const lostInAppMsg = `A found report "${found.name}" at ${found.zone} looks like a ${score}% match for your lost "${lost.name}". Finder contact: ${foundUser.name} (${foundUser.email}).`;
  db.prepare('INSERT INTO notifications (user_id, type, title, message, note) VALUES (?, ?, ?, ?, ?)')
    .run(
      lostUser.id,
      'match',
      `Match found for "${lost.name}" (${score}%)`,
      lostInAppMsg,
      `Contact finder directly at: ${foundUser.email}`
    );

  const lostEmailText = `Hi ${lostUser.name},

Good news! A ${score}% match was detected for the item you reported lost on campus.

============================================================
YOUR REPORTED ITEM (LOST):
============================================================
- Item Name: ${lost.name}
- Category: ${lost.category}
- Colour: ${lost.colour}
- Last Seen Location: ${lost.zone} on ${lost.date}${lost.time ? ' at ' + lost.time : ''}
- Your Description: ${lost.description}

============================================================
MATCHING FOUND ITEM DETAILS:
============================================================
- Item Found: ${found.name}
- Category: ${found.category}
- Colour: ${found.colour}
- Found At: ${found.zone} on ${found.date}${found.time ? ' at ' + found.time : ''}
- Finder's Notes: ${found.description}
- Current Item Custody: ${found.deposit || 'With finder'}
- Match Factors: ${reasonsText}

============================================================
GET IN TOUCH WITH THE FINDER:
============================================================
The person who reported finding this item is ${foundUser.name}.
You can contact them directly to coordinate verification and return:
- Name: ${foundUser.name}
- Email: ${foundUser.email}

You can also checkout the full report and pictures on LostLink:
${itemUrl}

============================================================
CAMPUS SAFETY REMINDER:
For your safety, always arrange verification and handovers in open public areas on campus, such as the Security Office or Student Centre.

— LostLink Campus Team, Chitkara University`;

  const lostEmailHtml = `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #17223a; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #ffffff;">
    <div style="background: #17243c; color: #ffffff; padding: 22px 26px;">
      <h2 style="margin: 0; font-size: 21px; font-weight: 700; letter-spacing: -0.01em;">LostLink · Match Detected</h2>
      <p style="margin: 4px 0 0; font-size: 13px; color: #cbd5e1;">Chitkara University (Rajpura Campus) Lost & Found</p>
    </div>
    <div style="padding: 26px;">
      <p style="font-size: 15px; margin-top: 0;">Hi <strong>${lostUser.name}</strong>,</p>
      <p style="font-size: 15px; color: #15803d; font-weight: 600;">
        🎉 Great news! We detected a <strong>${score}% match</strong> for your lost item on campus.
      </p>

      <div style="background: #fff8f6; border-left: 4px solid #dc2626; border-radius: 4px; padding: 12px 16px; margin: 18px 0;">
        <h4 style="margin: 0 0 6px; color: #991b1b; font-size: 13px; text-transform: uppercase;">Your Lost Report</h4>
        <p style="margin: 3px 0; font-size: 14px;"><strong>Item:</strong> ${lost.name} (${lost.category} · ${lost.colour})</p>
        <p style="margin: 3px 0; font-size: 13px; color: #64748b;"><strong>Lost at:</strong> ${lost.zone} on ${lost.date}${lost.time ? ' at ' + lost.time : ''}</p>
        <p style="margin: 3px 0; font-size: 13px; color: #475569;"><strong>Your notes:</strong> ${lost.description}</p>
      </div>

      <div style="background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; padding: 12px 16px; margin: 18px 0;">
        <h4 style="margin: 0 0 6px; color: #166534; font-size: 13px; text-transform: uppercase;">Matching Found Report</h4>
        <p style="margin: 3px 0; font-size: 14px;"><strong>Item:</strong> ${found.name} (${found.category} · ${found.colour})</p>
        <p style="margin: 3px 0; font-size: 13px; color: #64748b;"><strong>Found at:</strong> ${found.zone} on ${found.date}${found.time ? ' at ' + found.time : ''}</p>
        <p style="margin: 3px 0; font-size: 13px; color: #475569;"><strong>Finder notes:</strong> ${found.description}</p>
        <p style="margin: 3px 0; font-size: 13px; color: #15803d;"><strong>Current custody:</strong> ${found.deposit || 'With finder'}</p>
        <p style="margin: 3px 0; font-size: 12px; color: #0284c7;"><strong>Match factors:</strong> ${reasonsText}</p>
      </div>

      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px; margin: 22px 0; text-align: center;">
        <h3 style="margin: 0 0 6px; font-size: 16px; color: #1e3a8a;">🤝 Get in Touch with the Finder</h3>
        <p style="margin: 4px 0; font-size: 14px; color: #1e293b;">Finder's Name: <strong>${foundUser.name}</strong></p>
        <p style="margin: 4px 0 12px; font-size: 14px; color: #475569;">Email: <strong>${foundUser.email}</strong></p>
        <a href="mailto:${foundUser.email}?subject=Regarding LostLink match: ${encodeURIComponent(lost.name)}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 9px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px;">Email ${foundUser.name} Directly →</a>
      </div>

      <div style="text-align: center; margin: 24px 0 16px;">
        <a href="${itemUrl}" style="display: inline-block; background: #17243c; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">View Found Report on LostLink →</a>
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 24px; font-size: 11px; color: #64748b;">
        <strong>Campus Safety:</strong> Never meet in isolated locations. Always arrange handovers at public campus desks such as the Security Office or Reception.
      </div>
    </div>
  </div>`;

  mailer.send(
    lostUser.email,
    `LostLink: Match found for your lost "${lost.name}" (${score}% match)`,
    lostEmailText,
    lostEmailHtml
  );

  // ==========================================
  // 2. NOTIFY FINDER OF THE FOUND ITEM
  // ==========================================
  const foundInAppMsg = `Possible owner found (${score}%): "${lost.name}" reported lost at ${lost.zone}. Owner: ${lostUser.name} (${lostUser.email}).`;
  db.prepare('INSERT INTO notifications (user_id, type, title, message, note) VALUES (?, ?, ?, ?, ?)')
    .run(
      foundUser.id,
      'match',
      `Possible owner for "${found.name}" (${score}%)`,
      foundInAppMsg,
      `Contact owner directly at: ${lostUser.email}`
    );

  const foundEmailText = `Hi ${foundUser.name},

Thank you for reporting a found item! A student has posted a lost report that closely matches the item you found (${score}% match).

============================================================
YOUR REPORTED ITEM (FOUND):
============================================================
- Item Name: ${found.name}
- Category: ${found.category}
- Colour: ${found.colour}
- Found At: ${found.zone} on ${found.date}${found.time ? ' at ' + found.time : ''}
- Current Item Custody: ${found.deposit || 'With finder'}

============================================================
MATCHING LOST ITEM REPORT:
============================================================
- Item Name: ${lost.name}
- Category: ${lost.category}
- Colour: ${lost.colour}
- Lost At: ${lost.zone} on ${lost.date}${lost.time ? ' at ' + lost.time : ''}
- Owner's Description: ${lost.description}
- Match Factors: ${reasonsText}

============================================================
CONTACT DETAILS OF THE POTENTIAL OWNER:
============================================================
The person looking for this item is ${lostUser.name}.
You can contact them directly to help verify and return the item:
- Name: ${lostUser.name}
- Email: ${lostUser.email}

You can also view the report on LostLink:
${itemUrl}

============================================================
CAMPUS SAFETY REMINDER:
For your safety, always arrange verification and handovers in open public areas on campus, such as the Security Office or Student Centre.

— LostLink Campus Team, Chitkara University`;

  const foundEmailHtml = `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #17223a; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #ffffff;">
    <div style="background: #17243c; color: #ffffff; padding: 22px 26px;">
      <h2 style="margin: 0; font-size: 21px; font-weight: 700; letter-spacing: -0.01em;">LostLink · Potential Owner Found</h2>
      <p style="margin: 4px 0 0; font-size: 13px; color: #cbd5e1;">Chitkara University (Rajpura Campus) Lost & Found</p>
    </div>
    <div style="padding: 26px;">
      <p style="font-size: 15px; margin-top: 0;">Hi <strong>${foundUser.name}</strong>,</p>
      <p style="font-size: 15px; color: #15803d; font-weight: 600;">
        🌟 A student reported a lost item that is a <strong>${score}% match</strong> for what you found!
      </p>

      <div style="background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; padding: 12px 16px; margin: 18px 0;">
        <h4 style="margin: 0 0 6px; color: #166534; font-size: 13px; text-transform: uppercase;">Your Found Item</h4>
        <p style="margin: 3px 0; font-size: 14px;"><strong>Item:</strong> ${found.name} (${found.category} · ${found.colour})</p>
        <p style="margin: 3px 0; font-size: 13px; color: #64748b;"><strong>Found at:</strong> ${found.zone} on ${found.date}${found.time ? ' at ' + found.time : ''}</p>
        <p style="margin: 3px 0; font-size: 13px; color: #475569;"><strong>Your notes:</strong> ${found.description}</p>
      </div>

      <div style="background: #fff8f6; border-left: 4px solid #dc2626; border-radius: 4px; padding: 12px 16px; margin: 18px 0;">
        <h4 style="margin: 0 0 6px; color: #991b1b; font-size: 13px; text-transform: uppercase;">Matching Lost Report</h4>
        <p style="margin: 3px 0; font-size: 14px;"><strong>Item:</strong> ${lost.name} (${lost.category} · ${lost.colour})</p>
        <p style="margin: 3px 0; font-size: 13px; color: #64748b;"><strong>Lost at:</strong> ${lost.zone} on ${lost.date}${lost.time ? ' at ' + lost.time : ''}</p>
        <p style="margin: 3px 0; font-size: 13px; color: #475569;"><strong>Owner notes:</strong> ${lost.description}</p>
        <p style="margin: 3px 0; font-size: 12px; color: #0284c7;"><strong>Match factors:</strong> ${reasonsText}</p>
      </div>

      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px; margin: 22px 0; text-align: center;">
        <h3 style="margin: 0 0 6px; font-size: 16px; color: #1e3a8a;">🤝 Connect with the Owner</h3>
        <p style="margin: 4px 0; font-size: 14px; color: #1e293b;">Owner's Name: <strong>${lostUser.name}</strong></p>
        <p style="margin: 4px 0 12px; font-size: 14px; color: #475569;">Email: <strong>${lostUser.email}</strong></p>
        <a href="mailto:${lostUser.email}?subject=Regarding your lost item on LostLink: ${encodeURIComponent(lost.name)}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 9px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px;">Email ${lostUser.name} Directly →</a>
      </div>

      <div style="text-align: center; margin: 24px 0 16px;">
        <a href="${itemUrl}" style="display: inline-block; background: #17243c; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">View Report on LostLink →</a>
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 24px; font-size: 11px; color: #64748b;">
        <strong>Campus Safety:</strong> For handovers, please use official campus desks such as the Security Office or Reception.
      </div>
    </div>
  </div>`;

  mailer.send(
    foundUser.email,
    `LostLink: Possible owner found for "${found.name}" (${score}% match)`,
    foundEmailText,
    foundEmailHtml
  );
}

module.exports = { notifyUser, notifyMatch };
