/**
 * PagesService: manageable static pages (policies, terms, etc.).
 *
 * Content is stored as lightweight markdown-style text and rendered (escaped) by the storefront:
 *   ## Heading     - bullet     **bold**     [label](url)     blank line = new paragraph
 * Tokens resolved on the storefront from live settings:
 *   {shipping_fee} {free_over} {delivery_days} {refund_days} {support_email} {support_phone} {store_name} {store_address}
 */
const db = require('../config/db');
const loggerService = require('./logger.service');

const err = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class PagesService {
  _clean(data, { partial = false } = {}) {
    const out = {};
    const str = (v, max) => String(v ?? '').trim().slice(0, max);
    if (!partial || data.slug !== undefined) out.slug = str(data.slug, 120).toLowerCase();
    if (!partial || data.titleEn !== undefined) out.title_en = str(data.titleEn, 200);
    if (!partial || data.titleAr !== undefined) out.title_ar = str(data.titleAr, 200) || null;
    if (!partial || data.summaryEn !== undefined) out.summary_en = str(data.summaryEn, 500) || null;
    if (!partial || data.summaryAr !== undefined) out.summary_ar = str(data.summaryAr, 500) || null;
    if (!partial || data.metaTitle !== undefined) out.meta_title = str(data.metaTitle, 200) || null;
    if (!partial || data.metaKeywords !== undefined) out.meta_keywords = str(data.metaKeywords, 300) || null;
    if (!partial || data.contentEn !== undefined) out.content_en = String(data.contentEn ?? '').slice(0, 100000);
    if (!partial || data.contentAr !== undefined) out.content_ar = String(data.contentAr ?? '').slice(0, 100000) || null;
    if (data.isPublished !== undefined) out.is_published = data.isPublished ? 1 : 0;
    if (data.showInFooter !== undefined) out.show_in_footer = data.showInFooter ? 1 : 0;
    if (data.sortOrder !== undefined) out.sort_order = Math.max(0, parseInt(data.sortOrder, 10) || 0);
    return out;
  }

  _validate(fields) {
    if (fields.slug !== undefined && !SLUG_RE.test(fields.slug)) {
      throw err('Slug may only contain lowercase letters, numbers and hyphens');
    }
    if (fields.title_en !== undefined && !fields.title_en) throw err('English title is required');
  }

  async listAdmin() {
    return db.query(
      `SELECT id, slug, title_en, title_ar, is_published, show_in_footer, is_system, sort_order, updated_at
       FROM static_pages ORDER BY sort_order, id`
    );
  }

  async getAdmin(id) {
    const [row] = await db.query('SELECT * FROM static_pages WHERE id = ?', [id]);
    if (!row) throw err('Page not found', 404);
    return row;
  }

  async create(data, adminId, req) {
    const f = this._clean(data);
    this._validate(f);
    if (!f.slug) throw err('Slug is required');
    const [dupe] = await db.query('SELECT id FROM static_pages WHERE slug = ?', [f.slug]);
    if (dupe) throw err('A page with this slug already exists', 409);
    const cols = Object.keys(f);
    const result = await db.query(
      `INSERT INTO static_pages (${cols.map((c) => `\`${c}\``).join(',')}, updated_by) VALUES (${cols.map(() => '?').join(',')}, ?)`,
      [...cols.map((c) => f[c]), adminId || null]
    );
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'CREATE_PAGE', category: 'settings',
      targetType: 'static_page', targetId: result.insertId, targetLabel: f.title_en, req,
    });
    return this.getAdmin(result.insertId);
  }

  async update(id, data, adminId, req) {
    const current = await this.getAdmin(id);
    const f = this._clean(data, { partial: true });
    // System pages keep their URL: footer links and checkout copy rely on it
    if (current.is_system) delete f.slug;
    this._validate(f);
    if (f.slug && f.slug !== current.slug) {
      const [dupe] = await db.query('SELECT id FROM static_pages WHERE slug = ? AND id <> ?', [f.slug, id]);
      if (dupe) throw err('A page with this slug already exists', 409);
    }
    const cols = Object.keys(f);
    if (cols.length) {
      await db.query(
        `UPDATE static_pages SET ${cols.map((c) => `\`${c}\` = ?`).join(', ')}, updated_by = ? WHERE id = ?`,
        [...cols.map((c) => f[c]), adminId || null, id]
      );
    }
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'UPDATE_PAGE', category: 'settings',
      targetType: 'static_page', targetId: id, targetLabel: f.title_en || current.title_en, req,
    });
    return this.getAdmin(id);
  }

  async remove(id, adminId, req) {
    const current = await this.getAdmin(id);
    if (current.is_system) throw err('Built-in pages cannot be deleted. Unpublish it instead.', 400);
    await db.query('DELETE FROM static_pages WHERE id = ?', [id]);
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'DELETE_PAGE', category: 'settings',
      targetType: 'static_page', targetId: id, targetLabel: current.title_en, req,
    });
    return { success: true };
  }

  /** Storefront: published pages for navigation (footer). */
  async listPublic() {
    return db.query(
      `SELECT slug, title_en, title_ar, show_in_footer, sort_order
       FROM static_pages WHERE is_published = 1 ORDER BY sort_order, id`
    );
  }

  /** Storefront: one published page. */
  async getPublic(slug) {
    const [row] = await db.query(
      `SELECT slug, title_en, title_ar, summary_en, summary_ar, meta_title, meta_keywords, content_en, content_ar, updated_at
       FROM static_pages WHERE slug = ? AND is_published = 1`,
      [slug]
    );
    if (!row) throw err('Page not found', 404);
    return row;
  }
}

module.exports = new PagesService();
