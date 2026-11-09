const db = require('../config/db');
const redisClient = require('../config/redis');
const loggerService = require('./logger.service');
const path = require('path');
const storage = require('./storage.service');

class SettingsService {
  /**
   * Helper: Cast database string value to its typed representation
   */
  _castValue(val, type) {
    if (val === null || val === undefined) return null;
    switch (type) {
      case 'number':
        return Number(val);
      case 'boolean':
        return val === '1' || val === 1 || val === 'true' || val === true;
      case 'json':
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      default:
        return String(val);
    }
  }

  /**
   * Helper: Convert value to string for database storage
   */
  _serializeValue(val, type) {
    if (val === null || val === undefined) return null;
    switch (type) {
      case 'boolean':
        return val ? '1' : '0';
      case 'json':
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      default:
        return String(val);
    }
  }

  /**
   * Retrieve all settings grouped by category for Admin Panel
   */
  async getAllSettings() {
    const rows = await db.query(
      'SELECT id, `group`, `key`, `value`, `type`, `is_public`, `description`, `updated_at` FROM system_settings ORDER BY `group` ASC, id ASC'
    );

    const grouped = {};
    const flat = {};

    for (const r of rows) {
      let val = this._castValue(r.value, r.type);

      // Mask SMTP password for security
      if (r.key === 'smtp_password' && val) {
        val = '••••••••';
      }

      if (!grouped[r.group]) grouped[r.group] = {};
      grouped[r.group][r.key] = {
        value: val,
        type: r.type,
        is_public: Boolean(r.is_public),
        description: r.description,
        updated_at: r.updated_at,
      };

      flat[r.key] = val;
    }

    return { grouped, flat };
  }

  /**
   * Retrieve public settings for Storefront (cached)
   */
  async getPublicSettings() {
    const cacheKey = 'settings:public';

    // 1. Try Redis cache
    if (redisClient) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch {
        // Fallback to DB
      }
    }

    // 2. Query MySQL
    const rows = await db.query(
      'SELECT `key`, `value`, `type` FROM system_settings WHERE is_public = 1'
    );

    const settings = {};
    for (const r of rows) {
      settings[r.key] = this._castValue(r.value, r.type);
    }

    // 3. Cache for 10 minutes
    if (redisClient) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(settings), 'EX', 600);
      } catch {
        // Ignore cache write error
      }
    }

    return settings;
  }

  /**
   * Announcement bar messages: max 10, plain text only, trimmed and length-limited.
   * Items without an English message are dropped.
   */
  _sanitizeMarqueeItems(items) {
    if (!Array.isArray(items)) {
      throw Object.assign(new Error('marquee_items must be a list'), { statusCode: 400 });
    }
    const clean = (s) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, 120);
    const cleanUrl = (u) => this._cleanLink(u);
    return items
      .slice(0, 10)
      .map((m) => {
        const url = cleanUrl(m?.url);
        return {
          en: clean(m?.en),
          ar: clean(m?.ar),
          active: m?.active !== false,
          url,
          // Link label only makes sense with a URL
          link_en: url ? clean(m?.link_en) : '',
          link_ar: url ? clean(m?.link_ar) : '',
        };
      })
      .filter((m) => m.en);
  }

  /**
   * Links: only same-site paths ("/page"), http(s) URLs, or (when allowed) in-page anchors ("#shop").
   * Blocks javascript:, data:, "//host" etc.
   */
  _cleanLink(u, { allowAnchor = false } = {}) {
    const url = String(u ?? '').trim().slice(0, 300);
    if (!url) return '';
    if (/^\/(?!\/)[^\s<>"'\\]*$/.test(url)) return url;
    if (/^https?:\/\/[^\s<>"'\\]+$/i.test(url)) return url;
    if (allowAnchor && /^#[A-Za-z0-9_-]+$/.test(url)) return url;
    throw Object.assign(
      new Error(`Invalid link "${url}". Use a page path like /fragrances or a full https:// address.`),
      { statusCode: 400 }
    );
  }

  /**
   * Hero slider slides: max 8, plain text only, validated image/link/date fields.
   * Slides without an image or English headline are dropped.
   */
  _sanitizeHeroSlides(slides) {
    if (!Array.isArray(slides)) {
      throw Object.assign(new Error('hero_slides must be a list'), { statusCode: 400 });
    }
    const text = (s, max = 120) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, max);
    // Images must be uploaded/bundled assets or https URLs (never javascript:/data:)
    const image = (u) => {
      const url = String(u ?? '').trim().slice(0, 300);
      if (/^\/(uploads|images)\/[^\s<>"'\\]+$/.test(url) || /^https:\/\/[^\s<>"'\\]+$/i.test(url)) return url;
      return '';
    };
    const date = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d ?? '')) ? String(d) : '');
    // object-position such as "50% 30%"
    const pos = (p) => (/^\d{1,3}% \d{1,3}%$/.test(String(p ?? '')) ? String(p) : '50% 50%');
    const both = (m, field, max) => ({ [`${field}_en`]: text(m?.[`${field}_en`], max), [`${field}_ar`]: text(m?.[`${field}_ar`], max) });

    return slides
      .slice(0, 8)
      .map((m) => {
        const href = this._cleanLink(m?.href, { allowAnchor: true });
        const href2 = this._cleanLink(m?.href2, { allowAnchor: true });
        return {
          img: image(m?.img),
          pos: pos(m?.pos),
          active: m?.active !== false,
          start_at: date(m?.start_at),
          end_at: date(m?.end_at),
          ...both(m, 'kick', 80),
          ...both(m, 'l1', 60),
          ...both(m, 'l2', 60),
          ...both(m, 'sub', 220),
          ...both(m, 'alt', 160),
          // A button label only makes sense with a link, and vice versa
          href,
          ...(href ? both(m, 'cta', 40) : { cta_en: '', cta_ar: '' }),
          href2,
          ...(href2 ? both(m, 'cta2', 40) : { cta2_en: '', cta2_ar: '' }),
        };
      })
      .filter((m) => m.img && m.l1_en);
  }

  /**
   * "The House Disciplines" homepage section: section texts + up to 8 category cards.
   * Each card points at a category (by slug); image/text/link overrides are optional.
   */
  _sanitizeHouseDisciplines(raw) {
    const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const text = (s, max = 200) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, max);
    const image = (u) => {
      const url = String(u ?? '').trim().slice(0, 300);
      if (/^\/(uploads|images)\/[^\s<>"'\\]+$/.test(url) || /^https:\/\/[^\s<>"'\\]+$/i.test(url)) return url;
      return '';
    };
    const both = (m, field, max) => ({ [`${field}_en`]: text(m?.[`${field}_en`], max), [`${field}_ar`]: text(m?.[`${field}_ar`], max) });
    const items = (Array.isArray(o.items) ? o.items : [])
      .slice(0, 8)
      .map((m) => ({
        category_slug: text(m?.category_slug, 120).replace(/[^a-z0-9-_]/gi, ''),
        active: m?.active !== false,
        img: image(m?.img),
        href: this._cleanLink(m?.href),
        ...both(m, 'tagline', 80),
        ...both(m, 'title', 80),
        ...both(m, 'desc', 260),
        ...both(m, 'cta', 40),
      }))
      .filter((m) => m.category_slug);
    return {
      ...both(o, 'kicker', 80),
      ...both(o, 'heading', 100),
      ...both(o, 'sub', 300),
      items,
    };
  }

  /**
   * Bulk or key-value update settings
   */
  async updateSettings(settingsMap, user, req) {
    if (!settingsMap || typeof settingsMap !== 'object') {
      throw Object.assign(new Error('Invalid settings payload'), { statusCode: 400 });
    }

    // Fetch existing settings schema to preserve types and ignore unmanaged keys
    const existing = await db.query('SELECT `key`, `type`, `value` FROM system_settings');
    const existingMap = new Map(existing.map((e) => [e.key, e]));

    const updatedKeys = [];

    for (const [key, rawValue] of Object.entries(settingsMap)) {
      if (!existingMap.has(key)) continue;

      // Skip masked password if unchanged
      if (key === 'smtp_password' && (rawValue === '••••••••' || rawValue === '')) {
        continue;
      }

      const meta = existingMap.get(key);
      let value = rawValue;
      if (key === 'marquee_items') value = this._sanitizeMarqueeItems(rawValue);
      if (key === 'marquee_speed') value = Math.min(300, Math.max(10, Number(rawValue) || 48));
      if (key === 'hero_slides') value = this._sanitizeHeroSlides(rawValue);
      if (key === 'house_disciplines') value = this._sanitizeHouseDisciplines(rawValue);
      if (key === 'hero_interval') value = Math.min(20, Math.max(3, Number(rawValue) || 7));
      const serialized = this._serializeValue(value, meta.type);

      await db.query(
        'UPDATE system_settings SET `value` = ?, `updated_by_user_id` = ? WHERE `key` = ?',
        [serialized, user?.id || null, key]
      );

      updatedKeys.push(key);
    }

    // Invalidate public settings cache
    if (redisClient) {
      try {
        await redisClient.del('settings:public');
      } catch {
        // Ignore
      }
    }

    // Write audit log
    await loggerService.logAction({
      source: 'admin_panel',
      userId: user?.id,
      userEmail: user?.email,
      action: 'settings.update',
      category: 'settings',
      targetType: 'settings',
      targetId: null,
      targetLabel: `${updatedKeys.length} settings updated`,
      details: { updatedKeys },
      req,
    });

    return {
      success: true,
      updatedCount: updatedKeys.length,
      updatedKeys,
    };
  }

  /**
   * Upload and register a branding asset (Logo / Favicon)
   */
  async uploadBrandingAsset(file, targetKey, user, req) {
    if (!file) {
      throw Object.assign(new Error('No file uploaded'), { statusCode: 400 });
    }

    const validKeys = [
      'frontend_logo',
      'frontend_logo_dark',
      'footer_logo',
      'admin_logo',
      'favicon',
      'hero_slide', // slider image: file is stored only; the slide list is saved via PUT /settings
      'house_discipline', // House Disciplines card image: stored only; saved via PUT /settings
      'journal_cover', // Journal entry cover image: stored only; saved with the entry
    ];

    if (targetKey && !validKeys.includes(targetKey)) {
      throw Object.assign(new Error(`Invalid branding target key: ${targetKey}`), { statusCode: 400 });
    }

    // Stored at uploads/branding/<key>_<timestamp><ext> (local disk or Vercel Blob)
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanKey = targetKey || 'branding_asset';
    const filename = `${cleanKey}_${Date.now()}${ext}`;
    const rel = `branding/${filename}`;
    await storage.save(rel, file);

    const assetUrl = storage.relativeUrl(rel);

    // If a targetKey is specified, automatically update that setting
    if (targetKey && targetKey !== 'hero_slide' && targetKey !== 'house_discipline') {
      await db.query(
        'UPDATE system_settings SET `value` = ?, `updated_by_user_id` = ? WHERE `key` = ?',
        [assetUrl, user?.id || null, targetKey]
      );

      if (redisClient) {
        try {
          await redisClient.del('settings:public');
        } catch {
          // Ignore
        }
      }

      await loggerService.logAction({
        source: 'admin_panel',
        userId: user?.id,
        userEmail: user?.email,
        action: 'settings.upload_branding',
        category: 'settings',
        targetType: 'settings',
        targetId: targetKey,
        targetLabel: filename,
        details: { targetKey, assetUrl },
        req,
      });
    }

    return {
      success: true,
      targetKey,
      filename,
      url: assetUrl,
    };
  }

  /**
   * Flush application caches (Redis + Storefront ISR)
   */
  async flushCache(user, req) {
    let redisFlushed = false;
    let keysCount = 0;

    if (redisClient) {
      try {
        const keys = await redisClient.keys('*');
        keysCount = keys.length;
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
        redisFlushed = true;
      } catch (err) {
        console.warn('Redis flush error:', err.message);
      }
    }

    // Log action
    await loggerService.logAction({
      source: 'admin_panel',
      userId: user?.id,
      userEmail: user?.email,
      action: 'settings.flush_cache',
      category: 'settings',
      targetType: 'system',
      targetLabel: 'Cache Flush',
      details: { redisFlushed, clearedKeys: keysCount },
      req,
    });

    return {
      success: true,
      redisFlushed,
      clearedKeys: keysCount,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Permanently delete everything currently in Trash (products + orders).
   * Products used in past orders are kept hidden so order history stays intact.
   */
  async emptyTrash(user, req) {
    // Lazy require avoids circular dependencies between services
    const productService = require('./product.service');

    const trashedProducts = await db.query('SELECT id FROM products WHERE deleted_at IS NOT NULL');
    let products = { purged: 0, blocked: 0 };
    if (trashedProducts.length) {
      products = await productService.purgeProducts(trashedProducts.map((r) => r.id), user, req);
    }

    // Order child rows cascade on delete
    const orderRes = await db.query('DELETE FROM orders WHERE deleted_at IS NOT NULL');
    const orders = orderRes?.affectedRows || 0;

    await loggerService.logAction({
      source: 'admin_panel',
      userId: user?.id,
      userEmail: user?.email,
      action: 'settings.empty_trash',
      category: 'settings',
      targetType: 'system',
      targetLabel: 'Empty Trash',
      details: { products_purged: products.purged, products_blocked: products.blocked, orders_purged: orders },
      severity: 'warning',
      req,
    });

    return { productsPurged: products.purged, productsBlocked: products.blocked, ordersPurged: orders };
  }

  /**
   * Optimize database tables and retrieve fragmentation status
   */
  async optimizeDatabase(user, req) {
    const tables = [
      'orders',
      'order_items',
      'products',
      'product_country_pricing',
      'audit_logs',
      'system_settings',
    ];

    const results = [];

    for (const table of tables) {
      try {
        const res = await db.query(`OPTIMIZE TABLE \`${table}\``);
        results.push({
          table,
          status: res[0]?.Msg_text || 'Table is already up to date',
        });
      } catch (err) {
        results.push({
          table,
          status: `Error: ${err.message}`,
        });
      }
    }

    await loggerService.logAction({
      source: 'admin_panel',
      userId: user?.id,
      userEmail: user?.email,
      action: 'settings.optimize_database',
      category: 'settings',
      targetType: 'system',
      targetLabel: 'Database Optimization',
      details: { optimizedTables: tables },
      req,
    });

    return {
      success: true,
      results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retrieve live system runtime metrics
   */
  async getSystemMetrics() {
    const memory = process.memoryUsage();

    // MySQL connection pool health
    let dbStatus = 'connected';
    try {
      await db.query('SELECT 1');
    } catch {
      dbStatus = 'error';
    }

    return {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime_seconds: Math.floor(process.uptime()),
      memory: {
        rss_mb: (memory.rss / (1024 * 1024)).toFixed(1),
        heap_used_mb: (memory.heapUsed / (1024 * 1024)).toFixed(1),
        heap_total_mb: (memory.heapTotal / (1024 * 1024)).toFixed(1),
      },
      db_status: dbStatus,
      redis_status: redisClient ? 'connected' : 'disabled',
      environment: process.env.NODE_ENV || 'development',
      server_time: new Date().toISOString(),
    };
  }
}

module.exports = new SettingsService();
