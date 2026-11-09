/**
 * ContactService: messages from the storefront contact form, managed in Admin > Storefront > Contact.
 */
const db = require('../config/db');
const loggerService = require('./logger.service');

const err = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const STATUSES = ['new', 'read', 'archived'];

class ContactService {
  async submit(data, ip) {
    await db.query(
      'INSERT INTO contact_messages (name, email, phone, subject, message, ip) VALUES (?, ?, ?, ?, ?, ?)',
      [data.name, data.email, data.phone || null, data.subject || null, data.message, ip || null]
    );
    return { submitted: true };
  }

  async listAdmin({ status, page = 1, limit = 20 } = {}) {
    const where = STATUSES.includes(status) ? 'WHERE status = ?' : '';
    const params = where ? [status] : [];
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const off = (Math.max(1, parseInt(page, 10) || 1) - 1) * lim;
    const rows = await db.query(
      `SELECT * FROM contact_messages ${where} ORDER BY (status = 'new') DESC, created_at DESC, id DESC LIMIT ${lim} OFFSET ${off}`,
      params
    );
    const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM contact_messages ${where}`, params);
    const counts = await db.query('SELECT status, COUNT(*) AS n FROM contact_messages GROUP BY status');
    const byStatus = { new: 0, read: 0, archived: 0 };
    counts.forEach((c) => { byStatus[c.status] = Number(c.n); });
    return { messages: rows, total: Number(total), counts: byStatus };
  }

  async setStatus(id, status, adminId, req) {
    if (!STATUSES.includes(status)) throw err('Invalid status');
    const [row] = await db.query('SELECT id, name FROM contact_messages WHERE id = ?', [id]);
    if (!row) throw err('Message not found', 404);
    await db.query('UPDATE contact_messages SET status = ? WHERE id = ?', [status, id]);
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'UPDATE_CONTACT_MESSAGE', category: 'settings',
      targetType: 'contact_message', targetId: id, targetLabel: `${row.name} (${status})`, req,
    });
    return { success: true };
  }

  async remove(id, adminId, req) {
    const [row] = await db.query('SELECT id, name FROM contact_messages WHERE id = ?', [id]);
    if (!row) throw err('Message not found', 404);
    await db.query('DELETE FROM contact_messages WHERE id = ?', [id]);
    await loggerService.logAction({
      userId: adminId, userEmail: req?.user?.email, action: 'DELETE_CONTACT_MESSAGE', category: 'settings',
      targetType: 'contact_message', targetId: id, targetLabel: row.name, req,
    });
    return { success: true };
  }
}

module.exports = new ContactService();
