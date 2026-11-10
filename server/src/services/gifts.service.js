/**
 * GiftsService: "The Gift Majlis" (storefront /gifts) — free gifts (FOC) for marketing.
 *
 * Four quick ways to win, every one ends in the same claim form (name, WhatsApp, emirate, address):
 *   gift     → send a sealed gift to someone you love; they open it and claim; the sender then gets one too
 *   dune     → wipe the sand to uncover a chest
 *   emirates → choose one of the seven emirates, its card turns over
 *   key      → take one of today's golden keys
 * The prize is always decided here (weighted draw from Admin > Storefront > Gifts), never by the browser.
 * One gift per UAE mobile number; a rolling 24-hour limit caps how many gifts go out.
 * Tables and settings are created on first use, so no manual migration is needed.
 */
const crypto = require('crypto');
const db = require('../config/db');
const redisClient = require('../config/redis');
const loggerService = require('./logger.service');

const err = (message, statusCode = 400, publicCode) => Object.assign(new Error(message), { statusCode, publicCode });
const MODES = ['gift', 'dune', 'emirates', 'key'];
const STATUSES = ['revealed', 'claimed', 'approved', 'shipped', 'delivered', 'rejected'];
const ACTIVE = "('claimed', 'approved', 'shipped', 'delivered')"; // counts as "received a gift"
const EMIRATES = ['abu_dhabi', 'dubai', 'sharjah', 'ajman', 'umm_al_quwain', 'ras_al_khaimah', 'fujairah'];
const WHO = ['mother', 'father', 'wife', 'husband', 'friend', 'someone'];

const SETTINGS = [
  ['gifts_enabled', 'true', 'boolean', 'Show the Gift Majlis (free gifts) page'],
  ['gifts_daily_limit', '30', 'string', 'Maximum gifts claimed in any 24 hours (all ways together)'],
  ['gifts_delivery_en', 'Free delivery across the UAE. Our team will confirm on WhatsApp before sending.', 'string', 'Gift delivery note (English)'],
  ['gifts_delivery_ar', 'توصيل مجاني داخل الإمارات. سيتواصل فريقنا معك عبر واتساب قبل الإرسال.', 'string', 'Gift delivery note (Arabic)'],
];
const DEFAULT_PRIZES = [
  ['Discovery trio: three 2ml fragrances', 'ثلاثية الاستكشاف: ثلاثة عطور بحجم 2 مل', 60, null],
  ['Bakhoor piece with a 2ml fragrance', 'قطعة بخور مع عطر بحجم 2 مل', 30, null],
  ['Discovery set: four 2ml fragrances', 'مجموعة استكشاف: أربعة عطور بحجم 2 مل', 9, null],
  ['A full 50ml bottle', 'زجاجة كاملة بحجم 50 مل', 1, 3],
];

let ready = null;
function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS gift_prizes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name_en VARCHAR(150) NOT NULL,
          name_ar VARCHAR(150) NOT NULL,
          weight INT NOT NULL DEFAULT 1,
          stock INT NULL,
          active TINYINT(1) NOT NULL DEFAULT 1,
          sort INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS gift_sends (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code VARCHAR(12) NOT NULL UNIQUE,
          who VARCHAR(20) NOT NULL,
          to_name VARCHAR(60) NOT NULL,
          from_name VARCHAR(60) NOT NULL,
          message VARCHAR(400) NULL,
          sender_phone VARCHAR(20) NOT NULL,
          lang VARCHAR(5) NOT NULL DEFAULT 'en',
          claim_token VARCHAR(32) NULL,
          opened_at TIMESTAMP NULL,
          claimed_at TIMESTAMP NULL,
          ip VARCHAR(64) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_gift_sends_phone (sender_phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS gift_claims (
          id INT AUTO_INCREMENT PRIMARY KEY,
          token VARCHAR(32) NOT NULL UNIQUE,
          mode VARCHAR(12) NOT NULL,
          ref_code VARCHAR(12) NULL,
          choice VARCHAR(30) NULL,
          prize_id INT NULL,
          prize_en VARCHAR(150) NULL,
          prize_ar VARCHAR(150) NULL,
          name VARCHAR(100) NULL,
          phone VARCHAR(20) NULL,
          emirate VARCHAR(30) NULL,
          address VARCHAR(400) NULL,
          lang VARCHAR(5) NOT NULL DEFAULT 'en',
          status VARCHAR(12) NOT NULL DEFAULT 'revealed',
          admin_note TEXT NULL,
          ip VARCHAR(64) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          claimed_at TIMESTAMP NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_gift_claims_status (status, claimed_at),
          INDEX idx_gift_claims_phone (phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM gift_prizes');
      if (!Number(n)) {
        for (const [i, [en, ar, weight, stock]] of DEFAULT_PRIZES.entries()) {
          await db.query('INSERT INTO gift_prizes (name_en, name_ar, weight, stock, sort) VALUES (?, ?, ?, ?, ?)', [en, ar, weight, stock, i]);
        }
      }
      for (const [key, value, type, description] of SETTINGS) {
        await db.query(
          'INSERT IGNORE INTO system_settings (`group`, `key`, `value`, `type`, `is_public`, `description`) VALUES (?, ?, ?, ?, 1, ?)',
          ['gifts', key, value, type, description]
        );
      }
      if (redisClient) { try { await redisClient.del('settings:public'); } catch { /* ignore */ } }
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

const rand = (n) => crypto.randomBytes(n);
const newToken = () => rand(16).toString('hex');
const newCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  rand(5).forEach((b) => { s += alphabet[b % alphabet.length]; });
  return `GF-${s}`;
};

/** UAE mobile numbers only: 05X XXX XXXX, +971 5X…, 00971 5X… → "9715XXXXXXXX" (or null). */
function uaeMobile(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('9710')) d = `971${d.slice(4)}`;
  if (d.startsWith('05') && d.length === 10) d = `971${d.slice(1)}`;
  if (d.startsWith('5') && d.length === 9) d = `971${d}`;
  return /^9715\d{8}$/.test(d) ? d : null;
}

async function settings() {
  const rows = await db.query("SELECT `key`, `value` FROM system_settings WHERE `group` = 'gifts'");
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { enabled: !/^(false|0)$/i.test(String(s.gifts_enabled ?? 'true')), limit: Math.max(0, parseInt(s.gifts_daily_limit, 10) || 0) };
}

async function remainingToday() {
  const { enabled, limit } = await settings();
  const [{ n }] = await db.query(`SELECT COUNT(*) AS n FROM gift_claims WHERE status IN ${ACTIVE} AND claimed_at >= NOW() - INTERVAL 1 DAY`);
  return { enabled, limit, left: Math.max(0, limit - Number(n)) };
}

async function assertOpen() {
  const r = await remainingToday();
  if (!r.enabled) throw err('Gifts are paused right now', 403, 'paused');
  if (r.left <= 0) throw err("Today's gifts have all been claimed. Please come back tomorrow.", 409, 'sold_out');
  return r;
}

/** Weighted draw among active prizes that still have stock. */
async function draw() {
  const prizes = await db.query('SELECT id, name_en, name_ar, weight FROM gift_prizes WHERE active = 1 AND weight > 0 AND (stock IS NULL OR stock > 0) ORDER BY sort, id');
  if (!prizes.length) throw err('Gifts are paused right now', 403, 'paused');
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  let r = rand(4).readUInt32BE(0) % total;
  for (const p of prizes) { if ((r -= p.weight) < 0) return p; }
  return prizes[0];
}

/** Take one from a limited prize; if it just ran out, fall back to the most common unlimited prize. */
async function takeStock(prize) {
  const [p] = await db.query('SELECT id, name_en, name_ar, stock FROM gift_prizes WHERE id = ?', [prize.id]);
  if (p && p.stock === null) return p;
  if (p) {
    const res = await db.query('UPDATE gift_prizes SET stock = stock - 1 WHERE id = ? AND stock > 0', [p.id]);
    if (res.affectedRows) return p;
  }
  const [fallback] = await db.query('SELECT id, name_en, name_ar FROM gift_prizes WHERE active = 1 AND stock IS NULL ORDER BY weight DESC, sort LIMIT 1');
  if (!fallback) throw err('This gift has just run out, sorry. Please try again tomorrow.', 409, 'sold_out');
  return fallback;
}

async function hasGift(phone) {
  const [row] = await db.query(`SELECT id FROM gift_claims WHERE phone = ? AND status IN ${ACTIVE} LIMIT 1`, [phone]);
  return Boolean(row);
}

const prizeView = (c) => ({ token: c.token, mode: c.mode, choice: c.choice, prize: { en: c.prize_en, ar: c.prize_ar }, claimed: c.status !== 'revealed' });

async function newReveal({ mode, ref_code = null, choice = null, lang }, ip) {
  const p = await draw();
  const token = newToken();
  await db.query(
    'INSERT INTO gift_claims (token, mode, ref_code, choice, prize_id, prize_en, prize_ar, lang, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [token, mode, ref_code, choice, p.id, p.name_en, p.name_ar, lang === 'ar' ? 'ar' : 'en', ip || null]
  );
  return { token, mode, choice, prize: { en: p.name_en, ar: p.name_ar }, claimed: false };
}

class GiftsService {
  /** Public: is the page open, and how many gifts are left (for the golden-key counter). */
  async status() {
    await ensureSchema();
    const { enabled, limit, left } = await remainingToday();
    return { enabled, limit, left };
  }

  /** dune / emirates / key: reveal a prize at once. */
  async play({ mode, choice, lang }, ip) {
    await ensureSchema();
    if (!['dune', 'emirates', 'key'].includes(mode)) throw err('Unknown game');
    if (mode === 'emirates' && !EMIRATES.includes(choice)) throw err('Please choose an emirate');
    const r = await assertOpen();
    const reveal = await newReveal({ mode, choice: mode === 'emirates' ? choice : null, lang }, ip);
    if (mode === 'key') reveal.key_no = r.limit - r.left + 1;
    return reveal;
  }

  /** gift: the sender seals a gift for someone and shares the link on WhatsApp. */
  async send({ who, to_name, from_name, message, sender_phone, lang }, ip) {
    await ensureSchema();
    await assertOpen();
    const phone = uaeMobile(sender_phone);
    if (!phone) throw err('Please enter a UAE mobile number, e.g. 050 123 4567');
    const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM gift_sends WHERE sender_phone = ? AND created_at >= NOW() - INTERVAL 1 DAY', [phone]);
    if (Number(n) >= 5) throw err('You have sent five gifts today. Please send more tomorrow.', 429);
    const clean = (s, max) => String(s || '').replace(/[<>]/g, '').trim().slice(0, max);
    for (let i = 0; i < 4; i++) {
      const code = newCode();
      try {
        await db.query(
          'INSERT INTO gift_sends (code, who, to_name, from_name, message, sender_phone, lang, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [code, WHO.includes(who) ? who : 'someone', clean(to_name, 60), clean(from_name, 60), clean(message, 400) || null, phone, lang === 'ar' ? 'ar' : 'en', ip || null]
        );
        return { code };
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
      }
    }
    throw err('Could not seal your gift, please try again', 500);
  }

  /** Public view of a sealed gift (no phone numbers). */
  async getSend(code) {
    await ensureSchema();
    const [g] = await db.query('SELECT code, who, to_name, from_name, message, lang, claimed_at FROM gift_sends WHERE code = ?', [String(code).toUpperCase()]);
    if (!g) throw err('Gift not found', 404);
    return { code: g.code, who: g.who, to_name: g.to_name, from_name: g.from_name, message: g.message || '', lang: g.lang, claimed: Boolean(g.claimed_at) };
  }

  /** The recipient opens the gift: the prize is drawn once and kept for this gift. */
  async openSend(code, lang, ip) {
    await ensureSchema();
    const [g] = await db.query('SELECT id, code, claim_token, claimed_at FROM gift_sends WHERE code = ?', [String(code).toUpperCase()]);
    if (!g) throw err('Gift not found', 404);
    if (g.claimed_at) throw err('This gift has already been opened and claimed.', 409, 'claimed');
    if (g.claim_token) {
      const [c] = await db.query('SELECT * FROM gift_claims WHERE token = ?', [g.claim_token]);
      if (c && c.status === 'revealed') return prizeView(c);
    }
    await assertOpen();
    const reveal = await newReveal({ mode: 'gift', ref_code: g.code, lang }, ip);
    await db.query('UPDATE gift_sends SET claim_token = ?, opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP) WHERE id = ?', [reveal.token, g.id]);
    return reveal;
  }

  /** Any way → the same claim: delivery details for the prize already revealed. */
  async claim({ token, name, phone, emirate, address }) {
    await ensureSchema();
    const [c] = await db.query('SELECT * FROM gift_claims WHERE token = ?', [token]);
    if (!c) throw err('Gift not found', 404);
    if (c.status !== 'revealed') return { claimed: true, prize: { en: c.prize_en, ar: c.prize_ar } };
    const mobile = uaeMobile(phone);
    if (!mobile) throw err('Please enter a UAE mobile number, e.g. 050 123 4567', 400, 'phone');
    if (!EMIRATES.includes(emirate)) throw err('Please choose your emirate', 400, 'emirate');
    if (await hasGift(mobile)) throw err('This number has already received a gift. One gift per person.', 409, 'duplicate');

    let send = null;
    if (c.mode === 'gift') {
      [send] = await db.query('SELECT * FROM gift_sends WHERE code = ?', [c.ref_code]);
      if (send?.claimed_at) throw err('This gift has already been opened and claimed.', 409, 'claimed');
      if (send && send.sender_phone === mobile) throw err('A gift cannot be claimed by the person who sent it.', 409, 'self');
    }

    const p = await takeStock({ id: c.prize_id });
    await db.query(
      `UPDATE gift_claims SET name = ?, phone = ?, emirate = ?, address = ?, prize_id = ?, prize_en = ?, prize_ar = ?,
         status = 'claimed', claimed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'revealed'`,
      [String(name).trim().slice(0, 100), mobile, emirate, String(address).trim().slice(0, 400), p.id, p.name_en, p.name_ar, c.id]
    );

    // The sender is thanked with a gift of their own (once per number); the team asks for the address on WhatsApp.
    if (send) {
      await db.query('UPDATE gift_sends SET claimed_at = CURRENT_TIMESTAMP WHERE id = ?', [send.id]);
      if (!(await hasGift(send.sender_phone))) {
        try {
          const sp = await takeStock(await draw());
          await db.query(
            `INSERT INTO gift_claims (token, mode, ref_code, prize_id, prize_en, prize_ar, name, phone, lang, status, claimed_at)
             VALUES (?, 'sender', ?, ?, ?, ?, ?, ?, ?, 'claimed', CURRENT_TIMESTAMP)`,
            [newToken(), send.code, sp.id, sp.name_en, sp.name_ar, send.from_name, send.sender_phone, send.lang]
          );
        } catch { /* no stock left: the recipient's claim still stands */ }
      }
    }
    return { claimed: true, prize: { en: p.name_en, ar: p.name_ar } };
  }

  /* ── Admin ── */
  async listAdmin({ status, q, page = 1, limit = 50 } = {}) {
    await ensureSchema();
    const where = [];
    const params = [];
    if (STATUSES.includes(status)) { where.push('c.status = ?'); params.push(status); }
    else if (status !== 'all') where.push("c.status <> 'revealed'"); // default: real claims only
    if (q) { where.push('(c.name LIKE ? OR c.phone LIKE ? OR c.ref_code LIKE ?)'); const like = `%${String(q).trim()}%`; params.push(like, like, like); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const off = (Math.max(1, parseInt(page, 10) || 1) - 1) * lim;
    const items = await db.query(
      `SELECT c.id, c.mode, c.ref_code, c.choice, c.prize_en, c.name, c.phone, c.emirate, c.address, c.lang, c.status, c.admin_note,
              c.created_at, c.claimed_at, s.to_name, s.from_name, s.message, s.who
       FROM gift_claims c LEFT JOIN gift_sends s ON s.code = c.ref_code
       ${w} ORDER BY COALESCE(c.claimed_at, c.created_at) DESC, c.id DESC LIMIT ${lim} OFFSET ${off}`,
      params
    );
    const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM gift_claims c ${w}`, params);
    const counts = await db.query('SELECT status, COUNT(*) AS n FROM gift_claims GROUP BY status');
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    counts.forEach((r) => { byStatus[r.status] = Number(r.n); });
    const modes = await db.query(`SELECT mode, COUNT(*) AS n FROM gift_claims WHERE status IN ${ACTIVE} GROUP BY mode`);
    const [{ sent }] = await db.query('SELECT COUNT(*) AS sent FROM gift_sends');
    const today = await remainingToday();
    return {
      items,
      total: Number(total),
      counts: byStatus,
      byMode: Object.fromEntries(modes.map((m) => [m.mode, Number(m.n)])),
      sent: Number(sent),
      today,
    };
  }

  async update(id, { status, admin_note }, adminId, req) {
    await ensureSchema();
    const [row] = await db.query('SELECT id, name, status FROM gift_claims WHERE id = ?', [id]);
    if (!row) throw err('Gift not found', 404);
    if (status !== undefined && !STATUSES.includes(status)) throw err('Invalid status');
    await db.query('UPDATE gift_claims SET status = COALESCE(?, status), admin_note = COALESCE(?, admin_note) WHERE id = ?', [status ?? null, admin_note ?? null, id]);
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'UPDATE_GIFT_CLAIM', category: 'settings',
      targetType: 'gift_claim', targetId: id, targetLabel: `${row.name || '#' + id}${status ? ` (${status})` : ''}`, req,
    });
    return { success: true };
  }

  async remove(id, adminId, req) {
    await ensureSchema();
    const [row] = await db.query('SELECT id, name FROM gift_claims WHERE id = ?', [id]);
    if (!row) throw err('Gift not found', 404);
    await db.query('DELETE FROM gift_claims WHERE id = ?', [id]);
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'DELETE_GIFT_CLAIM', category: 'settings',
      targetType: 'gift_claim', targetId: id, targetLabel: row.name || `#${id}`, req,
    });
    return { success: true };
  }

  async listPrizes() {
    await ensureSchema();
    const rows = await db.query(`
      SELECT p.*, (SELECT COUNT(*) FROM gift_claims c WHERE c.prize_id = p.id AND c.status IN ${ACTIVE}) AS given
      FROM gift_prizes p ORDER BY p.sort, p.id`);
    return rows.map((r) => ({ ...r, active: Boolean(r.active), given: Number(r.given) }));
  }

  async savePrize(id, { name_en, name_ar, weight, stock, active, sort }, adminId, req) {
    await ensureSchema();
    const vals = [name_en.trim(), name_ar.trim(), Math.max(0, weight | 0), stock === null || stock === '' || stock === undefined ? null : Math.max(0, stock | 0), active === false ? 0 : 1, sort | 0];
    if (id) {
      const res = await db.query('UPDATE gift_prizes SET name_en = ?, name_ar = ?, weight = ?, stock = ?, active = ?, sort = ? WHERE id = ?', [...vals, id]);
      if (!res.affectedRows) throw err('Prize not found', 404);
    } else {
      await db.query('INSERT INTO gift_prizes (name_en, name_ar, weight, stock, active, sort) VALUES (?, ?, ?, ?, ?, ?)', vals);
    }
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: id ? 'UPDATE_GIFT_PRIZE' : 'CREATE_GIFT_PRIZE', category: 'settings',
      targetType: 'gift_prize', targetId: id || null, targetLabel: name_en, req,
    });
    return { success: true };
  }

  async removePrize(id, adminId, req) {
    await ensureSchema();
    const [row] = await db.query('SELECT id, name_en FROM gift_prizes WHERE id = ?', [id]);
    if (!row) throw err('Prize not found', 404);
    await db.query('DELETE FROM gift_prizes WHERE id = ?', [id]); // claims keep their own copy of the prize name
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'DELETE_GIFT_PRIZE', category: 'settings',
      targetType: 'gift_prize', targetId: id, targetLabel: row.name_en, req,
    });
    return { success: true };
  }
}

module.exports = new GiftsService();
module.exports.STATUSES = STATUSES;
module.exports.EMIRATES = EMIRATES;
module.exports.WHO = WHO;
module.exports.uaeMobile = uaeMobile;
