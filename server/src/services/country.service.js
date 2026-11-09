const db = require('../config/db');
const loggerService = require('./logger.service');

class CountryService {
  /**
   * List countries — filtered by user's assigned countries
   */
  async listCountries(userId, hasManagePermission) {
    if (hasManagePermission) {
      // Admin sees all countries
      return db.query('SELECT * FROM countries ORDER BY sort_order, name');
    }
    // Regular user sees only assigned countries
    return db.query(
      `SELECT c.* FROM countries c
       JOIN user_countries uc ON uc.country_id = c.id
       WHERE uc.user_id = ? AND c.is_active = TRUE
       ORDER BY c.sort_order, c.name`,
      [userId]
    );
  }

  /**
   * Get a single country
   */
  async getCountryById(countryId) {
    const [country] = await db.query('SELECT * FROM countries WHERE id = ?', [countryId]);
    if (!country) {
      throw Object.assign(new Error('Country not found'), { statusCode: 404 });
    }
    return country;
  }

  /**
   * Check if user has access to a specific country
   */
  async userHasCountryAccess(userId, countryId) {
    const [row] = await db.query(
      'SELECT 1 FROM user_countries WHERE user_id = ? AND country_id = ?',
      [userId, countryId]
    );
    return !!row;
  }

  /**
   * Get user's allowed country IDs
   */
  async getUserCountryIds(userId) {
    const rows = await db.query(
      'SELECT country_id FROM user_countries WHERE user_id = ?',
      [userId]
    );
    return rows.map((r) => r.country_id);
  }

  /**
   * Create a country
   */
  async createCountry(data, adminId, req) {
    const [existing] = await db.query('SELECT id FROM countries WHERE code = ?', [data.code]);
    if (existing) {
      throw Object.assign(new Error('Country code already exists'), { statusCode: 409 });
    }

    const countryId = await db.insert('countries', {
      name: data.name,
      code: data.code.toUpperCase(),
      currency_code: data.currencyCode.toUpperCase(),
      currency_symbol: data.currencySymbol,
      currency_name: data.currencyName,
      tax_percentage: data.taxPercentage || 0,
      is_active: data.isActive !== undefined ? data.isActive : true,
      sort_order: data.sortOrder || 0,
    });

    await loggerService.logAction({
      userId: adminId,
      userEmail: req.user?.email,
      action: 'CREATE_COUNTRY',
      category: 'settings',
      targetType: 'country',
      targetId: countryId,
      targetLabel: data.name,
      details: { code: data.code, currency: data.currencyCode },
      req,
    });

    return this.getCountryById(countryId);
  }

  /**
   * Update a country
   */
  async updateCountry(countryId, data, adminId, req) {
    const old = await this.getCountryById(countryId);

    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.currencyCode !== undefined) updates.currency_code = data.currencyCode.toUpperCase();
    if (data.currencySymbol !== undefined) updates.currency_symbol = data.currencySymbol;
    if (data.currencyName !== undefined) updates.currency_name = data.currencyName;
    if (data.taxPercentage !== undefined) updates.tax_percentage = data.taxPercentage;
    if (data.isActive !== undefined) updates.is_active = data.isActive;
    if (data.sortOrder !== undefined) updates.sort_order = data.sortOrder;

    if (Object.keys(updates).length === 0) {
      throw Object.assign(new Error('No fields to update'), { statusCode: 400 });
    }

    const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    await db.query(`UPDATE countries SET ${setClauses} WHERE id = ?`, [...Object.values(updates), countryId]);

    const auditId = await loggerService.logAction({
      userId: adminId,
      userEmail: req.user?.email,
      action: 'UPDATE_COUNTRY',
      category: 'settings',
      targetType: 'country',
      targetId: countryId,
      targetLabel: old.name,
      req,
    });

    const updated = await this.getCountryById(countryId);
    await loggerService.logFieldChanges(auditId, old, updated, [
      'name', 'currency_code', 'currency_symbol', 'currency_name', 'tax_percentage', 'is_active',
    ]);

    return updated;
  }

  /**
   * Delete a country
   */
  async deleteCountry(countryId, adminId, req) {
    const country = await this.getCountryById(countryId);

    await db.query('DELETE FROM user_countries WHERE country_id = ?', [countryId]);
    await db.query('DELETE FROM countries WHERE id = ?', [countryId]);

    await loggerService.logAction({
      userId: adminId,
      userEmail: req.user?.email,
      action: 'DELETE_COUNTRY',
      category: 'settings',
      targetType: 'country',
      targetId: countryId,
      targetLabel: country.name,
      severity: 'warning',
      req,
    });

    return { id: countryId, deleted: true };
  }

  /**
   * Assign countries to a user (replaces all existing)
   */
  async setUserCountries(userId, countryIds, adminId, req) {
    // Get old assignments for audit
    const oldRows = await db.query(
      'SELECT country_id FROM user_countries WHERE user_id = ?', [userId]
    );
    const oldIds = oldRows.map((r) => r.country_id);

    // Replace
    await db.query('DELETE FROM user_countries WHERE user_id = ?', [userId]);

    if (countryIds.length > 0) {
      const records = countryIds.map((cid) => ({ user_id: userId, country_id: cid }));
      await db.insertBatch('user_countries', records);
    }

    const added = countryIds.filter((id) => !oldIds.includes(id));
    const removed = oldIds.filter((id) => !countryIds.includes(id));

    if (added.length > 0 || removed.length > 0) {
      await loggerService.logAction({
        userId: adminId,
        userEmail: req?.user?.email,
        action: 'UPDATE_USER_COUNTRIES',
        category: 'permission',
        targetType: 'user',
        targetId: userId,
        details: { added, removed, total: countryIds.length },
        req,
      });
    }

    return countryIds;
  }

  /**
   * Get user's assigned countries
   */
  async getUserCountries(userId) {
    return db.query(
      `SELECT c.* FROM countries c
       JOIN user_countries uc ON uc.country_id = c.id
       WHERE uc.user_id = ?
       ORDER BY c.sort_order, c.name`,
      [userId]
    );
  }
}

module.exports = new CountryService();
