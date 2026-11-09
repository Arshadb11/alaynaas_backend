const db = require('../config/db');
const loggerService = require('./logger.service');

/**
 * Builds purchasable size variants. Returns [] unless a 10ml price is configured,
 * in which case [main size, 10ml] is returned (storefront shows a size selector).
 */
function buildVariants(sizeLabel, price, price10ml) {
  const p10 = parseFloat(price10ml);
  if (!(p10 > 0)) return [];
  const mainLabel = sizeLabel && sizeLabel.toLowerCase() !== '10ml' ? sizeLabel : '100ml';
  return [
    { key: mainLabel, label: mainLabel, price: parseFloat(price) || 0 },
    { key: '10ml', label: '10ml', price: p10 },
  ];
}

/**
 * STORE SERVICE (Public Customer Storefront)
 *
 * Dedicated data access service for public-facing storefront consumers (Next.js).
 * Enforces strict security boundaries:
 *  - Only active products (status = 'active') are visible
 *  - Strips all internal admin business intelligence (cost_price, margins, supplier info)
 *  - Parameterized queries to prevent SQL injection
 *  - Multi-country pricing and multi-language support (English & Arabic)
 */
class StoreService {
  /**
   * Helper: Resolve country ID and details from code (default: 'AE')
   */
  async resolveCountry(countryCode = 'AE') {
    const code = (countryCode || 'AE').toUpperCase().trim();
    const [country] = await db.query(
      'SELECT id, name, code, currency_code, currency_symbol FROM countries WHERE code = ? AND is_active = TRUE LIMIT 1',
      [code]
    );

    if (country) return country;

    // Fallback to first active country (usually UAE / AE)
    const [fallback] = await db.query(
      'SELECT id, name, code, currency_code, currency_symbol FROM countries WHERE is_active = TRUE ORDER BY sort_order ASC LIMIT 1'
    );
    return fallback || { id: 1, name: 'United Arab Emirates', code: 'AE', currency_code: 'AED', currency_symbol: 'د.إ' };
  }

  /**
   * Get all active GCC countries for storefront currency switcher
   */
  async getCountries() {
    return db.query(
      `SELECT id, name, code, currency_code, currency_symbol, sort_order
       FROM countries
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, name ASC`
    );
  }

  /**
   * Get categories tree (categories with active subcategories)
   */
  async getCategories() {
    const rows = await db.query(
      `SELECT id, name, name_ar, slug, image, icon_image, mobile_image, description, description_ar, parent_id, sort_order
       FROM categories
       WHERE is_active = 1
       ORDER BY sort_order ASC, name ASC`
    );

    // Build hierarchy tree
    const map = new Map();
    const tree = [];

    for (const cat of rows) {
      cat.subcategories = [];
      map.set(cat.id, cat);
    }

    for (const cat of rows) {
      if (!cat.parent_id || cat.parent_id === 0) {
        tree.push(cat);
      } else {
        const parent = map.get(cat.parent_id);
        if (parent) parent.subcategories.push(cat);
      }
    }

    return tree;
  }

  /**
   * Get active brands
   */
  async getBrands() {
    return db.query(
      `SELECT id, name, slug, logo_url
       FROM brands
       WHERE is_active = 1
       ORDER BY name ASC`
    );
  }

  /**
   * Get olfactory families & notes for fragrance discovery filters
   */
  async getFragranceMetadata() {
    const families = await db.query(
      `SELECT id, name, name_ar, slug, description, icon_url
       FROM olfactory_families
       WHERE is_active = 1
       ORDER BY name ASC`
    );

    const notes = await db.query(
      `SELECT id, name, name_ar, slug, image_url
       FROM fragrance_notes
       ORDER BY name ASC`
    );

    return { families, notes };
  }

  /**
   * List products with pagination, search, category, brand, and olfactory filters
   */
  async listProducts(filters = {}) {
    const country = await this.resolveCountry(filters.country_code || filters.countryCode);
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(filters.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const conditions = ["p.status = 'active'", 'p.deleted_at IS NULL'];
    const params = [country.id];

    // Category filter by slug or ID
    if (filters.category_slug) {
      conditions.push('c.slug = ?');
      params.push(filters.category_slug);
    } else if (filters.category_id) {
      conditions.push('p.category_id = ?');
      params.push(parseInt(filters.category_id, 10));
    }

    // Brand filter by slug or ID
    if (filters.brand_slug) {
      conditions.push('b.slug = ?');
      params.push(filters.brand_slug);
    } else if (filters.brand_id) {
      conditions.push('p.brand_id = ?');
      params.push(parseInt(filters.brand_id, 10));
    }

    // Olfactory family filter
    if (filters.olfactory_family_slug) {
      conditions.push(`p.id IN (
        SELECT pof.product_id FROM product_olfactory_families pof
        JOIN olfactory_families ofa ON ofa.id = pof.olfactory_family_id
        WHERE ofa.slug = ?
      )`);
      params.push(filters.olfactory_family_slug);
    } else if (filters.olfactory_family_id) {
      conditions.push(`p.id IN (
        SELECT product_id FROM product_olfactory_families WHERE olfactory_family_id = ?
      )`);
      params.push(parseInt(filters.olfactory_family_id, 10));
    }

    // Gender filter
    if (filters.gender && ['men', 'women', 'unisex'].includes(filters.gender.toLowerCase())) {
      conditions.push('p.gender = ?');
      params.push(filters.gender.toLowerCase());
    }

    // Featured filter
    if (filters.is_featured !== undefined) {
      conditions.push('p.is_featured = ?');
      params.push(filters.is_featured ? 1 : 0);
    }

    // Bundle filter
    if (filters.is_bundle !== undefined) {
      conditions.push('p.is_bundle = ?');
      params.push(filters.is_bundle ? 1 : 0);
    }

    // Search query
    if (filters.q && filters.q.trim()) {
      const searchTerm = `%${filters.q.trim()}%`;
      conditions.push('(p.name LIKE ? OR p.name_ar LIKE ? OR p.short_description LIKE ? OR p.short_description_ar LIKE ?)');
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // In stock only filter
    if (filters.in_stock === 'true' || filters.in_stock === true) {
      conditions.push('pcp.stock_quantity > 0 AND pcp.is_available = 1');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sorting
    let orderBy = 'p.created_at DESC';
    if (filters.sort === 'price-asc') {
      orderBy = 'pcp.price ASC, p.id DESC';
    } else if (filters.sort === 'price-desc') {
      orderBy = 'pcp.price DESC, p.id DESC';
    } else if (filters.sort === 'name-asc') {
      orderBy = 'p.name ASC';
    } else if (filters.sort === 'name-desc') {
      orderBy = 'p.name DESC';
    } else if (filters.sort === 'featured') {
      orderBy = 'p.is_featured DESC, p.created_at DESC';
    }

    // Total Count Query
    const countSql = `
      SELECT COUNT(DISTINCT p.id) AS total
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN product_country_pricing pcp ON pcp.product_id = p.id AND pcp.country_id = ?
      ${whereClause}
    `;
    const [{ total }] = await db.query(countSql, params);

    // Items Query
    const itemsSql = `
      SELECT
        p.id,
        p.name,
        p.name_ar,
        p.slug,
        p.gender,
        p.sku,
        p.short_description,
        p.short_description_ar,
        p.is_featured,
        p.is_limited_edition,
        p.edition_size,
        p.is_bundle,
        p.created_at,
        c.name AS category_name,
        c.name_ar AS category_name_ar,
        c.slug AS category_slug,
        b.name AS brand_name,
        b.slug AS brand_slug,
        ps.name AS size_label,
        -- Country pricing projection (STRICTLY NO cost_price)
        COALESCE(pcp.price, 0) AS price,
        pcp.price_10ml AS price_10ml,
        COALESCE(pcp.stock_quantity, 0) AS stock_quantity,
        COALESCE(pcp.is_available, 1) AS is_available,
        -- Primary Image
        (
          SELECT url FROM product_images
          WHERE product_id = p.id
          ORDER BY is_primary DESC, sort_order ASC, id ASC
          LIMIT 1
        ) AS primary_image,
        -- Olfactory family slugs (primary first) so the storefront can group products by family
        (
          SELECT GROUP_CONCAT(ofa.slug ORDER BY pof.is_primary DESC, pof.sort_order ASC SEPARATOR ',')
          FROM product_olfactory_families pof
          JOIN olfactory_families ofa ON ofa.id = pof.olfactory_family_id
          WHERE pof.product_id = p.id AND ofa.is_active = 1
        ) AS family_slugs,
        -- Secondary Image for hover effect
        (
          SELECT url FROM product_images
          WHERE product_id = p.id
          ORDER BY is_primary ASC, sort_order ASC, id ASC
          LIMIT 1 OFFSET 1
        ) AS secondary_image
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN product_sizes ps ON ps.id = p.size_id
      LEFT JOIN product_country_pricing pcp ON pcp.product_id = p.id AND pcp.country_id = ?
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const items = await db.query(itemsSql, [...params, limit, offset]);

    return {
      products: items.map((prod) => ({
        ...prod,
        price: parseFloat(prod.price) || 0,
        price_10ml: prod.price_10ml !== null && prod.price_10ml !== undefined ? parseFloat(prod.price_10ml) : null,
        variants: buildVariants(prod.size_label, prod.price, prod.price_10ml),
        in_stock: prod.stock_quantity > 0 && Boolean(prod.is_available),
        currency: {
          code: country.currency_code,
          symbol: country.currency_symbol,
          country_code: country.code,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single product by slug with full details, notes pyramid, bundle items, and SEO
   */
  async getProductBySlug(slug, countryCode = 'AE') {
    if (!slug) return null;

    const country = await this.resolveCountry(countryCode);

    const [product] = await db.query(
      `SELECT
        p.id,
        p.name,
        p.name_ar,
        p.slug,
        p.gender,
        p.sku,
        p.specifications,
        p.short_description,
        p.short_description_ar,
        p.description,
        p.description_ar,
        p.seo_title,
        p.seo_description,
        p.seo_keywords,
        p.is_featured,
        p.is_limited_edition,
        p.edition_size,
        p.is_bundle,
        p.created_at,
        p.updated_at,
        c.id AS category_id,
        c.name AS category_name,
        c.name_ar AS category_name_ar,
        c.slug AS category_slug,
        b.id AS brand_id,
        b.name AS brand_name,
        b.slug AS brand_slug,
        b.logo_url AS brand_logo,
        ps.name AS size_label,
        -- Country pricing projection (STRICTLY NO cost_price)
        COALESCE(pcp.price, 0) AS price,
        pcp.price_10ml AS price_10ml,
        COALESCE(pcp.stock_quantity, 0) AS stock_quantity,
        COALESCE(pcp.is_available, 1) AS is_available,
        -- Country-specific SEO override if exists
        pcseo.seo_title AS country_seo_title,
        pcseo.seo_description AS country_seo_description,
        pcseo.seo_keywords AS country_seo_keywords
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN product_sizes ps ON ps.id = p.size_id
       LEFT JOIN product_country_pricing pcp ON pcp.product_id = p.id AND pcp.country_id = ?
       LEFT JOIN product_country_seo pcseo ON pcseo.product_id = p.id AND pcseo.country_id = ?
       WHERE p.slug = ? AND p.status = 'active' AND p.deleted_at IS NULL
       LIMIT 1`,
      [country.id, country.id, slug]
    );

    if (!product) return null;

    // Parse specifications JSON safely
    let specs = {};
    if (product.specifications) {
      try {
        specs = typeof product.specifications === 'string'
          ? JSON.parse(product.specifications)
          : product.specifications;
      } catch {
        specs = {};
      }
    }

    // Parallel fetch: Images, Fragrance Notes, Olfactory Families, Bundle Items, and Related Products
    const [images, notes, olfactoryFamilies, bundleItems, relatedProducts] = await Promise.all([
      // Gallery images
      db.query(
        `SELECT id, url, alt_text, is_primary, sort_order
         FROM product_images
         WHERE product_id = ?
         ORDER BY is_primary DESC, sort_order ASC, id ASC`,
        [product.id]
      ),

      // Fragrance notes grouped by level (top, heart, base)
      db.query(
        `SELECT fn.id, fn.name, fn.name_ar, fn.slug, fn.image_url, pfn.note_level, pfn.sort_order
         FROM product_fragrance_notes pfn
         JOIN fragrance_notes fn ON fn.id = pfn.note_id
         WHERE pfn.product_id = ?
         ORDER BY pfn.note_level, pfn.sort_order ASC`,
        [product.id]
      ),

      // Olfactory families
      db.query(
        `SELECT ofa.id, ofa.name, ofa.name_ar, ofa.slug, ofa.icon_url
         FROM product_olfactory_families pof
         JOIN olfactory_families ofa ON ofa.id = pof.olfactory_family_id
         WHERE pof.product_id = ?
         ORDER BY ofa.name ASC`,
        [product.id]
      ),

      // Bundle items (if bundle)
      product.is_bundle
        ? db.query(
            `SELECT id, name, name_ar, size, quantity, image_url, scent_profile,
                    notes_summary, notes_summary_ar, description, description_ar, sort_order
             FROM product_bundle_items
             WHERE bundle_product_id = ?
             ORDER BY sort_order ASC, id ASC`,
            [product.id]
          )
        : Promise.resolve([]),

      // Related products (up to 4 recommendations)
      db.query(
        `SELECT
           rp.id,
           rp.name,
           rp.name_ar,
           rp.slug,
           COALESCE(rpcp.price, 0) AS price,
           COALESCE(rpcp.stock_quantity, 0) AS stock_quantity,
           COALESCE(rpcp.is_available, 1) AS is_available,
           (
             SELECT url FROM product_images
             WHERE product_id = rp.id
             ORDER BY is_primary DESC, sort_order ASC, id ASC
             LIMIT 1
           ) AS primary_image
         FROM product_relations pr
         JOIN products rp ON rp.id = pr.related_product_id
         LEFT JOIN product_country_pricing rpcp ON rpcp.product_id = rp.id AND rpcp.country_id = ?
         WHERE pr.product_id = ? AND rp.status = 'active' AND rp.deleted_at IS NULL
         LIMIT 4`,
        [country.id, product.id]
      ),
    ]);

    // Group fragrance notes into Olfactory Pyramid
    const notesPyramid = {
      top: notes.filter((n) => n.note_level === 'top'),
      heart: notes.filter((n) => n.note_level === 'heart'),
      base: notes.filter((n) => n.note_level === 'base'),
      general: notes.filter((n) => n.note_level === 'general'),
    };

    // Calculate SEO metadata
    const finalSeoTitle = product.country_seo_title || product.seo_title || `${product.name} | Alaynaas Luxury Perfumes`;
    const finalSeoDescription = product.country_seo_description || product.seo_description || product.short_description || '';
    const finalKeywords = product.country_seo_keywords || product.seo_keywords || '';

    // Primary image URL
    const mainImage = images.find((i) => i.is_primary)?.url || images[0]?.url || null;

    // Structured Data: Schema.org Product for Google Rich Results
    const schemaOrg = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: product.name,
      image: images.map((i) => i.url),
      description: finalSeoDescription,
      sku: product.sku || `ALY-${product.id}`,
      brand: {
        '@type': 'Brand',
        name: product.brand_name || 'Alaynaas',
      },
      offers: {
        '@type': 'Offer',
        priceCurrency: country.currency_code,
        price: parseFloat(product.price) || 0,
        availability: product.stock_quantity > 0 && product.is_available
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
    };

    return {
      id: product.id,
      name: product.name,
      name_ar: product.name_ar,
      slug: product.slug,
      gender: product.gender,
      sku: product.sku,
      size: product.size_label,
      specifications: specs,
      short_description: product.short_description,
      short_description_ar: product.short_description_ar,
      description: product.description,
      description_ar: product.description_ar,
      is_featured: Boolean(product.is_featured),
      is_limited_edition: Boolean(product.is_limited_edition),
      edition_size: product.edition_size || null,
      is_bundle: Boolean(product.is_bundle),
      category: {
        id: product.category_id,
        name: product.category_name,
        name_ar: product.category_name_ar,
        slug: product.category_slug,
      },
      brand: {
        id: product.brand_id,
        name: product.brand_name,
        slug: product.brand_slug,
        logo: product.brand_logo,
      },
      pricing: {
        price: parseFloat(product.price) || 0,
        price_10ml: product.price_10ml !== null && product.price_10ml !== undefined ? parseFloat(product.price_10ml) : null,
        stock_quantity: product.stock_quantity,
        in_stock: product.stock_quantity > 0 && Boolean(product.is_available),
        currency_code: country.currency_code,
        currency_symbol: country.currency_symbol,
        country_code: country.code,
      },
      variants: buildVariants(product.size_label, product.price, product.price_10ml),
      images,
      primary_image: mainImage,
      notes_pyramid: notesPyramid,
      olfactory_families: olfactoryFamilies,
      bundle_items: bundleItems,
      related_products: relatedProducts.map((rp) => ({
        ...rp,
        price: parseFloat(rp.price) || 0,
        currency_symbol: country.currency_symbol,
      })),
      seo: {
        title: finalSeoTitle,
        description: finalSeoDescription,
        keywords: finalKeywords,
        schema: schemaOrg,
      },
    };
  }

  /**
   * Create a public storefront order with database-level price calculation,
   * atomic row locking, and inventory verification.
   *
   * SECURITY & INTEGRITY:
   * - Client prices and totals are completely ignored and recalculated from MySQL.
   * - Product inventory is locked with FOR UPDATE to prevent race conditions / overselling.
   * - Entire operation is wrapped inside a single atomic ACID transaction.
   * - System audit logs and order status history are recorded.
   *
   * @param {Object} orderData Customer order payload from storefront
   * @param {Object} req Express request object for audit IP and UA tracking
   * @returns {Promise<Object>} Created order details safe for storefront response
   */
  async createStoreOrder(orderData, req) {
    const {
      country_code = 'AE',
      customer = {},
      address = {},
      payment = 'cod',
      payment_method,
      notes = '',
      items = [],
    } = orderData;

    // 1. Resolve country
    const targetCountryCode = (country_code || 'AE').toUpperCase();
    const [country] = await db.query(
      'SELECT id, name, code, currency_code, currency_symbol, tax_percentage FROM countries WHERE code = ? AND is_active = 1 LIMIT 1',
      [targetCountryCode]
    );

    if (!country) {
      throw Object.assign(
        new Error(`Country '${targetCountryCode}' is not supported for online orders`),
        { statusCode: 400 }
      );
    }

    const countryId = country.id;

    // 2. Open atomic transaction
    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
      // 3. Concurrency-safe sequential order number generation (AM-{CODE}-{YYYYMM}-{00001})
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const prefix = `AM-${country.code}-${yearMonth}-`;

      const [lastOrders] = await conn.execute(
        "SELECT order_number FROM orders WHERE order_number LIKE CONCAT(?, '%') ORDER BY id DESC LIMIT 1 FOR UPDATE",
        [prefix]
      );

      let nextSeq = 1;
      if (lastOrders && lastOrders[0] && lastOrders[0].order_number) {
        const parts = lastOrders[0].order_number.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) nextSeq = lastNum + 1;
      }
      const orderNumber = `${prefix}${String(nextSeq).padStart(5, '0')}`;

      // 4. Validate items, recalculate pricing securely from DB, and lock inventory
      let subtotal = 0;
      const verifiedItems = [];

      for (const rawItem of items) {
        const productId = parseInt(rawItem.id || rawItem.product_id, 10);
        const quantity = Math.max(1, parseInt(rawItem.qty || rawItem.quantity, 10) || 1);

        // Fetch product info
        const [prodRows] = await conn.execute(
          `SELECT p.id, p.name, p.name_ar, p.sku, p.is_bundle, ps.name AS size_name,
                  (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS image_url
           FROM products p
           LEFT JOIN product_sizes ps ON ps.id = p.size_id
           WHERE p.id = ? AND p.status = 'active' AND p.deleted_at IS NULL`,
          [productId]
        );

        const prod = prodRows[0];
        if (!prod) {
          throw Object.assign(new Error(`Product #${productId} is no longer available`), { statusCode: 400 });
        }

        // Fetch pricing & lock stock quantity row
        const [pricingRows] = await conn.execute(
          `SELECT price, price_10ml, cost_price, stock_quantity, is_available
           FROM product_country_pricing
           WHERE product_id = ? AND country_id = ? FOR UPDATE`,
          [productId, countryId]
        );

        const pricing = pricingRows[0];
        if (!pricing) {
          throw Object.assign(new Error(`Product "${prod.name}" is not available in ${country.name}`), { statusCode: 400 });
        }

        if (!pricing.is_available) {
          throw Object.assign(new Error(`Product "${prod.name}" is currently unavailable`), { statusCode: 400 });
        }

        if (pricing.stock_quantity < quantity) {
          throw Object.assign(
            new Error(`Insufficient stock for "${prod.name}". Available: ${pricing.stock_quantity}, requested: ${quantity}`),
            { statusCode: 400 }
          );
        }

        // Server-side authoritative pricing (10ml variant uses its own price)
        const wants10ml = String(rawItem.variant || rawItem.variant_key || '').toLowerCase() === '10ml';
        if (wants10ml && !(parseFloat(pricing.price_10ml) > 0)) {
          throw Object.assign(new Error(`10ml size is not available for "${prod.name}"`), { statusCode: 400 });
        }
        const unitPrice = wants10ml ? parseFloat(pricing.price_10ml) : (parseFloat(pricing.price) || 0);
        const costPrice = pricing.cost_price !== null ? parseFloat(pricing.cost_price) : 0;
        const lineTotal = parseFloat((unitPrice * quantity).toFixed(3));
        subtotal += lineTotal;

        // Bundle children snapshot if applicable
        let bundleSnapshot = null;
        if (prod.is_bundle) {
          const [bundleRows] = await conn.execute(
            `SELECT id, name, name_ar, size, quantity, image_url, scent_profile
             FROM product_bundle_items
             WHERE bundle_product_id = ?
             ORDER BY sort_order ASC, id ASC`,
            [productId]
          );
          bundleSnapshot = bundleRows.length ? JSON.stringify(bundleRows) : null;
        }

        verifiedItems.push({
          product_id: prod.id,
          product_name: prod.name,
          product_name_ar: prod.name_ar,
          sku: prod.sku,
          size_name: wants10ml ? '10ml' : (prod.size_name || 'Standard'),
          image_url: prod.image_url,
          unit_price: unitPrice,
          cost_price: costPrice,
          quantity,
          line_total: lineTotal,
          is_bundle: prod.is_bundle ? 1 : 0,
          bundle_items_snapshot: bundleSnapshot,
        });
      }

      // 5. Calculate shipping & tax
      // Fee and free-delivery threshold are managed in Admin settings (shipping_fee / shipping_free_over)
      let SHIPPING_FREE_OVER = 200;
      let DEFAULT_SHIPPING_FEE = 15;
      try {
        const shipRows = await db.query(
          "SELECT `key`, `value` FROM system_settings WHERE `key` IN ('shipping_fee', 'shipping_free_over')"
        );
        for (const r of shipRows) {
          const n = parseFloat(r.value);
          if (!Number.isFinite(n) || n < 0) continue;
          if (r.key === 'shipping_fee') DEFAULT_SHIPPING_FEE = n;
          if (r.key === 'shipping_free_over') SHIPPING_FREE_OVER = n;
        }
      } catch { /* keep defaults */ }
      const shippingFee = subtotal >= SHIPPING_FREE_OVER ? 0.000 : DEFAULT_SHIPPING_FEE;

      const taxPercentage = parseFloat(country.tax_percentage) || 5.00;
      const taxAmount = parseFloat(((subtotal * taxPercentage) / 100).toFixed(3));
      const totalAmount = parseFloat((subtotal + taxAmount + shippingFee).toFixed(3));

      // 6. Payment method and status
      const chosenPayment = (payment_method || payment || 'cod').toLowerCase();
      let normalizedPaymentMethod = 'cash_on_delivery';
      let initialPaymentStatus = 'unpaid';
      let initialOrderStatus = 'confirmed';

      if (['card', 'credit_card'].includes(chosenPayment)) {
        normalizedPaymentMethod = 'credit_card';
        initialPaymentStatus = 'unpaid';
      } else if (['apple_pay', 'applepay'].includes(chosenPayment)) {
        normalizedPaymentMethod = 'apple_pay';
        initialPaymentStatus = 'unpaid';
      }

      // Format shipping address object
      const formattedAddress = {
        recipient_name: customer.name,
        phone: customer.phone,
        address_line1: address.line,
        address_line2: null,
        city: address.city || address.emirate || 'Dubai',
        state_province_emirate: address.emirate || 'Dubai',
        country_code: country.code,
        delivery_instructions: notes || null,
      };

      // 7. Insert into `orders`
      const [orderResult] = await conn.execute(
        `INSERT INTO orders (
          order_number, country_id, customer_name, customer_email, customer_phone,
          currency_code, currency_symbol, subtotal, shipping_fee, tax_percentage,
          tax_amount, discount_amount, total_amount, payment_status, payment_method,
          total_paid, total_refunded, status, shipping_address, billing_address,
          customer_notes, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          orderNumber,
          countryId,
          customer.name.trim(),
          customer.email.trim().toLowerCase(),
          customer.phone.trim(),
          country.currency_code,
          country.currency_symbol,
          subtotal,
          shippingFee,
          taxPercentage,
          taxAmount,
          0.000, // discount_amount
          totalAmount,
          initialPaymentStatus,
          normalizedPaymentMethod,
          0.000, // total_paid
          0.000, // total_refunded
          initialOrderStatus,
          JSON.stringify(formattedAddress),
          JSON.stringify(formattedAddress),
          notes ? notes.trim() : null,
        ]
      );

      const orderId = orderResult.insertId;

      // 8. Insert line items & deduct inventory atomically
      for (const item of verifiedItems) {
        await conn.execute(
          `INSERT INTO order_items (
            order_id, product_id, product_name, product_name_ar, sku,
            size_name, image_url, unit_price, cost_price, quantity,
            line_total, is_bundle, bundle_items_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.product_id,
            item.product_name,
            item.product_name_ar,
            item.sku,
            item.size_name,
            item.image_url,
            item.unit_price,
            item.cost_price,
            item.quantity,
            item.line_total,
            item.is_bundle,
            item.bundle_items_snapshot,
          ]
        );

        // Deduct inventory atomically
        await conn.execute(
          `UPDATE product_country_pricing
           SET stock_quantity = stock_quantity - ?
           WHERE product_id = ? AND country_id = ?`,
          [item.quantity, item.product_id, countryId]
        );
      }

      // 9. Initial order status history
      await conn.execute(
        `INSERT INTO order_status_history (
          order_id, old_status, new_status, changed_by_user_id, notes, notified_customer
        ) VALUES (?, NULL, ?, NULL, ?, 1)`,
        [orderId, initialOrderStatus, 'Order placed via online storefront']
      );

      // 10. Commit transaction
      await conn.commit();

      // Log storefront audit event
      await loggerService.logAction({
        source: 'storefront',
        userId: null,
        userEmail: customer.email,
        action: 'order.storefront_create',
        category: 'orders',
        targetType: 'orders',
        targetId: orderId,
        targetLabel: orderNumber,
        details: {
          order_number: orderNumber,
          total_amount: totalAmount,
          items_count: verifiedItems.length,
          payment_method: normalizedPaymentMethod,
        },
        req,
      });

      return {
        id: orderNumber,
        order_id: orderId,
        order_number: orderNumber,
        status: initialOrderStatus,
        payment_status: initialPaymentStatus,
        payment_method: normalizedPaymentMethod,
        currency: country.currency_code,
        currency_symbol: country.currency_symbol,
        subtotal,
        shipping_fee: shippingFee,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        items: verifiedItems.map((i) => ({
          product_id: i.product_id,
          name: i.product_name,
          sku: i.sku,
          size: i.size_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          line_total: i.line_total,
          image_url: i.image_url,
        })),
        created_at: new Date().toISOString(),
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new StoreService();
