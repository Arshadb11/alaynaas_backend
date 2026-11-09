/**
 * MenuService: the storefront navigation menu (Shopify / WooCommerce style).
 *
 * Structure (max 3 levels):
 *   Level 1  top bar link          (can be flagged as a "mega menu")
 *   Level 2  mega column heading / dropdown link
 *   Level 3  links listed under a column
 *
 * Each item links to a catalog category, a custom URL, or nothing (heading only).
 * Everything visible to shoppers is resolved here so the storefront stays simple.
 */
const db = require('../config/db');
const loggerService = require('./logger.service');

const MAX_DEPTH = 3;
const err = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

/** Internal paths ("/x") or http(s) URLs only. Blocks javascript:, data:, protocol-relative, etc. */
const isSafeUrl = (u) => typeof u === 'string' && /^(\/(?!\/)|https?:\/\/)/i.test(u.trim());

class MenuService {
  /** Number of ancestors above an item, + 1 (top level = 1). */
  _depthOf(id, byId) {
    let depth = 1;
    let cur = byId.get(id);
    while (cur && cur.parent_id && byId.has(cur.parent_id)) {
      depth += 1;
      cur = byId.get(cur.parent_id);
      if (depth > 20) break; // corrupt data guard
    }
    return depth;
  }

  /** Height of the subtree below (and including) an item. */
  _heightOf(id, rows) {
    const kids = rows.filter((r) => r.parent_id === id);
    if (!kids.length) return 1;
    return 1 + Math.max(...kids.map((k) => this._heightOf(k.id, rows)));
  }

  async _all(menuKey) {
    return db.query(
      `SELECT m.*, c.name AS category_name, c.slug AS category_slug
       FROM menu_items m LEFT JOIN categories c ON c.id = m.category_id
       WHERE m.menu_key = ? ORDER BY m.parent_id, m.sort_order, m.id`,
      [menuKey]
    );
  }

  /** Admin: flat list (the admin UI builds the tree). */
  async listAdmin(menuKey = 'main') {
    return this._all(menuKey);
  }

  _clean(data) {
    const linkType = ['category', 'custom', 'none'].includes(data.linkType) ? data.linkType : 'custom';
    const out = {
      label: String(data.label || '').trim(),
      label_ar: (data.labelAr || '').trim() || null,
      link_type: linkType,
      category_id: linkType === 'category' ? parseInt(data.categoryId, 10) || null : null,
      url: linkType === 'custom' ? (data.url || '').trim() || null : null,
      open_new_tab: data.openNewTab ? 1 : 0,
      is_mega: data.isMega ? 1 : 0,
      image_url: (data.imageUrl || '').trim() || null,
      badge: (data.badge || '').trim() || null,
      is_active: data.isActive === undefined ? 1 : (data.isActive ? 1 : 0),
    };
    if (!out.label) throw err('Label is required');
    if (linkType === 'category' && !out.category_id) throw err('Choose a category for this link');
    if (linkType === 'custom' && out.url && !isSafeUrl(out.url)) throw err('URL must start with / or http(s)://');
    if (out.image_url && !isSafeUrl(out.image_url)) throw err('Image URL is not valid');
    return out;
  }

  async create(data, adminId, req) {
    const menuKey = data.menuKey || 'main';
    const rows = await this._all(menuKey);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const parentId = parseInt(data.parentId, 10) || 0;

    if (parentId) {
      if (!byId.has(parentId)) throw err('Parent item not found', 404);
      if (this._depthOf(parentId, byId) >= MAX_DEPTH) throw err(`Menus support up to ${MAX_DEPTH} levels`);
    }

    const fields = this._clean(data);
    if (parentId) fields.is_mega = 0; // mega flag only applies to top-level items
    const siblings = rows.filter((r) => r.parent_id === parentId);
    const sortOrder = siblings.length ? Math.max(...siblings.map((s) => s.sort_order)) + 1 : 0;

    const id = await db.insert('menu_items', { ...fields, menu_key: menuKey, parent_id: parentId, sort_order: sortOrder });

    await loggerService.logAction({
      userId: adminId, userEmail: req.user?.email, action: 'CREATE_MENU_ITEM', category: 'settings',
      targetType: 'menu_item', targetId: id, targetLabel: fields.label, req,
    });
    const [row] = await db.query('SELECT * FROM menu_items WHERE id = ?', [id]);
    return row;
  }

  async update(id, data, adminId, req) {
    const [item] = await db.query('SELECT * FROM menu_items WHERE id = ?', [id]);
    if (!item) throw err('Menu item not found', 404);

    const rows = await this._all(item.menu_key);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const fields = this._clean(data);

    let parentId = item.parent_id;
    if (data.parentId !== undefined) {
      parentId = parseInt(data.parentId, 10) || 0;
      if (parentId === id) throw err('An item cannot be its own parent');
      if (parentId) {
        // No cycles: the new parent must not be one of this item's descendants
        let cur = byId.get(parentId);
        while (cur) {
          if (cur.id === id) throw err('Cannot move an item inside its own children');
          cur = byId.get(cur.parent_id);
        }
        if (!byId.has(parentId)) throw err('Parent item not found', 404);
        if (this._depthOf(parentId, byId) + this._heightOf(id, rows) > MAX_DEPTH) {
          throw err(`Menus support up to ${MAX_DEPTH} levels`);
        }
      }
    }
    if (parentId) fields.is_mega = 0;

    const update = { ...fields, parent_id: parentId };
    if (parentId !== item.parent_id) {
      const siblings = rows.filter((r) => r.parent_id === parentId);
      update.sort_order = siblings.length ? Math.max(...siblings.map((s) => s.sort_order)) + 1 : 0;
    }
    const setSql = Object.keys(update).map((k) => `${k} = ?`).join(', ');
    await db.query(`UPDATE menu_items SET ${setSql} WHERE id = ?`, [...Object.values(update), id]);

    await loggerService.logAction({
      userId: adminId, userEmail: req.user?.email, action: 'UPDATE_MENU_ITEM', category: 'settings',
      targetType: 'menu_item', targetId: id, targetLabel: fields.label, req,
    });
    const [row] = await db.query('SELECT * FROM menu_items WHERE id = ?', [id]);
    return row;
  }

  /** Deletes the item and everything beneath it. */
  async remove(id, adminId, req) {
    const [item] = await db.query('SELECT * FROM menu_items WHERE id = ?', [id]);
    if (!item) throw err('Menu item not found', 404);
    const rows = await this._all(item.menu_key);

    const ids = [id];
    for (let i = 0; i < ids.length; i += 1) {
      rows.filter((r) => r.parent_id === ids[i]).forEach((r) => ids.push(r.id));
    }
    await db.query(`DELETE FROM menu_items WHERE id IN (${ids.map(() => '?').join(',')})`, ids);

    await loggerService.logAction({
      userId: adminId, userEmail: req.user?.email, action: 'DELETE_MENU_ITEM', category: 'settings',
      targetType: 'menu_item', targetId: id, targetLabel: item.label, severity: 'warning', req,
    });
    return { id, deleted: ids.length };
  }

  /** Re-order the children of one parent: `ids` is the desired order. */
  async reorder(parentId, ids, adminId, req) {
    const clean = [...new Set((ids || []).map((n) => parseInt(n, 10)).filter(Boolean))];
    for (let i = 0; i < clean.length; i += 1) {
      await db.query('UPDATE menu_items SET sort_order = ? WHERE id = ? AND parent_id = ?', [i, clean[i], parentId || 0]);
    }
    await loggerService.logAction({
      userId: adminId, userEmail: req.user?.email, action: 'REORDER_MENU', category: 'settings',
      targetType: 'menu_item', targetId: parentId || 0, targetLabel: 'menu order', req,
    });
    return { reordered: clean.length };
  }

  /**
   * Public: the active menu as a nested tree with ready-to-use hrefs.
   * Inactive items, items pointing to inactive/deleted categories, and empty headings are dropped.
   */
  async getPublicMenu(menuKey = 'main') {
    const rows = await db.query(
      `SELECT m.*, c.slug AS category_slug, c.is_active AS category_active
       FROM menu_items m LEFT JOIN categories c ON c.id = m.category_id
       WHERE m.menu_key = ? AND m.is_active = 1 ORDER BY m.sort_order, m.id`,
      [menuKey]
    );

    const build = (parentId) => rows
      .filter((r) => r.parent_id === parentId)
      .map((r) => {
        let href = null;
        if (r.link_type === 'category') {
          if (!r.category_slug || !r.category_active) return null;
          href = `/fragrances/${r.category_slug}`;
        } else if (r.link_type === 'custom') {
          href = isSafeUrl(r.url) ? r.url.trim() : null;
        }
        const children = build(r.id).filter(Boolean);
        if (!href && !children.length) return null;
        return {
          id: r.id,
          label: { en: r.label, ar: r.label_ar || r.label },
          href,
          new_tab: !!r.open_new_tab,
          is_mega: !!r.is_mega,
          image: isSafeUrl(r.image_url) ? r.image_url : null,
          badge: r.badge || null,
          children,
        };
      })
      .filter(Boolean);

    return build(0);
  }
}

module.exports = new MenuService();
