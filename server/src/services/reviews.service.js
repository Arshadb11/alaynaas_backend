/**
 * ReviewsService: customer product reviews with admin moderation.
 *
 * Flow: shopper submits on the product page -> status 'pending' -> admin approves/rejects in
 * Admin > Reviews -> only 'approved' reviews are returned to the storefront.
 */
const db = require('../config/db');
const loggerService = require('./logger.service');

const err = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const STATUSES = ['pending', 'approved', 'rejected'];

class ReviewsService {
  /* ───────── Storefront ───────── */

  async _productBySlug(slug) {
    const [p] = await db.query('SELECT id, name FROM products WHERE slug = ? LIMIT 1', [slug]);
    if (!p) throw err('Product not found', 404);
    return p;
  }

  async listFeatured(limit = 9) {
    const lim = Math.min(24, Math.max(1, parseInt(limit, 10) || 9));
    const reviews = await db.query(
      `SELECT r.id, r.name, r.rating, r.title, r.body, r.created_at, p.name AS product_name, p.slug AS product_slug
       FROM product_reviews r JOIN products p ON p.id = r.product_id
       WHERE r.status = 'approved' AND r.rating >= 4
       ORDER BY r.created_at DESC, r.id DESC LIMIT ${lim}`
    );
    const [agg] = await db.query(
      `SELECT COUNT(*) AS n, AVG(rating) AS avg FROM product_reviews WHERE status = 'approved'`
    );
    return {
      reviews,
      summary: { count: Number(agg?.n || 0), average: agg?.avg ? Math.round(Number(agg.avg) * 10) / 10 : 0 },
    };
  }

  async listPublic(slug) {
    const product = await this._productBySlug(slug);
    const reviews = await db.query(
      `SELECT id, name, rating, title, body, created_at
       FROM product_reviews WHERE product_id = ? AND status = 'approved'
       ORDER BY created_at DESC, id DESC LIMIT 100`,
      [product.id]
    );
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    for (const r of reviews) { dist[r.rating] = (dist[r.rating] || 0) + 1; total += r.rating; }
    return {
      reviews,
      summary: {
        count: reviews.length,
        average: reviews.length ? Math.round((total / reviews.length) * 10) / 10 : 0,
        distribution: dist,
      },
    };
  }

  async submit(slug, data, ip) {
    const product = await this._productBySlug(slug);
    const [dupe] = await db.query(
      `SELECT id FROM product_reviews WHERE product_id = ? AND email = ? AND status IN ('pending', 'approved') LIMIT 1`,
      [product.id, data.email]
    );
    if (dupe) throw err('You have already reviewed this product. Thank you!', 409);
    await db.query(
      `INSERT INTO product_reviews (product_id, name, email, rating, title, body, status, ip)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [product.id, data.name, data.email, data.rating, data.title || null, data.body, ip || null]
    );
    return { submitted: true };
  }

  /* ───────── Admin ───────── */

  async listAdmin({ status, q, productId, page = 1, limit = 20 } = {}) {
    const where = [];
    const params = [];
    if (STATUSES.includes(status)) { where.push('r.status = ?'); params.push(status); }
    if (productId) { where.push('r.product_id = ?'); params.push(parseInt(productId, 10)); }
    if (q) {
      where.push('(r.name LIKE ? OR r.email LIKE ? OR r.title LIKE ? OR r.body LIKE ? OR p.name LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const off = (Math.max(1, parseInt(page, 10) || 1) - 1) * lim;

    const rows = await db.query(
      `SELECT r.*, p.name AS product_name, p.slug AS product_slug
       FROM product_reviews r JOIN products p ON p.id = r.product_id
       ${w} ORDER BY (r.status = 'pending') DESC, r.created_at DESC, r.id DESC LIMIT ${lim} OFFSET ${off}`,
      params
    );
    const [{ total }] = await db.query(
      `SELECT COUNT(*) AS total FROM product_reviews r JOIN products p ON p.id = r.product_id ${w}`,
      params
    );
    const counts = await db.query('SELECT status, COUNT(*) AS n FROM product_reviews GROUP BY status');
    const byStatus = { pending: 0, approved: 0, rejected: 0 };
    counts.forEach((c) => { byStatus[c.status] = Number(c.n); });
    return { reviews: rows, total: Number(total), page: Math.max(1, parseInt(page, 10) || 1), limit: lim, counts: byStatus };
  }

  async update(id, data, adminId, req) {
    const [row] = await db.query('SELECT * FROM product_reviews WHERE id = ?', [id]);
    if (!row) throw err('Review not found', 404);
    const sets = [];
    const params = [];
    if (data.status !== undefined) {
      if (!STATUSES.includes(data.status)) throw err('Invalid status');
      sets.push('status = ?'); params.push(data.status);
      sets.push('moderated_by = ?'); params.push(adminId || null);
      sets.push('moderated_at = NOW()');
    }
    if (data.name !== undefined) { sets.push('name = ?'); params.push(String(data.name).trim().slice(0, 100)); }
    if (data.title !== undefined) { sets.push('title = ?'); params.push(String(data.title).trim().slice(0, 150) || null); }
    if (data.body !== undefined) {
      const body = String(data.body).trim().slice(0, 3000);
      if (!body) throw err('Review text cannot be empty');
      sets.push('body = ?'); params.push(body);
    }
    if (data.rating !== undefined) {
      const rating = parseInt(data.rating, 10);
      if (!(rating >= 1 && rating <= 5)) throw err('Rating must be 1 to 5');
      sets.push('rating = ?'); params.push(rating);
    }
    if (!sets.length) return row;
    await db.query(`UPDATE product_reviews SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'UPDATE_REVIEW', category: 'products',
      targetType: 'product_review', targetId: id, targetLabel: `${row.name} (${data.status || 'edited'})`, req,
    });
    const [updated] = await db.query(
      `SELECT r.*, p.name AS product_name, p.slug AS product_slug
       FROM product_reviews r JOIN products p ON p.id = r.product_id WHERE r.id = ?`,
      [id]
    );
    return updated;
  }

  async remove(id, adminId, req) {
    const [row] = await db.query('SELECT * FROM product_reviews WHERE id = ?', [id]);
    if (!row) throw err('Review not found', 404);
    await db.query('DELETE FROM product_reviews WHERE id = ?', [id]);
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'DELETE_REVIEW', category: 'products',
      targetType: 'product_review', targetId: id, targetLabel: row.name, req,
    });
    return { success: true };
  }
}

module.exports = new ReviewsService();
