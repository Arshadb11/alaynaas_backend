const db = require('../config/db');
const loggerService = require('./logger.service');

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

class FragranceService {
  // ═════════════════════════════════════════════════════════
  // ─── OLFACTORY FAMILIES CRUD ──────────────────────────────
  // ═════════════════════════════════════════════════════════

  /**
   * List all olfactory families with product usage counts
   */
  async listOlfactoryFamilies({ search = '', activeOnly = false } = {}) {
    let where = 'WHERE 1=1';
    const params = [];

    if (activeOnly) {
      where += ' AND ofam.is_active = TRUE';
    }

    if (search) {
      where += ' AND (ofam.name LIKE ? OR ofam.name_ar LIKE ? OR ofam.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const families = await db.query(
      `SELECT 
        ofam.id, ofam.name, ofam.name_ar, ofam.slug, ofam.description,
        ofam.icon_url, ofam.is_active, ofam.created_at,
        COUNT(DISTINCT pof.product_id) AS product_count
       FROM olfactory_families ofam
       LEFT JOIN product_olfactory_families pof ON pof.olfactory_family_id = ofam.id
       ${where}
       GROUP BY ofam.id
       ORDER BY ofam.name ASC`,
      params
    );

    return families;
  }

  async getOlfactoryFamilyById(id) {
    const [family] = await db.query(
      `SELECT 
        ofam.*,
        COUNT(DISTINCT pof.product_id) AS product_count
       FROM olfactory_families ofam
       LEFT JOIN product_olfactory_families pof ON pof.olfactory_family_id = ofam.id
       WHERE ofam.id = ?
       GROUP BY ofam.id`,
      [id]
    );

    if (!family) {
      throw Object.assign(new Error('Olfactory family not found'), { statusCode: 404 });
    }

    return family;
  }

  async createOlfactoryFamily(data, userId, req) {
    const name = data.name?.trim();
    if (!name) {
      throw Object.assign(new Error('Name is required'), { statusCode: 400 });
    }

    const slug = data.slug?.trim() || slugify(name);

    // Check duplicate slug or name
    const [existing] = await db.query(
      'SELECT id FROM olfactory_families WHERE slug = ? OR name = ?',
      [slug, name]
    );
    if (existing) {
      throw Object.assign(new Error('An olfactory family with this name or slug already exists'), { statusCode: 409 });
    }

    const familyId = await db.insert('olfactory_families', {
      name,
      name_ar: data.name_ar?.trim() || data.nameAr?.trim() || null,
      slug,
      description: data.description?.trim() || null,
      icon_url: data.icon_url?.trim() || data.iconUrl?.trim() || null,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
    });

    const created = await this.getOlfactoryFamilyById(familyId);

    await loggerService.logAction({
      userId,
      userEmail: req?.user?.email,
      action: 'OLFACTORY_FAMILY_CREATE',
      category: 'CATALOG',
      targetType: 'olfactory_family',
      targetId: String(familyId),
      targetLabel: name,
      details: { name, slug },
      req,
    });

    return created;
  }

  async updateOlfactoryFamily(id, data, userId, req) {
    const family = await this.getOlfactoryFamilyById(id);

    const name = data.name ? data.name.trim() : family.name;
    const slug = data.slug ? data.slug.trim() : (data.name ? slugify(data.name) : family.slug);

    // Check slug uniqueness if changed
    if (slug !== family.slug || name !== family.name) {
      const [existing] = await db.query(
        'SELECT id FROM olfactory_families WHERE (slug = ? OR name = ?) AND id != ?',
        [slug, name, id]
      );
      if (existing) {
        throw Object.assign(new Error('An olfactory family with this name or slug already exists'), { statusCode: 409 });
      }
    }

    const updateFields = {
      name,
      name_ar: data.name_ar !== undefined ? (data.name_ar?.trim() || null) : (data.nameAr !== undefined ? (data.nameAr?.trim() || null) : family.name_ar),
      slug,
      description: data.description !== undefined ? (data.description?.trim() || null) : family.description,
      icon_url: data.icon_url !== undefined ? (data.icon_url?.trim() || null) : (data.iconUrl !== undefined ? (data.iconUrl?.trim() || null) : family.icon_url),
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : (data.isActive !== undefined ? Boolean(data.isActive) : family.is_active),
    };

    await db.update('olfactory_families', id, updateFields);
    const updated = await this.getOlfactoryFamilyById(id);

    await loggerService.logAction({
      userId,
      userEmail: req?.user?.email,
      action: 'OLFACTORY_FAMILY_UPDATE',
      category: 'CATALOG',
      targetType: 'olfactory_family',
      targetId: String(id),
      targetLabel: name,
      details: { id, changes: updateFields },
      req,
    });

    return updated;
  }

  async deleteOlfactoryFamily(id, userId, req) {
    const family = await this.getOlfactoryFamilyById(id);

    // Check product usage
    const [usage] = await db.query(
      `SELECT 
        (SELECT COUNT(*) FROM product_olfactory_families WHERE olfactory_family_id = ?) +
        (SELECT COUNT(*) FROM products WHERE olfactory_family_id = ?) AS total_count`,
      [id, id]
    );

    if (usage && usage.total_count > 0) {
      throw Object.assign(
        new Error(`Cannot delete "${family.name}": it is assigned to ${usage.total_count} product(s). Please unassign it first.`),
        { statusCode: 400 }
      );
    }

    await db.query('DELETE FROM olfactory_families WHERE id = ?', [id]);

    await loggerService.logAction({
      userId,
      userEmail: req?.user?.email,
      action: 'OLFACTORY_FAMILY_DELETE',
      category: 'CATALOG',
      targetType: 'olfactory_family',
      targetId: String(id),
      targetLabel: family.name,
      details: { id, name: family.name },
      req,
    });

    return { success: true, message: `Olfactory family "${family.name}" deleted successfully` };
  }


  // ═════════════════════════════════════════════════════════
  // ─── FRAGRANCE NOTES CRUD ─────────────────────────────────
  // ═════════════════════════════════════════════════════════

  /**
   * List all fragrance notes with product count and pyramid level breakdown
   */
  async listFragranceNotes({ search = '' } = {}) {
    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ' AND (fn.name LIKE ? OR fn.name_ar LIKE ? OR fn.description LIKE ? OR fn.description_ar LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const notes = await db.query(
      `SELECT 
        fn.id, fn.name, fn.name_ar, fn.slug, fn.description, fn.description_ar,
        fn.image_url, fn.created_at,
        COUNT(DISTINCT pfn.product_id) AS product_count,
        GROUP_CONCAT(DISTINCT pfn.note_level ORDER BY pfn.note_level SEPARATOR ', ') AS levels_used
       FROM fragrance_notes fn
       LEFT JOIN product_fragrance_notes pfn ON pfn.note_id = fn.id
       ${where}
       GROUP BY fn.id
       ORDER BY fn.name ASC`,
      params
    );

    return notes;
  }

  async getFragranceNoteById(id) {
    const [note] = await db.query(
      `SELECT 
        fn.*,
        COUNT(DISTINCT pfn.product_id) AS product_count,
        GROUP_CONCAT(DISTINCT pfn.note_level ORDER BY pfn.note_level SEPARATOR ', ') AS levels_used
       FROM fragrance_notes fn
       LEFT JOIN product_fragrance_notes pfn ON pfn.note_id = fn.id
       WHERE fn.id = ?
       GROUP BY fn.id`,
      [id]
    );

    if (!note) {
      throw Object.assign(new Error('Fragrance note not found'), { statusCode: 404 });
    }

    return note;
  }

  async createFragranceNote(data, userId, req) {
    const name = data.name?.trim();
    if (!name) {
      throw Object.assign(new Error('Name is required'), { statusCode: 400 });
    }

    const slug = data.slug?.trim() || slugify(name);

    const [existing] = await db.query(
      'SELECT id FROM fragrance_notes WHERE slug = ? OR name = ?',
      [slug, name]
    );
    if (existing) {
      throw Object.assign(new Error('A fragrance note with this name or slug already exists'), { statusCode: 409 });
    }

    const noteId = await db.insert('fragrance_notes', {
      name,
      name_ar: data.name_ar?.trim() || data.nameAr?.trim() || null,
      slug,
      description: data.description?.trim() || null,
      description_ar: data.description_ar?.trim() || data.descriptionAr?.trim() || null,
      image_url: data.image_url?.trim() || data.imageUrl?.trim() || null,
    });

    const created = await this.getFragranceNoteById(noteId);

    await loggerService.logAction({
      userId,
      userEmail: req?.user?.email,
      action: 'FRAGRANCE_NOTE_CREATE',
      category: 'CATALOG',
      targetType: 'fragrance_note',
      targetId: String(noteId),
      targetLabel: name,
      details: { name, slug },
      req,
    });

    return created;
  }

  async updateFragranceNote(id, data, userId, req) {
    const note = await this.getFragranceNoteById(id);

    const name = data.name ? data.name.trim() : note.name;
    const slug = data.slug ? data.slug.trim() : (data.name ? slugify(data.name) : note.slug);

    if (slug !== note.slug || name !== note.name) {
      const [existing] = await db.query(
        'SELECT id FROM fragrance_notes WHERE (slug = ? OR name = ?) AND id != ?',
        [slug, name, id]
      );
      if (existing) {
        throw Object.assign(new Error('A fragrance note with this name or slug already exists'), { statusCode: 409 });
      }
    }

    const updateFields = {
      name,
      name_ar: data.name_ar !== undefined ? (data.name_ar?.trim() || null) : (data.nameAr !== undefined ? (data.nameAr?.trim() || null) : note.name_ar),
      slug,
      description: data.description !== undefined ? (data.description?.trim() || null) : note.description,
      description_ar: data.description_ar !== undefined ? (data.description_ar?.trim() || null) : (data.descriptionAr !== undefined ? (data.descriptionAr?.trim() || null) : note.description_ar),
      image_url: data.image_url !== undefined ? (data.image_url?.trim() || null) : (data.imageUrl !== undefined ? (data.imageUrl?.trim() || null) : note.image_url),
    };

    await db.update('fragrance_notes', id, updateFields);
    const updated = await this.getFragranceNoteById(id);

    await loggerService.logAction({
      userId,
      userEmail: req?.user?.email,
      action: 'FRAGRANCE_NOTE_UPDATE',
      category: 'CATALOG',
      targetType: 'fragrance_note',
      targetId: String(id),
      targetLabel: name,
      details: { id, changes: updateFields },
      req,
    });

    return updated;
  }

  async deleteFragranceNote(id, userId, req) {
    const note = await this.getFragranceNoteById(id);

    // Check product usage in product_fragrance_notes
    const [usage] = await db.query(
      'SELECT COUNT(*) AS total_count FROM product_fragrance_notes WHERE note_id = ?',
      [id]
    );

    if (usage && usage.total_count > 0) {
      throw Object.assign(
        new Error(`Cannot delete "${note.name}": it is currently used in ${usage.total_count} perfume fragrance note pyramids. Please remove it from those products first.`),
        { statusCode: 400 }
      );
    }

    await db.query('DELETE FROM fragrance_notes WHERE id = ?', [id]);

    await loggerService.logAction({
      userId,
      userEmail: req?.user?.email,
      action: 'FRAGRANCE_NOTE_DELETE',
      category: 'CATALOG',
      targetType: 'fragrance_note',
      targetId: String(id),
      targetLabel: note.name,
      details: { id, name: note.name },
      req,
    });

    return { success: true, message: `Fragrance note "${note.name}" deleted successfully` };
  }
}

module.exports = new FragranceService();
