/**
 * AtelierService: "Compose your own perfume" (storefront /atelier) and its leads (Admin > Storefront > Atelier).
 *
 * Flow: compose (anonymous, stored with a share code) → reserve (name + WhatsApp, becomes a lead)
 * → the team contacts, takes the order and hands the free gift (statuses below).
 * The table and settings are created on first use, so no manual migration is needed.
 */
const crypto = require('crypto');
const db = require('../config/db');
const redisClient = require('../config/redis');
const loggerService = require('./logger.service');
const { compose, OPTIONS, ritual } = require('./atelier.engine');

const err = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const STATUSES = ['created', 'reserved', 'contacted', 'ordered', 'gift_given', 'archived'];
const SIZES = ['30', '50', '100'];
const GIFT_EN = 'Order your whole ritual and we add complimentary 2ml samples to your parcel.';
const GIFT_AR = 'اطلب طقسك كاملًا ونضيف إلى طلبك عينات مجانية بحجم 2 مل.';

const SETTINGS = [
  ['atelier_enabled', 'true', 'boolean', 'Show the Atelier (compose your perfume) page'],
  ['atelier_price_30', '', 'string', 'Atelier price for 30ml (AED, empty hides the size)'],
  ['atelier_price_50', '', 'string', 'Atelier price for 50ml (AED, empty hides the size)'],
  ['atelier_price_100', '', 'string', 'Atelier price for 100ml (AED, empty hides the size)'],
  ['atelier_gift_en', GIFT_EN, 'string', 'Atelier gift with a full ritual order (English)'],
  ['atelier_gift_ar', GIFT_AR, 'string', 'Atelier gift with a full ritual order (Arabic)'],
  ['atelier_ritual_discount', '10', 'string', 'Discount % when the whole Crown Ritual is ordered together (0 = none)'],
];
// The first offer text (reserve a custom formula) is replaced by the ritual offer unless the team already edited it
const OLD_GIFT = {
  atelier_gift_en: ['Reserve your formula and receive a complimentary discovery set of four 2ml fragrances.', GIFT_EN],
  atelier_gift_ar: ['احجز تركيبتك واحصل مجانًا على مجموعة استكشاف من أربعة عطور بحجم 2 مل.', GIFT_AR],
};

let ready = null;
function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS atelier_creations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code VARCHAR(12) NOT NULL UNIQUE,
          seed INT UNSIGNED NOT NULL,
          lang VARCHAR(5) NOT NULL DEFAULT 'en',
          answers JSON NOT NULL,
          formula JSON NOT NULL,
          label_name VARCHAR(40) NULL,
          name VARCHAR(100) NULL,
          phone VARCHAR(40) NULL,
          email VARCHAR(150) NULL,
          size VARCHAR(5) NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'created',
          admin_note TEXT NULL,
          ip VARCHAR(64) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          reserved_at TIMESTAMP NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_atelier_status (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      for (const [key, value, type, description] of SETTINGS) {
        await db.query(
          'INSERT IGNORE INTO system_settings (`group`, `key`, `value`, `type`, `is_public`, `description`) VALUES (?, ?, ?, ?, 1, ?)',
          ['atelier', key, value, type, description]
        );
      }
      for (const [key, [from, to]] of Object.entries(OLD_GIFT)) {
        await db.query('UPDATE system_settings SET `value` = ? WHERE `key` = ? AND `value` = ?', [to, key, from]);
      }
      if (redisClient) { try { await redisClient.del('settings:public'); } catch { /* ignore */ } }
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

/* ── The live catalog for the ritual (in-stock products with their notes), cached for 5 minutes ── */
let catalogCache = { at: 0, items: null };
async function catalog() {
  if (catalogCache.items && Date.now() - catalogCache.at < 5 * 60 * 1000) return catalogCache.items;
  const store = require('./store.service');
  let all = [];
  for (let page = 1; page <= 6; page++) {
    const r = await store.listProducts({ limit: 50, page, country_code: 'AE' });
    all = all.concat(r.products || []);
    if ((r.products || []).length < 50) break;
  }
  const items = all.filter((p) => p.in_stock && p.price > 0 && !p.is_bundle).map((p) => ({
    id: p.id, slug: p.slug, name: p.name, name_ar: p.name_ar || p.name, category_slug: p.category_slug,
    category: { en: p.category_name, ar: p.category_name_ar || p.category_name },
    price: p.price, size: p.size_label, image: p.primary_image, variants: p.variants || [],
    families: String(p.family_slugs || '').split(',').filter(Boolean), notes: [],
  }));
  if (items.length) {
    const ids = items.map((p) => p.id);
    const notes = await db.query(
      `SELECT pfn.product_id, fn.name, pfn.note_level AS level FROM product_fragrance_notes pfn
       JOIN fragrance_notes fn ON fn.id = pfn.note_id WHERE pfn.product_id IN (${ids.map(() => '?').join(',')})`, ids);
    const byId = Object.fromEntries(items.map((p) => [p.id, p]));
    notes.forEach((n) => byId[n.product_id]?.notes.push({ name: n.name, level: n.level }));
  }
  catalogCache = { at: Date.now(), items };
  return items;
}
const productView = (p) => p && ({
  id: p.id, slug: p.slug, name: p.name, name_ar: p.name_ar, category: p.category,
  price: p.price, size: p.size, image: p.image, variants: p.variants,
});
async function ritualDiscount() {
  const [row] = await db.query("SELECT `value` FROM system_settings WHERE `key` = 'atelier_ritual_discount'");
  const n = parseFloat(row?.value);
  return Number.isFinite(n) ? Math.min(50, Math.max(0, n)) : 0;
}

const newCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  let s = '';
  crypto.randomBytes(5).forEach((b) => { s += alphabet[b % alphabet.length]; });
  return `AL-${s}`;
};
const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

/** Keep only known answer values (the engine never sees free input except the label name). */
function cleanAnswers(a = {}) {
  const one = (k) => (OPTIONS[k].includes(a[k]) ? a[k] : undefined);
  const many = (k, max) => (Array.isArray(a[k]) ? [...new Set(a[k].filter((x) => OPTIONS[k].includes(x)))].slice(0, max) : []);
  return {
    who: one('who') || 'self',
    mood: many('mood', 2),
    place: one('place'),
    occasion: one('occasion'),
    loves: many('loves', 3),
    avoid: many('avoid', 3),
    intensity: Math.min(5, Math.max(1, parseInt(a.intensity, 10) || 3)),
  };
}

const publicView = (row) => ({
  code: row.code,
  formula: parse(row.formula),
  label_name: row.label_name || '',
  reserved: row.status !== 'created',
  created_at: row.created_at,
});

class AtelierService {
  async create({ answers, label_name, lang }, ip) {
    await ensureSchema();
    const a = cleanAnswers(answers);
    if (!a.mood.length || !a.place || !a.occasion) throw err('Please answer every question');
    const seed = crypto.randomBytes(4).readUInt32BE(0);
    const formula = compose(a, seed);
    const label = String(label_name || '').replace(/[<>]/g, '').trim().slice(0, 40) || null;
    for (let i = 0; i < 4; i++) {
      const code = newCode();
      try {
        await db.query(
          'INSERT INTO atelier_creations (code, seed, lang, answers, formula, label_name, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [code, seed, lang === 'ar' ? 'ar' : 'en', JSON.stringify(a), JSON.stringify(formula), label, ip || null]
        );
        return { code, formula, label_name: label || '', reserved: false };
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e; // retry only on a (very unlikely) code clash
      }
    }
    throw err('Could not save your creation, please try again', 500);
  }

  async get(code) {
    await ensureSchema();
    const [row] = await db.query('SELECT * FROM atelier_creations WHERE code = ? AND status <> ?', [String(code).toUpperCase(), 'archived']);
    if (!row) throw err('Creation not found', 404);
    const view = publicView(row);
    const r = ritual(parse(row.answers), await catalog(), view.formula.name);
    const discount = r.steps.length >= 2 ? await ritualDiscount() : 0;
    return {
      ...view,
      story: r.story,
      ritual: r.steps.map((st) => ({ ...st, product: productView(st.product) })),
      matches: r.matches.map((m) => ({ ...m, product: productView(m.product) })),
      discovery: productView(r.discovery),
      discount,
    };
  }

  /** For checkout: the products of this creation's ritual and its discount (null when it has no ritual). */
  async ritualForOrder(code) {
    if (!/^AL-[A-Z0-9]{5}$/i.test(String(code || ''))) return null;
    await ensureSchema();
    const [row] = await db.query('SELECT code, answers, formula FROM atelier_creations WHERE code = ? AND status <> ?', [String(code).toUpperCase(), 'archived']);
    if (!row) return null;
    const r = ritual(parse(row.answers), await catalog(), parse(row.formula).name);
    if (r.steps.length < 2) return null;
    return { code: row.code, ids: r.steps.map((st) => st.product.id), discount: await ritualDiscount() };
  }

  async reserve(code, { name, phone, email, size }) {
    await ensureSchema();
    const [row] = await db.query('SELECT id, status FROM atelier_creations WHERE code = ?', [String(code).toUpperCase()]);
    if (!row || row.status === 'archived') throw err('Creation not found', 404);
    await db.query(
      `UPDATE atelier_creations SET name = ?, phone = ?, email = ?, size = ?,
         status = IF(status = 'created', 'reserved', status), reserved_at = COALESCE(reserved_at, CURRENT_TIMESTAMP)
       WHERE id = ?`,
      [name, phone, email || null, SIZES.includes(String(size)) ? String(size) : null, row.id]
    );
    return { reserved: true };
  }

  /* ── Admin ── */
  async listAdmin({ status, q, page = 1, limit = 30 } = {}) {
    await ensureSchema();
    const where = [];
    const params = [];
    if (STATUSES.includes(status)) { where.push('status = ?'); params.push(status); }
    else if (status === 'all') where.push("status <> 'archived'"); // every creation, reserved or not
    else where.push("status NOT IN ('created', 'archived')"); // default view: leads (reserved and later)
    if (q) { where.push('(code LIKE ? OR name LIKE ? OR phone LIKE ?)'); const like = `%${String(q).trim()}%`; params.push(like, like, like); }
    const w = `WHERE ${where.join(' AND ')}`;
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const off = (Math.max(1, parseInt(page, 10) || 1) - 1) * lim;
    const rows = await db.query(
      `SELECT id, code, lang, answers, formula, label_name, name, phone, email, size, status, admin_note, created_at, reserved_at
       FROM atelier_creations ${w} ORDER BY COALESCE(reserved_at, created_at) DESC, id DESC LIMIT ${lim} OFFSET ${off}`,
      params
    );
    const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM atelier_creations ${w}`, params);
    const counts = await db.query('SELECT status, COUNT(*) AS n FROM atelier_creations GROUP BY status');
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    counts.forEach((c) => { byStatus[c.status] = Number(c.n); });
    return {
      items: rows.map((r) => ({ ...r, answers: parse(r.answers), formula: parse(r.formula) })),
      total: Number(total),
      counts: byStatus,
    };
  }

  async update(id, { status, admin_note }, adminId, req) {
    await ensureSchema();
    const [row] = await db.query('SELECT id, code FROM atelier_creations WHERE id = ?', [id]);
    if (!row) throw err('Creation not found', 404);
    if (status !== undefined && !STATUSES.includes(status)) throw err('Invalid status');
    await db.query(
      'UPDATE atelier_creations SET status = COALESCE(?, status), admin_note = COALESCE(?, admin_note) WHERE id = ?',
      [status ?? null, admin_note ?? null, id]
    );
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'UPDATE_ATELIER_CREATION', category: 'settings',
      targetType: 'atelier_creation', targetId: id, targetLabel: `${row.code}${status ? ` (${status})` : ''}`, req,
    });
    return { success: true };
  }

  async remove(id, adminId, req) {
    await ensureSchema();
    const [row] = await db.query('SELECT id, code FROM atelier_creations WHERE id = ?', [id]);
    if (!row) throw err('Creation not found', 404);
    await db.query('DELETE FROM atelier_creations WHERE id = ?', [id]);
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'DELETE_ATELIER_CREATION', category: 'settings',
      targetType: 'atelier_creation', targetId: id, targetLabel: row.code, req,
    });
    return { success: true };
  }
}

module.exports = new AtelierService();
module.exports.STATUSES = STATUSES;
module.exports.ensureSchema = ensureSchema;
