const db = require('../config/db');
const loggerService = require('./logger.service');

class CategoryService {
  /**
   * List all categories as a tree (parent → children)
   */
  async listCategories({ flat = false } = {}) {
    const rows = await db.query('SELECT * FROM categories ORDER BY sort_order, name');

    if (flat) return rows;

    // Build tree: parent_id = 0 are top-level
    const map = new Map();
    const tree = [];

    for (const row of rows) {
      row.children = [];
      map.set(row.id, row);
    }

    for (const row of rows) {
      if (row.parent_id === 0) {
        tree.push(row);
      } else {
        const parent = map.get(row.parent_id);
        if (parent) parent.children.push(row);
      }
    }

    return tree;
  }

  async getCategoryById(categoryId) {
    const [cat] = await db.query('SELECT * FROM categories WHERE id = ?', [categoryId]);
    if (!cat) throw Object.assign(new Error('Category not found'), { statusCode: 404 });

    // Get children
    const children = await db.query(
      'SELECT * FROM categories WHERE parent_id = ? ORDER BY sort_order, name',
      [categoryId]
    );
    cat.children = children;
    return cat;
  }

  async createCategory(data, adminId, req) {
    const [existing] = await db.query('SELECT id FROM categories WHERE slug = ?', [data.slug]);
    if (existing) throw Object.assign(new Error('Slug already exists'), { statusCode: 409 });

    const catId = await db.insert('categories', {
      name: data.name,
      name_ar: data.nameAr || null,
      slug: data.slug,
      description: data.description || null,
      parent_id: data.parentId || 0,
      sort_order: data.sortOrder || 0,
      is_active: data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
    });

    await loggerService.logAction({
      userId: adminId, userEmail: req.user?.email,
      action: 'CREATE_CATEGORY', category: 'settings',
      targetType: 'category', targetId: catId, targetLabel: data.name, req,
    });

    return this.getCategoryById(catId);
  }

  async updateCategory(catId, data, adminId, req) {
    const old = await this.getCategoryById(catId);
    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.nameAr !== undefined) updates.name_ar = data.nameAr;
    if (data.slug !== undefined) updates.slug = data.slug;
    if (data.description !== undefined) updates.description = data.description;
    if (data.parentId !== undefined) updates.parent_id = data.parentId;
    if (data.sortOrder !== undefined) updates.sort_order = data.sortOrder;
    if (data.isActive !== undefined) updates.is_active = data.isActive ? 1 : 0;

    if (Object.keys(updates).length === 0) {
      throw Object.assign(new Error('No fields to update'), { statusCode: 400 });
    }

    const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    await db.query(`UPDATE categories SET ${setClauses} WHERE id = ?`, [...Object.values(updates), catId]);

    await loggerService.logAction({
      userId: adminId, userEmail: req.user?.email,
      action: 'UPDATE_CATEGORY', category: 'settings',
      targetType: 'category', targetId: catId, targetLabel: old.name, req,
    });

    return this.getCategoryById(catId);
  }

  async deleteCategory(catId, adminId, req) {
    const cat = await this.getCategoryById(catId);

    // Products still assigned to this category (including ones in the Trash) block deletion:
    // report it clearly instead of surfacing the raw foreign-key error.
    const [{ n: inUse }] = await db.query(
      'SELECT COUNT(*) AS n FROM products WHERE category_id = ? OR subcategory_id = ?',
      [catId, catId]
    );
    if (inUse > 0) {
      throw Object.assign(
        new Error(
          `"${cat.name}" is used by ${inUse} product${inUse === 1 ? '' : 's'} (trashed products count too). ` +
          'Move them to another category, or delete them, then try again. You can also set the category to Inactive to hide it.'
        ),
        { statusCode: 409 }
      );
    }

    // Move children to parent_id = 0 (top-level) before deleting
    await db.query('UPDATE categories SET parent_id = 0 WHERE parent_id = ?', [catId]);
    // Navigation menu links to this category become plain headings so the menu structure stays intact
    await db.query(
      "UPDATE menu_items SET link_type = 'none', category_id = NULL WHERE category_id = ?",
      [catId]
    ).catch(() => {}); // menu table may not exist on older installs
    await db.query('DELETE FROM categories WHERE id = ?', [catId]);

    await loggerService.logAction({
      userId: adminId, userEmail: req.user?.email,
      action: 'DELETE_CATEGORY', category: 'settings',
      targetType: 'category', targetId: catId, targetLabel: cat.name,
      severity: 'warning', req,
    });

    return { id: catId, deleted: true };
  }
}

class BrandService {
  async listBrands() {
    return db.query('SELECT * FROM brands ORDER BY name');
  }

  async getBrandById(brandId) {
    const [brand] = await db.query('SELECT * FROM brands WHERE id = ?', [brandId]);
    if (!brand) throw Object.assign(new Error('Brand not found'), { statusCode: 404 });
    return brand;
  }

  async createBrand(data, adminId, req) {
    const [existing] = await db.query('SELECT id FROM brands WHERE slug = ?', [data.slug]);
    if (existing) throw Object.assign(new Error('Slug already exists'), { statusCode: 409 });

    const brandId = await db.insert('brands', {
      name: data.name,
      slug: data.slug,
      logo_url: data.logoUrl || null,
      is_active: data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
    });

    await loggerService.logAction({
      userId: adminId, userEmail: req.user?.email,
      action: 'CREATE_BRAND', category: 'settings',
      targetType: 'brand', targetId: brandId, targetLabel: data.name, req,
    });

    return this.getBrandById(brandId);
  }

  async updateBrand(brandId, data, adminId, req) {
    const old = await this.getBrandById(brandId);
    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.slug !== undefined) updates.slug = data.slug;
    if (data.logoUrl !== undefined) updates.logo_url = data.logoUrl;
    if (data.isActive !== undefined) updates.is_active = data.isActive ? 1 : 0;

    if (Object.keys(updates).length === 0) {
      throw Object.assign(new Error('No fields to update'), { statusCode: 400 });
    }

    const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    await db.query(`UPDATE brands SET ${setClauses} WHERE id = ?`, [...Object.values(updates), brandId]);

    await loggerService.logAction({
      userId: adminId, userEmail: req.user?.email,
      action: 'UPDATE_BRAND', category: 'settings',
      targetType: 'brand', targetId: brandId, targetLabel: old.name, req,
    });

    return this.getBrandById(brandId);
  }

  async deleteBrand(brandId, adminId, req) {
    const brand = await this.getBrandById(brandId);
    await db.query('DELETE FROM brands WHERE id = ?', [brandId]);

    await loggerService.logAction({
      userId: adminId, userEmail: req.user?.email,
      action: 'DELETE_BRAND', category: 'settings',
      targetType: 'brand', targetId: brandId, targetLabel: brand.name,
      severity: 'warning', req,
    });

    return { id: brandId, deleted: true };
  }
}

module.exports = { categoryService: new CategoryService(), brandService: new BrandService() };
