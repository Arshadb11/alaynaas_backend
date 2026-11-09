const db = require('../config/db');
const loggerService = require('./logger.service');

class ProductService {
  /**
   * Build the URL slug for a product.
   *  - `rawSlug` blank/missing  -> generated from `name` and made unique ("name", "name-2", ...).
   *  - `rawSlug` supplied       -> cleaned (lowercase, a-z 0-9 and dashes); a clash with another
   *                                product is rejected (409) because the admin asked for that exact URL.
   * `excludeId` skips the product being edited when checking for clashes.
   */
  async _resolveSlug(rawSlug, name, excludeId = null) {
    const slugify = (s) =>
      String(s || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '') // strip accents
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-+|-+$)/g, '')
        .slice(0, 250);

    const taken = async (candidate) => {
      const rows = await db.query('SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1', [candidate, excludeId || 0]);
      return rows.length > 0;
    };

    const explicit = slugify(rawSlug);
    if (explicit) {
      if (await taken(explicit)) {
        throw Object.assign(new Error(`Product slug '${explicit}' already exists`), { statusCode: 409 });
      }
      return explicit;
    }

    // Auto: names with no latin letters (e.g. Arabic-only) fall back to a generic base
    const base = slugify(name) || 'product';
    let candidate = base;
    for (let n = 2; await taken(candidate); n++) candidate = `${base}-${n}`;
    return candidate;
  }

  /**
   * Helper: check if user has access to a specific country
   */
  async userCanAccessCountry(userId, countryId, hasManage) {
    if (hasManage) return true;
    const [row] = await db.query(
      'SELECT 1 FROM user_countries WHERE user_id = ? AND country_id = ?',
      [userId, countryId]
    );
    return !!row;
  }

  /**
   * Helper: get list of country IDs the user can access
   */
  async getUserAllowedCountryIds(userId, hasManage) {
    if (hasManage) {
      const all = await db.query('SELECT id FROM countries WHERE is_active = TRUE ORDER BY sort_order');
      return all.map((c) => c.id);
    }
    const rows = await db.query(
      `SELECT country_id FROM user_countries uc
       JOIN countries c ON c.id = uc.country_id
       WHERE uc.user_id = ? AND c.is_active = TRUE
       ORDER BY c.sort_order`,
      [userId]
    );
    return rows.map((r) => r.country_id);
  }

  /**
   * List products with pagination, search, category, size, and country pricing
   */
  async listProducts(filters = {}, user = {}) {
    const countryId = filters.country_id || filters.countryId;
    const categoryId = filters.category_id || filters.categoryId;
    const subcategoryId = filters.subcategory_id || filters.subcategoryId;
    const sizeId = filters.size_id || filters.sizeId;
    const olfactoryFamilyId = filters.olfactory_family_id || filters.olfactoryFamilyId;
    const isAvailable = filters.is_available !== undefined ? filters.is_available : filters.isAvailable;
    const {
      gender,
      status,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const hasManage = user.permissions?.includes('countries.manage');
    const allowedCountryIds = await this.getUserAllowedCountryIds(user.id, hasManage);

    // If requested countryId is not allowed for user, default to their first allowed country
    let activeCountryId = parseInt(countryId);
    if (!activeCountryId || !allowedCountryIds.includes(activeCountryId)) {
      activeCountryId = allowedCountryIds[0] || 1;
    }

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    // Trash view shows only trashed products; the default view hides them.
    const trashed = ['true', true, '1', 1].includes(filters.trashed);
    conditions.push(trashed ? 'p.deleted_at IS NOT NULL' : 'p.deleted_at IS NULL');

    // Search
    if (search && search.trim()) {
      conditions.push('(p.name LIKE ? OR p.name_ar LIKE ? OR p.sku LIKE ? OR p.slug LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    // Category / Subcategory (Recursive across arbitrary tree depth)
    if (categoryId || subcategoryId) {
      const allCategoryRows = await db.query('SELECT id, parent_id FROM categories');
      const getDescendantCategoryIds = (targetId) => {
        const idNum = parseInt(targetId, 10);
        if (isNaN(idNum)) return [];
        const result = new Set([idNum]);
        let expanded = true;
        while (expanded) {
          expanded = false;
          for (const row of allCategoryRows) {
            if (result.has(row.parent_id) && !result.has(row.id)) {
              result.add(row.id);
              expanded = true;
            }
          }
        }
        return Array.from(result);
      };

      if (categoryId) {
        const matchingIds = getDescendantCategoryIds(categoryId);
        if (matchingIds.length > 0) {
          const placeholders = matchingIds.map(() => '?').join(', ');
          conditions.push(`(p.category_id IN (${placeholders}) OR p.subcategory_id IN (${placeholders}))`);
          params.push(...matchingIds, ...matchingIds);
        }
      }

      if (subcategoryId) {
        const matchingSubIds = getDescendantCategoryIds(subcategoryId);
        if (matchingSubIds.length > 0) {
          const placeholders = matchingSubIds.map(() => '?').join(', ');
          conditions.push(`(p.subcategory_id IN (${placeholders}) OR p.category_id IN (${placeholders}))`);
          params.push(...matchingSubIds, ...matchingSubIds);
        }
      }
    }

    // Size filter
    if (sizeId) {
      conditions.push('p.size_id = ?');
      params.push(sizeId);
    }

    // Olfactory Family filter (matches primary or any associated family)
    if (olfactoryFamilyId) {
      conditions.push(
        '(p.olfactory_family_id = ? OR EXISTS (SELECT 1 FROM product_olfactory_families pof WHERE pof.product_id = p.id AND pof.olfactory_family_id = ?))'
      );
      params.push(olfactoryFamilyId, olfactoryFamilyId);
    }

    // Gender filter
    if (gender) {
      conditions.push('p.gender = ?');
      params.push(gender);
    }

    // Status filter
    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }

    // Country Availability filter
    if (isAvailable !== undefined && isAvailable !== null && isAvailable !== '') {
      const boolAvailable = isAvailable === 'true' || isAvailable === true || isAvailable === '1';
      if (boolAvailable) {
        conditions.push(
          'NOT EXISTS (SELECT 1 FROM product_country_pricing pcp_avail WHERE pcp_avail.product_id = p.id AND pcp_avail.country_id = ? AND pcp_avail.is_available = 0)'
        );
        params.push(activeCountryId);
      } else {
        conditions.push(
          'EXISTS (SELECT 1 FROM product_country_pricing pcp_avail WHERE pcp_avail.product_id = p.id AND pcp_avail.country_id = ? AND pcp_avail.is_available = 0)'
        );
        params.push(activeCountryId);
      }
    }

    // Low stock filter (items where stock_quantity <= low_stock_threshold in active country)
    const lowStock = filters.low_stock !== undefined ? filters.low_stock : filters.lowStock;
    if (lowStock === 'true' || lowStock === true || lowStock === '1' || lowStock === 1) {
      conditions.push(
        'EXISTS (SELECT 1 FROM product_country_pricing pcp_stock WHERE pcp_stock.product_id = p.id AND pcp_stock.country_id = ? AND pcp_stock.stock_quantity <= pcp_stock.low_stock_threshold)'
      );
      params.push(activeCountryId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM products p ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    // Join with category, brand, size, olfactory family, country pricing, and primary image
    const queryParams = [activeCountryId, ...params, parseInt(limit), offset];
    const products = await db.query(
      `SELECT 
        p.id, p.name, p.name_ar, p.slug, p.sku,
        (SELECT COALESCE(SUM(stock_quantity), 0) FROM product_country_pricing WHERE product_id = p.id) AS stock_quantity,
        p.status, p.is_featured, p.is_limited_edition, p.edition_size, p.is_bundle, p.gender, p.specifications,
        (SELECT COUNT(*) FROM product_bundle_items WHERE bundle_product_id = p.id) AS bundle_items_count,
        p.created_at, p.updated_at, p.deleted_at,
        EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id) AS in_orders,
        c.name AS category_name, c.name_ar AS category_name_ar,
        sc.name AS subcategory_name, sc.name_ar AS subcategory_name_ar,
        b.name AS brand_name,
        ps.name AS size_name, ps.unit AS size_unit, ps.value AS size_value,
        ofam.name AS olfactory_family_name,
        (SELECT GROUP_CONCAT(of2.name ORDER BY pof2.is_primary DESC, pof2.sort_order SEPARATOR ', ')
         FROM product_olfactory_families pof2
         JOIN olfactory_families of2 ON of2.id = pof2.olfactory_family_id
         WHERE pof2.product_id = p.id) AS olfactory_families_names,
        pcp.price, pcp.cost_price, pcp.is_available,
        pcp.stock_quantity AS country_stock_quantity,
        pcp.low_stock_threshold AS country_low_stock_threshold,
        co.currency_code, co.currency_symbol, co.decimal_places,
        (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS primary_image_url
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN categories sc ON sc.id = p.subcategory_id
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN product_sizes ps ON ps.id = p.size_id
       LEFT JOIN olfactory_families ofam ON ofam.id = p.olfactory_family_id
       LEFT JOIN product_country_pricing pcp ON pcp.product_id = p.id AND pcp.country_id = ?
       LEFT JOIN countries co ON co.id = ?
       ${whereClause}
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`,
      [activeCountryId, ...queryParams]
    );

    // Permission filter: if caller lacks products.update, omit price and cost_price completely
    const canViewPricing = user.permissions?.includes('products.update');

    const sanitized = products.map((item) => {
      // Parse specifications safely
      let specs = item.specifications;
      if (typeof specs === 'string') {
        try { specs = JSON.parse(specs); } catch { specs = {}; }
      }

      const p = {
        ...item,
        is_available: item.is_available === null || item.is_available === undefined ? true : Boolean(item.is_available),
        specifications: specs || {},
      };

      if (!canViewPricing) {
        delete p.price;
        delete p.cost_price;
      }
      return p;
    });

    return {
      products: sanitized,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
      activeCountryId,
    };
  }

  /**
   * Get single product with full specifications, notes, images, relations, and allowed country pricing
   */
  async getProductById(id, user = {}) {
    const [product] = await db.query(
      `SELECT 
        p.*,
        c.name AS category_name, c.name_ar AS category_name_ar,
        sc.name AS subcategory_name, sc.name_ar AS subcategory_name_ar,
        b.name AS brand_name,
        ps.name AS size_name, ps.unit AS size_unit, ps.value AS size_value,
        ofam.name AS olfactory_family_name, ofam.name_ar AS olfactory_family_name_ar
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN categories sc ON sc.id = p.subcategory_id
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN product_sizes ps ON ps.id = p.size_id
       LEFT JOIN olfactory_families ofam ON ofam.id = p.olfactory_family_id
       WHERE p.id = ?`,
      [id]
    );

    if (!product) {
      throw Object.assign(new Error('Product not found'), { statusCode: 404 });
    }

    // Safe JSON specifications
    if (typeof product.specifications === 'string') {
      try { product.specifications = JSON.parse(product.specifications); } catch { product.specifications = {}; }
    } else if (!product.specifications) {
      product.specifications = {};
    }

    // Images
    const rawImages = await db.query(
      'SELECT id, url, alt_text, sort_order, is_primary FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC',
      [id]
    );
    const images = (rawImages || []).map((img) => ({
      ...img,
      is_primary: Boolean(img.is_primary),
    }));

    // Fragrance Notes (joined with master fragrance_notes)
    const notes = await db.query(
      `SELECT 
        pfn.id AS relation_id,
        pfn.note_level,
        pfn.sort_order,
        fn.id AS note_id,
        fn.name,
        fn.name_ar,
        fn.slug,
        fn.description,
        fn.description_ar,
        fn.image_url
       FROM product_fragrance_notes pfn
       JOIN fragrance_notes fn ON fn.id = pfn.note_id
       WHERE pfn.product_id = ?
       ORDER BY FIELD(pfn.note_level, 'top', 'heart', 'base', 'general'), pfn.sort_order ASC`,
      [id]
    );

    // Multi-country Pricing (filtered by user's assigned countries)
    const hasManage = user.permissions?.includes('countries.manage');
    const allowedCountryIds = await this.getUserAllowedCountryIds(user.id, hasManage);

    let pricing = [];
    if (allowedCountryIds.length > 0) {
      const placeholders = allowedCountryIds.map(() => '?').join(', ');
      pricing = await db.query(
        `SELECT 
          pcp.id,
          c.id AS country_id,
          pcp.price,
          pcp.cost_price,
          pcp.price_10ml,
          pcp.stock_quantity,
          pcp.low_stock_threshold,
          pcp.is_available,
          c.name AS country_name,
          c.code AS country_code,
          c.currency_code,
          c.currency_symbol,
          c.decimal_places,
          c.tax_percentage
         FROM countries c
         LEFT JOIN product_country_pricing pcp ON pcp.country_id = c.id AND pcp.product_id = ?
         WHERE c.id IN (${placeholders}) AND c.is_active = TRUE
         ORDER BY c.sort_order ASC`,
        [id, ...allowedCountryIds]
      );
    }

    // Format pricing booleans and apply permission filter
    const canViewPricing = user.permissions?.includes('products.update');
    pricing = pricing.map((p) => {
      const copy = {
        ...p,
        is_available: p.is_available === null || p.is_available === undefined ? true : Boolean(p.is_available),
      };
      if (!canViewPricing) {
        delete copy.cost_price;
        delete copy.price_10ml;
        delete copy.price;
      }
      return copy;
    });

    // Product Relations
    const relations = await db.query(
      `SELECT 
        pr.id, pr.related_product_id, pr.relation_type, pr.sort_order,
        rp.name AS related_name, rp.name_ar AS related_name_ar, rp.slug AS related_slug,
        (SELECT url FROM product_images WHERE product_id = rp.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS related_image_url
       FROM product_relations pr
       JOIN products rp ON rp.id = pr.related_product_id
       WHERE pr.product_id = ?
       ORDER BY pr.relation_type, pr.sort_order`,
      [id]
    );

    // Olfactory Families (Multi-accords)
    const rawOlfactoryFamilies = await db.query(
      `SELECT pof.olfactory_family_id AS id, ofam.name, ofam.name_ar, ofam.slug, pof.is_primary, pof.sort_order
       FROM product_olfactory_families pof
       JOIN olfactory_families ofam ON ofam.id = pof.olfactory_family_id
       WHERE pof.product_id = ?
       ORDER BY pof.is_primary DESC, pof.sort_order ASC`,
      [id]
    );
    const olfactoryFamilies = (rawOlfactoryFamilies || []).map((f) => ({
      ...f,
      is_primary: Boolean(f.is_primary),
    }));

    // Country-specific SEO (scoped to user's assigned countries, unless countries.manage)
    let countrySeo = [];
    if (allowedCountryIds.length > 0) {
      const placeholders = allowedCountryIds.map(() => '?').join(', ');
      countrySeo = await db.query(
        `SELECT 
          c.id AS country_id,
          c.code AS country_code,
          c.name AS country_name,
          pcs.id AS seo_id,
          COALESCE(pcs.seo_title, ?) AS seo_title,
          COALESCE(pcs.seo_description, ?) AS seo_description,
          COALESCE(pcs.seo_keywords, ?) AS seo_keywords
         FROM countries c
         LEFT JOIN product_country_seo pcs ON pcs.country_id = c.id AND pcs.product_id = ?
         WHERE c.id IN (${placeholders}) AND c.is_active = TRUE
         ORDER BY c.sort_order ASC`,
        [product.seo_title || '', product.seo_description || '', product.seo_keywords || '', id, ...allowedCountryIds]
      );
    }

    // Bundle Items (Option B)
    const bundleItems = await db.query(
      `SELECT id, name, name_ar, size, quantity, image_url, scent_profile, notes_summary, notes_summary_ar, description, description_ar, sort_order
       FROM product_bundle_items
       WHERE bundle_product_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [id]
    );

    // Strip unused/redundant keys from product response
    const {
      olfactory_family_id,
      olfactory_family_name,
      olfactory_family_name_ar,
      seo_title: _st,
      seo_description: _sd,
      seo_keywords: _sk,
      ...sanitizedProduct
    } = product;

    return {
      ...sanitizedProduct,
      is_bundle: Boolean(product.is_bundle),
      stock_quantity: (pricing || []).reduce((acc, curr) => acc + (parseInt(curr.stock_quantity) || 0), 0),
      olfactory_families: olfactoryFamilies,
      images,
      notes,
      pricing,
      relations,
      country_seo: countrySeo,
      bundle_items: bundleItems || [],
    };
  }

  /**
   * Create a new product
   */
  async createProduct(data, userId, req) {
    const {
      name,
      name_ar,
      slug,
      brand_id = 1,
      category_id,
      subcategory_id = null,
      olfactory_family_id = null,
      olfactory_family_ids = [],
      size_id = null,
      gender = 'unisex',
      specifications = {},
      short_description,
      short_description_ar,
      description,
      description_ar,
      seo_title,
      seo_description,
      seo_keywords,
      sku,
      status = 'draft',
      is_featured = false,
      is_limited_edition = false,
      edition_size = null,
      images = [],
      notes = [],
      pricing = [],
      relations = [],
    } = data;

    // Slug: taken from the name when left blank; made unique automatically
    const finalSlug = await this._resolveSlug(slug, name);

    // Determine primary family and list of families
    let primaryFamilyId = null;
    let finalFamilyIds = [];
    if (Array.isArray(olfactory_family_ids) && olfactory_family_ids.length > 0) {
      finalFamilyIds = olfactory_family_ids.map((fid) => parseInt(fid)).filter(Boolean);
      primaryFamilyId = finalFamilyIds[0] || null;
    } else if (olfactory_family_id) {
      primaryFamilyId = parseInt(olfactory_family_id);
      finalFamilyIds = [primaryFamilyId];
    }

    // Fallback SEO from country_seo if individual keys are omitted
    const finalCountrySeo = Array.isArray(data.country_seo)
      ? data.country_seo
      : (Array.isArray(data.seo) ? data.seo : []);
    const defaultSeo = finalCountrySeo[0] || {};
    const effectiveSeoTitle = seo_title || defaultSeo.seo_title || null;
    const effectiveSeoDescription = seo_description || defaultSeo.seo_description || null;
    const effectiveSeoKeywords = seo_keywords || defaultSeo.seo_keywords || null;

    // Insert product
    const productId = await db.insert('products', {
      name,
      name_ar: name_ar || null,
      slug: finalSlug,
      brand_id: brand_id ? parseInt(brand_id) : 1,
      category_id: parseInt(category_id),
      subcategory_id: subcategory_id ? parseInt(subcategory_id) : null,
      olfactory_family_id: primaryFamilyId,
      size_id: size_id ? parseInt(size_id) : null,
      gender,
      specifications: JSON.stringify(specifications || {}),
      short_description: short_description || null,
      short_description_ar: short_description_ar || null,
      description: description || null,
      description_ar: description_ar || null,
      seo_title: effectiveSeoTitle,
      seo_description: effectiveSeoDescription,
      seo_keywords: effectiveSeoKeywords,
      sku: sku || null,
      status,
      is_featured: !!is_featured,
      is_limited_edition: !!is_limited_edition,
      // Edition size only makes sense for limited editions
      edition_size: is_limited_edition && edition_size ? parseInt(edition_size, 10) : null,
      is_bundle: Boolean(data.is_bundle),
    });

    // Insert Olfactory Families (Multi-accords)
    if (finalFamilyIds.length > 0) {
      const familyRecords = finalFamilyIds.map((famId, idx) => ({
        product_id: productId,
        olfactory_family_id: famId,
        is_primary: idx === 0,
        sort_order: idx,
      }));
      await db.insertBatch('product_olfactory_families', familyRecords);
    }

    // Insert Images
    if (Array.isArray(images) && images.length > 0) {
      const primaryIndex = images.findIndex((img) => Boolean(img.is_primary));
      const targetPrimaryIdx = primaryIndex !== -1 ? primaryIndex : 0;
      const imgRecords = images.map((img, idx) => ({
        product_id: productId,
        url: img.url,
        alt_text: img.alt_text || name,
        sort_order: img.sort_order ?? idx + 1,
        is_primary: idx === targetPrimaryIdx,
      }));
      await db.insertBatch('product_images', imgRecords);
    }

    // Insert Notes (Mutually exclusive: either pyramid notes or general notes, not both)
    if (Array.isArray(notes) && notes.length > 0) {
      const hasPyramid = notes.some((n) => ['top', 'heart', 'base'].includes(n.note_level));
      const hasGeneral = notes.some((n) => n.note_level === 'general');
      if (hasPyramid && hasGeneral) {
        throw Object.assign(
          new Error('A product can have either Pyramid notes (top, heart, base) or General notes, not both.'),
          { statusCode: 400 }
        );
      }

      const noteRecords = notes.map((n, idx) => ({
        product_id: productId,
        note_id: parseInt(n.note_id || n.id),
        note_level: n.note_level || 'general',
        sort_order: n.sort_order ?? idx + 1,
      }));
      await db.insertBatch('product_fragrance_notes', noteRecords);
    }

    // Insert Country Pricing & Stock (scoped to allowed countries)
    const canSetPricing = req?.user?.permissions?.includes('products.update');
    if (Array.isArray(pricing) && pricing.length > 0) {
      const priceRecords = pricing.map((pr) => ({
        product_id: productId,
        country_id: parseInt(pr.country_id),
        price: canSetPricing ? (parseFloat(pr.price) || 0) : 0,
        cost_price: canSetPricing ? (parseFloat(pr.cost_price) || 0) : 0,
        price_10ml: canSetPricing && pr.price_10ml !== undefined && pr.price_10ml !== null && pr.price_10ml !== '' && parseFloat(pr.price_10ml) > 0
          ? parseFloat(pr.price_10ml)
          : null,
        stock_quantity: pr.stock_quantity !== undefined ? (parseInt(pr.stock_quantity) || 0) : 0,
        low_stock_threshold: pr.low_stock_threshold !== undefined && pr.low_stock_threshold !== null ? parseInt(pr.low_stock_threshold) : 5,
        is_available: pr.is_available === undefined || pr.is_available === null
          ? true
          : Boolean(pr.is_available === true || pr.is_available === 1 || pr.is_available === '1'),
      }));
      await db.insertBatch('product_country_pricing', priceRecords);
    }

    // Insert Relations
    if (Array.isArray(relations) && relations.length > 0) {
      const relRecords = relations.map((rel, idx) => ({
        product_id: productId,
        related_product_id: parseInt(rel.related_product_id || rel.id),
        relation_type: rel.relation_type || 'related',
        sort_order: rel.sort_order ?? idx + 1,
      }));
      await db.insertBatch('product_relations', relRecords);
    }

    // Insert Bundle Items (Option B)
    if (Boolean(data.is_bundle) && Array.isArray(data.bundle_items) && data.bundle_items.length > 0) {
      const bundleRecords = data.bundle_items.map((item, idx) => ({
        bundle_product_id: productId,
        name: item.name,
        name_ar: item.name_ar || null,
        size: item.size || null,
        quantity: item.quantity ? parseInt(item.quantity) : 1,
        image_url: item.image_url || null,
        scent_profile: item.scent_profile || null,
        notes_summary: item.notes_summary || null,
        notes_summary_ar: item.notes_summary_ar || null,
        description: item.description || null,
        description_ar: item.description_ar || null,
        sort_order: item.sort_order ?? idx + 1,
      }));
      await db.insertBatch('product_bundle_items', bundleRecords);
    }

    // Insert Country-specific SEO (scoped to user's allowed countries)
    const hasCountryManage = req?.user?.permissions?.includes('countries.manage');
    const allowedCountryIds = await this.getUserAllowedCountryIds(userId, hasCountryManage);

    if (finalCountrySeo.length > 0) {
      const seoRecords = finalCountrySeo
        .filter((s) => s.country_id && allowedCountryIds.includes(parseInt(s.country_id)))
        .map((s) => ({
          product_id: productId,
          country_id: parseInt(s.country_id),
          seo_title: s.seo_title || null,
          seo_description: s.seo_description || null,
          seo_keywords: s.seo_keywords || null,
        }));
      if (seoRecords.length > 0) {
        await db.insertBatch('product_country_seo', seoRecords);
      }
    } else if (seo_title || seo_description || seo_keywords) {
      const activeCountries = allowedCountryIds.length > 0
        ? await db.query(
            `SELECT id FROM countries WHERE is_active = TRUE AND id IN (${allowedCountryIds.map(() => '?').join(', ')})`,
            allowedCountryIds
          )
        : [];
      if (activeCountries.length > 0) {
        const seoRecords = activeCountries.map((c) => ({
          product_id: productId,
          country_id: c.id,
          seo_title: seo_title || null,
          seo_description: seo_description || null,
          seo_keywords: seo_keywords || null,
        }));
        await db.insertBatch('product_country_seo', seoRecords);
      }
    }

    // Log action
    await loggerService.logAction({
      userId,
      userEmail: req?.user?.email,
      action: 'CREATE_PRODUCT',
      category: 'product',
      targetType: 'product',
      targetId: productId,
      targetLabel: name,
      details: { sku, slug: finalSlug, status },
      req,
    });

    return this.getProductById(productId, req?.user || {});
  }

  /**
   * Update an existing product
   */
  async updateProduct(id, data, user = {}, req) {
    const oldProduct = await this.getProductById(id, user);

    // Field-level permission check:
    // If request attempts to modify pricing (price, cost_price, or country pricing) but caller lacks products.update -> 403 Forbidden!
    const canUpdatePricing = user.permissions?.includes('products.update');
    const triesToUpdatePrice = data.price !== undefined || data.cost_price !== undefined ||
      (Array.isArray(data.pricing) && data.pricing.some((pr) => pr.price !== undefined || pr.cost_price !== undefined || pr.stock_quantity !== undefined));

    if (triesToUpdatePrice && !canUpdatePricing) {
      await loggerService.logDenied({
        userId: user.id,
        userEmail: user.email,
        action: 'UPDATE_PRODUCT_PRICING_DENIED',
        targetType: 'product',
        targetId: id,
        reason: 'Missing products.update permission',
        req,
      });
      throw Object.assign(new Error('Forbidden: You do not have permission to modify pricing'), { statusCode: 403 });
    }

    // Update product table fields
    const updatePayload = {};
    const scalarFields = [
      'name', 'name_ar', 'slug', 'brand_id', 'category_id', 'subcategory_id',
      'olfactory_family_id', 'size_id', 'gender', 'short_description', 'short_description_ar',
      'description', 'description_ar', 'seo_title', 'seo_description', 'seo_keywords',
      'sku', 'status', 'is_featured', 'is_limited_edition', 'edition_size', 'is_bundle'
    ];

    scalarFields.forEach((field) => {
      if (data[field] !== undefined) {
        updatePayload[field] = data[field];
      }
    });

    // Slug: blank => regenerate from the (new) name; otherwise normalise. Always unique.
    if (data.slug !== undefined) {
      updatePayload.slug = await this._resolveSlug(data.slug, data.name || oldProduct.name, id);
    }

    // Content-only editors (products.update_content) cannot modify status
    const hasFullUpdate = user.permissions?.includes('products.update');
    if (!hasFullUpdate && updatePayload.status !== undefined) {
      delete updatePayload.status;
    }

    if (data.specifications !== undefined) {
      updatePayload.specifications = JSON.stringify(data.specifications || {});
    }

    if (Object.keys(updatePayload).length > 0) {
      await db.update('products', id, updatePayload);
    }

    // Sync Images if provided
    if (data.images !== undefined && Array.isArray(data.images)) {
      await db.query('DELETE FROM product_images WHERE product_id = ?', [id]);
      if (data.images.length > 0) {
        const primaryIndex = data.images.findIndex((img) => Boolean(img.is_primary));
        const targetPrimaryIdx = primaryIndex !== -1 ? primaryIndex : 0;
        const imgRecords = data.images.map((img, idx) => ({
          product_id: id,
          url: img.url,
          alt_text: img.alt_text || data.name || oldProduct.name,
          sort_order: img.sort_order ?? idx + 1,
          is_primary: idx === targetPrimaryIdx,
        }));
        await db.insertBatch('product_images', imgRecords);
      }
    }

    // Sync Olfactory Families (Multi-accords) if provided
    if (data.olfactory_family_ids !== undefined && Array.isArray(data.olfactory_family_ids)) {
      await db.query('DELETE FROM product_olfactory_families WHERE product_id = ?', [id]);
      const validIds = data.olfactory_family_ids.map((fid) => parseInt(fid)).filter(Boolean);
      if (validIds.length > 0) {
        const familyRecords = validIds.map((famId, idx) => ({
          product_id: id,
          olfactory_family_id: famId,
          is_primary: idx === 0,
          sort_order: idx,
        }));
        await db.insertBatch('product_olfactory_families', familyRecords);
        await db.update('products', id, { olfactory_family_id: validIds[0] });
      } else {
        await db.update('products', id, { olfactory_family_id: null });
      }
    }

    // Sync Fragrance Notes if provided (Mutually exclusive: either pyramid notes or general notes, not both)
    if (data.notes !== undefined && Array.isArray(data.notes)) {
      if (data.notes.length > 0) {
        const hasPyramid = data.notes.some((n) => ['top', 'heart', 'base'].includes(n.note_level));
        const hasGeneral = data.notes.some((n) => n.note_level === 'general');
        if (hasPyramid && hasGeneral) {
          throw Object.assign(
            new Error('A product can have either Pyramid notes (top, heart, base) or General notes, not both.'),
            { statusCode: 400 }
          );
        }
      }

      await db.query('DELETE FROM product_fragrance_notes WHERE product_id = ?', [id]);
      if (data.notes.length > 0) {
        const noteRecords = data.notes.map((n, idx) => ({
          product_id: id,
          note_id: parseInt(n.note_id || n.id),
          note_level: n.note_level || 'general',
          sort_order: n.sort_order ?? idx + 1,
        }));
        await db.insertBatch('product_fragrance_notes', noteRecords);
      }
    }

    // Sync Country Pricing & Stock if provided (requires full update access)
    if (hasFullUpdate && data.pricing !== undefined && Array.isArray(data.pricing)) {
      await this.updateCountryPricing(id, data.pricing, user, req);
    }

    // Sync Relations if provided
    if (data.relations !== undefined && Array.isArray(data.relations)) {
      await db.query('DELETE FROM product_relations WHERE product_id = ?', [id]);
      if (data.relations.length > 0) {
        const relRecords = data.relations.map((rel, idx) => ({
          product_id: id,
          related_product_id: parseInt(rel.related_product_id || rel.id),
          relation_type: rel.relation_type || 'related',
          sort_order: rel.sort_order ?? idx + 1,
        }));
        await db.insertBatch('product_relations', relRecords);
      }
    }

    // Sync Bundle Items if provided (Option B)
    if (data.bundle_items !== undefined && Array.isArray(data.bundle_items)) {
      await db.query('DELETE FROM product_bundle_items WHERE bundle_product_id = ?', [id]);
      if (data.bundle_items.length > 0) {
        const bundleRecords = data.bundle_items.map((item, idx) => ({
          bundle_product_id: id,
          name: item.name,
          name_ar: item.name_ar || null,
          size: item.size || null,
          quantity: item.quantity ? parseInt(item.quantity) : 1,
          image_url: item.image_url || null,
          scent_profile: item.scent_profile || null,
          notes_summary: item.notes_summary || null,
          notes_summary_ar: item.notes_summary_ar || null,
          description: item.description || null,
          description_ar: item.description_ar || null,
          sort_order: item.sort_order ?? idx + 1,
        }));
        await db.insertBatch('product_bundle_items', bundleRecords);
      }
    }

    // Sync Country-specific SEO if provided (scoped to user's allowed countries)
    const countrySeoData = data.country_seo !== undefined ? data.country_seo : data.seo;
    if (countrySeoData !== undefined && Array.isArray(countrySeoData)) {
      const hasCountryManage = user.permissions?.includes('countries.manage');
      const allowedCountryIds = await this.getUserAllowedCountryIds(user.id, hasCountryManage);

      for (const s of countrySeoData) {
        if (!s.country_id) continue;
        const countryId = parseInt(s.country_id);
        if (!allowedCountryIds.includes(countryId)) {
          continue; // User is not authorized to edit SEO for this country
        }
        const sTitle = s.seo_title || null;
        const sDesc = s.seo_description || null;
        const sKeywords = s.seo_keywords || null;

        await db.query(
          `INSERT INTO product_country_seo (product_id, country_id, seo_title, seo_description, seo_keywords)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             seo_title = VALUES(seo_title),
             seo_description = VALUES(seo_description),
             seo_keywords = VALUES(seo_keywords),
             updated_at = CURRENT_TIMESTAMP`,
          [id, countryId, sTitle, sDesc, sKeywords]
        );
      }

      // Sync base product SEO with first country entry if individual keys not provided
      const firstSeo = countrySeoData[0];
      if (firstSeo && data.seo_title === undefined && data.seo_description === undefined && data.seo_keywords === undefined) {
        await db.update('products', id, {
          seo_title: firstSeo.seo_title || null,
          seo_description: firstSeo.seo_description || null,
          seo_keywords: firstSeo.seo_keywords || null,
        });
      }
    }

    // Log update and field changes
    const auditId = await loggerService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE_PRODUCT',
      category: 'product',
      targetType: 'product',
      targetId: id,
      targetLabel: data.name || oldProduct.name,
      req,
    });

    if (auditId) {
      await loggerService.logFieldChanges(auditId, oldProduct, { ...oldProduct, ...updatePayload }, scalarFields);
    }

    return this.getProductById(id, user);
  }

  /**
   * Update country pricing and warehouse stock for a product
   */
  async updateCountryPricing(productId, pricingArray, user = {}, req) {
    const hasFullUpdate = user.permissions?.includes('products.update');

    if (!hasFullUpdate) {
      throw Object.assign(new Error('Forbidden: Insufficient permissions to modify pricing or inventory'), { statusCode: 403 });
    }

    const canUpdatePricing = hasFullUpdate;

    const hasManage = user.permissions?.includes('countries.manage');
    const allowedCountryIds = await this.getUserAllowedCountryIds(user.id, hasManage);

    for (const pr of pricingArray) {
      const countryId = parseInt(pr.country_id);
      if (!allowedCountryIds.includes(countryId)) {
        continue; // Skip countries the user cannot manage
      }

      const hasStock = pr.stock_quantity !== undefined && pr.stock_quantity !== null;
      const stockQty = hasStock ? (parseInt(pr.stock_quantity) || 0) : 0;
      const hasThreshold = pr.low_stock_threshold !== undefined && pr.low_stock_threshold !== null;
      const lowStock = hasThreshold ? parseInt(pr.low_stock_threshold) : 5;
      const hasAvailability = pr.is_available !== undefined && pr.is_available !== null;
      const isAvailable = hasAvailability
        ? Boolean(pr.is_available === true || pr.is_available === 1 || pr.is_available === '1')
        : true;

      const hasPrice = canUpdatePricing && pr.price !== undefined && pr.price !== null;
      const price = hasPrice ? (parseFloat(pr.price) || 0) : 0;
      const hasCost = canUpdatePricing && pr.cost_price !== undefined && pr.cost_price !== null;
      const costPrice = hasCost ? (parseFloat(pr.cost_price) || 0) : 0;
      // 10ml price is optional: blank / 0 clears it (NULL)
      const has10ml = canUpdatePricing && pr.price_10ml !== undefined;
      const parsed10ml = parseFloat(pr.price_10ml);
      const price10ml = has10ml && parsed10ml > 0 ? parsed10ml : null;

      await db.query(
        `INSERT INTO product_country_pricing (product_id, country_id, price, cost_price, price_10ml, stock_quantity, low_stock_threshold, is_available)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
            price = CASE WHEN ? = 1 THEN VALUES(price) ELSE price END,
            cost_price = CASE WHEN ? = 1 THEN VALUES(cost_price) ELSE cost_price END,
            price_10ml = CASE WHEN ? = 1 THEN VALUES(price_10ml) ELSE price_10ml END,
            stock_quantity = CASE WHEN ? = 1 THEN VALUES(stock_quantity) ELSE stock_quantity END,
            low_stock_threshold = CASE WHEN ? = 1 THEN VALUES(low_stock_threshold) ELSE low_stock_threshold END,
            is_available = CASE WHEN ? = 1 THEN VALUES(is_available) ELSE is_available END,
            updated_at = CURRENT_TIMESTAMP`,
        [
          productId, countryId, price, costPrice, price10ml, stockQty, lowStock, isAvailable,
          hasPrice ? 1 : 0,
          hasCost ? 1 : 0,
          has10ml ? 1 : 0,
          hasStock ? 1 : 0,
          hasThreshold ? 1 : 0,
          hasAvailability ? 1 : 0,
        ]
      );
    }

    await loggerService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE_PRODUCT_PRICING',
      category: 'product',
      targetType: 'product',
      targetId: productId,
      details: { updatedCountries: pricingArray.map((p) => p.country_id) },
      req,
    });

    return true;
  }

  /**
   * Move a single product to Trash (soft delete). Kept for the legacy DELETE /:id route.
   */
  async deleteProduct(id, userId, req) {
    const result = await this.trashProducts([id], { id: userId, email: req?.user?.email }, req);
    if (!result.trashed) {
      throw Object.assign(new Error('Product not found'), { statusCode: 404 });
    }
    return { id, deleted: true, trashed: true };
  }

  /**
   * Move products to Trash. They are hidden everywhere (admin lists, storefront, checkout)
   * and permanently removed by the purge job after TRASH_RETENTION_DAYS.
   */
  async trashProducts(ids, user, req) {
    const marks = ids.map(() => '?').join(', ');
    const res = await db.query(
      `UPDATE products SET deleted_at = NOW(), deleted_by = ? WHERE id IN (${marks}) AND deleted_at IS NULL`,
      [user.id, ...ids]
    );
    await loggerService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'product.trash',
      category: 'product',
      targetType: 'product',
      targetId: ids.length === 1 ? ids[0] : null,
      targetLabel: `${res.affectedRows} product(s) moved to trash`,
      details: { ids },
      severity: 'warning',
      req,
    });
    return { requested: ids.length, trashed: res.affectedRows };
  }

  async restoreProducts(ids, user, req) {
    const marks = ids.map(() => '?').join(', ');
    const res = await db.query(
      `UPDATE products SET deleted_at = NULL, deleted_by = NULL WHERE id IN (${marks}) AND deleted_at IS NOT NULL`,
      ids
    );
    await loggerService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'product.restore',
      category: 'product',
      targetType: 'product',
      targetId: ids.length === 1 ? ids[0] : null,
      targetLabel: `${res.affectedRows} product(s) restored from trash`,
      details: { ids },
      req,
    });
    return { requested: ids.length, restored: res.affectedRows };
  }

  /**
   * Permanently delete products. Only trashed products can be purged.
   * Products that appear in past orders are kept (hidden) so order history stays intact.
   */
  async purgeProducts(ids, user = {}, req) {
    const marks = ids.map(() => '?').join(', ');
    const trashedRows = await db.query(
      `SELECT id FROM products WHERE id IN (${marks}) AND deleted_at IS NOT NULL`,
      ids
    );
    const purged = [];
    const blocked = [];
    for (const { id } of trashedRows) {
      try {
        await db.query('DELETE FROM products WHERE id = ? AND deleted_at IS NOT NULL', [id]);
        purged.push(id);
      } catch (err) {
        if (err.code === 'ER_ROW_IS_REFERENCED_2') blocked.push(id);
        else throw err;
      }
    }
    if (user.id) {
      await loggerService.logAction({
        userId: user.id,
        userEmail: user.email,
        action: 'product.purge',
        category: 'product',
        targetType: 'product',
        targetId: null,
        targetLabel: `${purged.length} product(s) permanently deleted`,
        details: { purged, blocked_by_order_history: blocked },
        severity: 'warning',
        req,
      });
    }
    return { requested: ids.length, purged: purged.length, blocked: blocked.length };
  }

  /** Purge job entry point: remove products trashed longer than `days` ago. */
  async purgeExpiredProducts(days) {
    const rows = await db.query(
      'SELECT id FROM products WHERE deleted_at IS NOT NULL AND deleted_at < (NOW() - INTERVAL ? DAY)',
      [days]
    );
    if (!rows.length) return { purged: 0, blocked: 0 };
    return this.purgeProducts(rows.map((r) => r.id));
  }

  /**
   * Get metadata lookups for the product editor
   */
  async getMetadata(user = {}) {
    const hasManage = user.permissions?.includes('countries.manage');
    const allowedCountryIds = await this.getUserAllowedCountryIds(user.id, hasManage);

    const [categories, brands, sizes, olfactoryFamilies, fragranceNotes, countries] = await Promise.all([
      db.query('SELECT id, name, name_ar, slug, parent_id FROM categories WHERE is_active = TRUE ORDER BY parent_id, sort_order'),
      db.query('SELECT id, name, slug, logo_url FROM brands WHERE is_active = TRUE ORDER BY name'),
      db.query('SELECT id, name, name_ar, value, unit FROM product_sizes WHERE is_active = TRUE ORDER BY sort_order'),
      db.query('SELECT id, name, name_ar, slug FROM olfactory_families WHERE is_active = TRUE ORDER BY name'),
      db.query('SELECT id, name, name_ar, slug, description, image_url FROM fragrance_notes ORDER BY name'),
      allowedCountryIds.length > 0
        ? db.query(
            `SELECT id, name, code, currency_code, currency_symbol, decimal_places, tax_percentage FROM countries WHERE id IN (${allowedCountryIds.map(() => '?').join(', ')}) ORDER BY sort_order`,
            allowedCountryIds
          )
        : [],
    ]);

    return {
      categories,
      brands,
      sizes,
      olfactoryFamilies,
      fragranceNotes,
      countries,
    };
  }

  /**
   * Find or create a product size
   */
  async findOrCreateSize({ name, name_ar, value, unit }, user = {}) {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      const err = new Error('Size name is required');
      err.statusCode = 400;
      throw err;
    }

    // Auto-parse if value or unit not provided
    let parsedValue = parseFloat(value);
    let parsedUnit = unit ? String(unit).toLowerCase().trim() : null;

    if (isNaN(parsedValue) || !parsedUnit) {
      const match = cleanName.match(/^([\d.]+)\s*([a-zA-Z]+)?/i);
      if (match) {
        if (isNaN(parsedValue)) parsedValue = parseFloat(match[1]);
        if (!parsedUnit && match[2]) {
          const u = match[2].toLowerCase();
          if (['ml', 'm'].includes(u)) parsedUnit = 'ml';
          else if (['g', 'gm', 'gram', 'grams'].includes(u)) parsedUnit = 'gm';
          else if (['pc', 'pcs', 'piece', 'pieces', 'set'].includes(u)) parsedUnit = 'pcs';
          else if (['tola', 'tolas'].includes(u)) parsedUnit = 'tola';
        }
      }
    }

    if (isNaN(parsedValue) || parsedValue <= 0) {
      parsedValue = 1.00;
    }

    const validUnits = ['ml', 'gm', 'pcs', 'tola'];
    if (!validUnits.includes(parsedUnit)) {
      parsedUnit = 'ml';
    }

    // Arabic name auto-fallback if empty
    let cleanNameAr = (name_ar || '').trim();
    if (!cleanNameAr) {
      if (parsedUnit === 'ml') cleanNameAr = `${parsedValue} مل`;
      else if (parsedUnit === 'gm') cleanNameAr = `${parsedValue} غرام`;
      else if (parsedUnit === 'pcs') cleanNameAr = `${parsedValue} قطعة`;
      else if (parsedUnit === 'tola') cleanNameAr = `${parsedValue} تولا`;
      else cleanNameAr = cleanName;
    }

    // 1. Check if matching (value, unit) exists
    const existing = await db.query(
      'SELECT id, name, name_ar, value, unit FROM product_sizes WHERE value = ? AND unit = ? LIMIT 1',
      [parsedValue, parsedUnit]
    );

    if (existing.length > 0) {
      return existing[0];
    }

    // 2. Check if matching name exists (case-insensitive)
    const existingByName = await db.query(
      'SELECT id, name, name_ar, value, unit FROM product_sizes WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [cleanName]
    );

    if (existingByName.length > 0) {
      return existingByName[0];
    }

    // 3. Insert new size record
    const maxOrderRows = await db.query('SELECT IFNULL(MAX(sort_order), 0) AS maxOrder FROM product_sizes');
    const sortOrder = (maxOrderRows[0]?.maxOrder || 0) + 1;

    const insertId = await db.insert('product_sizes', {
      name: cleanName,
      name_ar: cleanNameAr,
      value: parsedValue,
      unit: parsedUnit,
      sort_order: sortOrder,
      is_active: 1,
    });

    return {
      id: insertId,
      name: cleanName,
      name_ar: cleanNameAr,
      value: parsedValue,
      unit: parsedUnit,
      sort_order: sortOrder,
    };
  }

  /**
   * Find or create an olfactory family
   */
  async findOrCreateOlfactoryFamily({ name, name_ar, description }, user = {}) {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      const err = new Error('Olfactory family name is required');
      err.statusCode = 400;
      throw err;
    }

    // Generate slug
    let baseSlug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!baseSlug) baseSlug = 'family-' + Date.now();

    // 1. Check if matching name exists (case-insensitive)
    const existing = await db.query(
      'SELECT id, name, name_ar, slug, description, icon_url FROM olfactory_families WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [cleanName]
    );

    if (existing.length > 0) {
      return existing[0];
    }

    // Ensure slug is unique
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const checkSlug = await db.query('SELECT id FROM olfactory_families WHERE slug = ? LIMIT 1', [slug]);
      if (checkSlug.length === 0) break;
      slug = `${baseSlug}-${counter++}`;
    }

    const cleanNameAr = (name_ar || '').trim() || null;
    const cleanDesc = (description || '').trim() || null;

    const insertId = await db.insert('olfactory_families', {
      name: cleanName,
      name_ar: cleanNameAr,
      slug,
      description: cleanDesc,
      icon_url: '/icons/default-fragrance.svg',
      is_active: 1,
    });

    return {
      id: insertId,
      name: cleanName,
      name_ar: cleanNameAr,
      slug,
      description: cleanDesc,
      icon_url: '/icons/default-fragrance.svg',
    };
  }

  /**
   * Find or create a master fragrance note
   */
  async findOrCreateFragranceNote({ name, name_ar, description, description_ar, image_url }, user = {}) {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      const err = new Error('Fragrance note name is required');
      err.statusCode = 400;
      throw err;
    }

    // Slug generation
    let baseSlug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!baseSlug) baseSlug = 'note-' + Date.now();

    // Check if exists by name (case-insensitive)
    const existing = await db.query(
      'SELECT id, name, name_ar, slug, description, description_ar, image_url FROM fragrance_notes WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [cleanName]
    );

    if (existing.length > 0) {
      return existing[0];
    }

    // Ensure unique slug
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const checkSlug = await db.query('SELECT id FROM fragrance_notes WHERE slug = ? LIMIT 1', [slug]);
      if (checkSlug.length === 0) break;
      slug = `${baseSlug}-${counter++}`;
    }

    const cleanNameAr = (name_ar || '').trim() || null;
    const cleanDesc = (description || '').trim() || null;
    const cleanDescAr = (description_ar || '').trim() || null;
    const cleanImageUrl = (image_url || '').trim() || null;

    const insertId = await db.insert('fragrance_notes', {
      name: cleanName,
      name_ar: cleanNameAr,
      slug,
      description: cleanDesc,
      description_ar: cleanDescAr,
      image_url: cleanImageUrl,
    });

    return {
      id: insertId,
      name: cleanName,
      name_ar: cleanNameAr,
      slug,
      description: cleanDesc,
      description_ar: cleanDescAr,
      image_url: cleanImageUrl,
    };
  }
}

module.exports = new ProductService();
