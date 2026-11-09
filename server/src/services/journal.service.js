/**
 * JournalService: blog-style entries for the storefront Journal (Admin > Storefront > Journal).
 * Content uses the same lightweight markdown as static pages: ## Heading, - bullet, **bold**, [label](url).
 */
const db = require('../config/db');
const loggerService = require('./logger.service');

const err = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class JournalService {
  _clean(data, { partial = false } = {}) {
    const out = {};
    const str = (v, max) => String(v ?? '').trim().slice(0, max);
    const has = (k) => !partial || data[k] !== undefined;
    if (has('slug')) out.slug = str(data.slug, 160).toLowerCase();
    if (has('titleEn')) out.title_en = str(data.titleEn, 200);
    if (has('titleAr')) out.title_ar = str(data.titleAr, 200) || null;
    if (has('excerptEn')) out.excerpt_en = str(data.excerptEn, 500) || null;
    if (has('excerptAr')) out.excerpt_ar = str(data.excerptAr, 500) || null;
    if (has('categoryEn')) out.category_en = str(data.categoryEn, 80) || null;
    if (has('categoryAr')) out.category_ar = str(data.categoryAr, 80) || null;
    if (has('contentEn')) out.content_en = String(data.contentEn ?? '').slice(0, 100000);
    if (has('contentAr')) out.content_ar = String(data.contentAr ?? '').slice(0, 100000) || null;
    if (has('coverImage')) {
      const c = str(data.coverImage, 500);
      if (c && !/^(\/(uploads|images)\/[^\s<>"'\\]+|https:\/\/[^\s<>"'\\]+)$/i.test(c)) throw err('Cover image must be an uploaded image or an https URL');
      out.cover_image = c || null;
    }
    if (data.isPublished !== undefined) out.is_published = data.isPublished ? 1 : 0;
    if (data.isFeatured !== undefined) out.is_featured = data.isFeatured ? 1 : 0;
    if (data.publishedAt) {
      const d = new Date(data.publishedAt);
      if (!Number.isNaN(d.getTime())) out.published_at = d.toISOString().slice(0, 19).replace('T', ' ');
    }
    return out;
  }

  _validate(f) {
    if (f.slug !== undefined && !SLUG_RE.test(f.slug)) throw err('Slug may only contain lowercase letters, numbers and hyphens');
    if (f.title_en !== undefined && !f.title_en) throw err('English title is required');
    if (f.content_en !== undefined && !f.content_en.trim()) throw err('English content is required');
  }

  async listAdmin() {
    return db.query(
      `SELECT id, slug, title_en, title_ar, category_en, cover_image, is_published, is_featured, published_at, updated_at
       FROM journal_entries ORDER BY published_at DESC, id DESC`
    );
  }

  async getAdmin(id) {
    const [row] = await db.query('SELECT * FROM journal_entries WHERE id = ?', [id]);
    if (!row) throw err('Entry not found', 404);
    return row;
  }

  async _singleFeatured(id) {
    await db.query('UPDATE journal_entries SET is_featured = 0 WHERE id <> ?', [id]);
  }

  async create(data, adminId, req) {
    const f = this._clean(data);
    this._validate(f);
    if (!f.slug) throw err('Slug is required');
    const [dupe] = await db.query('SELECT id FROM journal_entries WHERE slug = ?', [f.slug]);
    if (dupe) throw err('An entry with this slug already exists', 409);
    const cols = Object.keys(f);
    const result = await db.query(
      `INSERT INTO journal_entries (${cols.map((c) => `\`${c}\``).join(',')}, updated_by) VALUES (${cols.map(() => '?').join(',')}, ?)`,
      [...cols.map((c) => f[c]), adminId || null]
    );
    if (f.is_featured) await this._singleFeatured(result.insertId);
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'CREATE_JOURNAL', category: 'settings',
      targetType: 'journal_entry', targetId: result.insertId, targetLabel: f.title_en, req,
    });
    return this.getAdmin(result.insertId);
  }

  async update(id, data, adminId, req) {
    const current = await this.getAdmin(id);
    const f = this._clean(data, { partial: true });
    this._validate(f);
    if (f.slug && f.slug !== current.slug) {
      const [dupe] = await db.query('SELECT id FROM journal_entries WHERE slug = ? AND id <> ?', [f.slug, id]);
      if (dupe) throw err('An entry with this slug already exists', 409);
    }
    const cols = Object.keys(f);
    if (cols.length) {
      await db.query(
        `UPDATE journal_entries SET ${cols.map((c) => `\`${c}\` = ?`).join(', ')}, updated_by = ? WHERE id = ?`,
        [...cols.map((c) => f[c]), adminId || null, id]
      );
    }
    if (f.is_featured) await this._singleFeatured(id);
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'UPDATE_JOURNAL', category: 'settings',
      targetType: 'journal_entry', targetId: id, targetLabel: f.title_en || current.title_en, req,
    });
    return this.getAdmin(id);
  }

  async remove(id, adminId, req) {
    const current = await this.getAdmin(id);
    await db.query('DELETE FROM journal_entries WHERE id = ?', [id]);
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'DELETE_JOURNAL', category: 'settings',
      targetType: 'journal_entry', targetId: id, targetLabel: current.title_en, req,
    });
    return { success: true };
  }

  /** Storefront: published list (no body to keep it light). */
  async listPublic() {
    return db.query(
      `SELECT slug, title_en, title_ar, excerpt_en, excerpt_ar, category_en, category_ar, cover_image, is_featured, published_at,
              CHAR_LENGTH(content_en) AS len
       FROM journal_entries WHERE is_published = 1 AND published_at <= NOW()
       ORDER BY is_featured DESC, published_at DESC, id DESC`
    );
  }

  /** Storefront: one published entry. */
  async getPublic(slug) {
    const [row] = await db.query(
      `SELECT slug, title_en, title_ar, excerpt_en, excerpt_ar, category_en, category_ar, content_en, content_ar,
              cover_image, published_at, updated_at
       FROM journal_entries WHERE slug = ? AND is_published = 1 AND published_at <= NOW()`,
      [slug]
    );
    if (!row) throw err('Entry not found', 404);
    return row;
  }
}

module.exports = new JournalService();
