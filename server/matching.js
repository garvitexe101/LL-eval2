const db = require('./db');
const config = require('./config');
const { notifyUser, notifyMatch } = require('./notify');
const { COLS } = require('./itemModel');

/*
 * Rule-based matching (no AI). A lost and a found report are scored out of 100:
 *   category   25   same category
 *   zone       25   same campus zone
 *   colour     15   same colour (5 if either is "Other / Multicolour")
 *   date       15   found on/after the lost date: same day +-1 = 15, <=3 days = 10, <=7 days = 5
 *   text       20   shared keywords between name + description
 * Weights live here so they are easy to tune.
 */
const WEIGHTS = config.match && config.match.weights
  ? config.match.weights
  : { category: 25, zone: 25, colour: 15, date: 15, text: 20 };

const STOP_WORDS = new Set(
  ('the and with for was were this that have has had from near has its are not but you your our their ' +
    'found lost item small large some very into onto over under inside outside along black white blue brown red')
    .split(' ')
);

const tokens = (text) =>
  new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );

const dayDiff = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

function scorePair(lost, found) {
  let score = 0;
  const reasons = [];

  if (lost.category === found.category) {
    score += WEIGHTS.category;
    reasons.push('Same category');
  }
  if (lost.zone === found.zone) {
    score += WEIGHTS.zone;
    reasons.push('Same campus zone');
  }

  // Smart free-text colour matching
  const c1 = String(lost.colour || '').trim().toLowerCase();
  const c2 = String(found.colour || '').trim().toLowerCase();
  if (c1 && c2) {
    if (c1 === c2) {
      score += WEIGHTS.colour;
      reasons.push('Same colour');
    } else if (c1.includes(c2) || c2.includes(c1)) {
      score += WEIGHTS.colour;
      reasons.push('Matching colour');
    } else {
      const words1 = c1.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
      const words2 = new Set(c2.split(/[^a-z0-9]+/).filter((w) => w.length > 2));
      const sharedColour = words1.find((w) => words2.has(w));
      if (sharedColour) {
        score += WEIGHTS.colour;
        reasons.push(`Matching colour (${sharedColour})`);
      } else if (/multi|rainbow|pattern/i.test(c1) || /multi|rainbow|pattern/i.test(c2)) {
        score += 5;
        reasons.push('Colour may overlap');
      }
    }
  }

  const gap = dayDiff(lost.date, found.date); // days between "lost on" and "found on"
  if (!Number.isNaN(gap) && gap >= -1) {
    if (gap <= 1) score += WEIGHTS.date;
    else if (gap <= 3) score += 10;
    else if (gap <= 7) score += 5;
    if (gap <= 7) reasons.push(gap <= 1 ? 'Reported around the same day' : `Found ${gap} days after it was lost`);
  }

  const a = tokens(`${lost.name} ${lost.description}`);
  const b = tokens(`${found.name} ${found.description}`);
  if (a.size && b.size) {
    let shared = 0;
    a.forEach((w) => b.has(w) && (shared += 1));
    if (shared) {
      score += Math.round((shared / Math.min(a.size, b.size)) * WEIGHTS.text);
      reasons.push(`${shared} matching keyword${shared > 1 ? 's' : ''}`);
    }
  }

  return { score: Math.min(100, score), reasons };
}

/**
 * Compares a freshly saved item with every active report of the opposite type,
 * stores matches at or above the minimum score, flags both reports as "Possible match",
 * and notifies both owners about strong matches.
 */
function processNewItem(item) {
  const other = item.type === 'lost' ? 'found' : 'lost';
  const candidates = db
    .prepare(`SELECT ${COLS} FROM items WHERE type = ? AND status != 'Returned' AND user_id != ?`)
    .all(other, item.user_id);

  const upsert = db.prepare(
    `INSERT INTO matches (lost_id, found_id, score, reasons) VALUES (?, ?, ?, ?)
     ON CONFLICT (lost_id, found_id) DO UPDATE SET score = excluded.score, reasons = excluded.reasons`
  );
  const flag = db.prepare("UPDATE items SET status = 'Possible match' WHERE id = ? AND status = 'Open'");

  const results = [];
  for (const cand of candidates) {
    const lost = item.type === 'lost' ? item : cand;
    const found = item.type === 'found' ? item : cand;
    const { score, reasons } = scorePair(lost, found);
    if (score < config.match.min) continue;

    upsert.run(lost.id, found.id, score, JSON.stringify(reasons));
    flag.run(lost.id);
    flag.run(found.id);
    results.push({ lost, found, other: cand, score, reasons });

    if (score >= config.match.strong) {
      notifyMatch({ lost, found, score, reasons });
    }
  }

  return results.sort((x, y) => y.score - x.score);
}

module.exports = { scorePair, processNewItem, WEIGHTS };
