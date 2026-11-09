/**
 * Adds dynamic SEO support:
 *  - static_pages.meta_title / meta_keywords (Admin > Storefront > Pages)
 *  - public site-wide defaults in system_settings (Admin > Storefront > Pages > SEO defaults)
 *
 * Safe to re-run: existing values are never overwritten.
 */
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const SETTINGS = [
  { key: 'seo_site_title', value: '', description: 'Default meta title (English). Leave blank to use "Store name | Tagline"' },
  { key: 'seo_site_title_ar', value: '', description: 'Default meta title (Arabic)' },
  { key: 'seo_site_description', value: 'ALAYNAAS: luxury perfume, bakhoor, oud muattar and concentrated oils from the UAE. Hand-finished fragrances for those who carry the crown.', description: 'Default meta description (English)' },
  { key: 'seo_site_description_ar', value: 'ALAYNAAS: عطور فاخرة وبخور ودهن عود وزيوت مركّزة من الإمارات.', description: 'Default meta description (Arabic)' },
  { key: 'seo_site_keywords', value: 'luxury perfume, oud, bakhoor, attar, perfume UAE, Dubai perfume, Alaynaas', description: 'Default meta keywords (comma separated)' },
  { key: 'seo_og_image', value: '', description: 'Default social sharing image (URL or /uploads path)' },
];

async function addColumn(table, column, ddl) {
  const rows = await db.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  if (!rows.length) await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
}

(async () => {
  try {
    await addColumn('static_pages', 'meta_title', 'meta_title VARCHAR(200) NULL AFTER summary_ar');
    await addColumn('static_pages', 'meta_keywords', 'meta_keywords VARCHAR(300) NULL AFTER meta_title');
    for (const s of SETTINGS) {
      await db.query(
        'INSERT IGNORE INTO system_settings (`group`, `key`, `value`, `type`, `is_public`, `description`) VALUES (?, ?, ?, ?, 1, ?)',
        ['seo', s.key, s.value, 'string', s.description]
      );
    }
    if (redisClient) { try { await redisClient.del('settings:public'); } catch { /* ignore */ } }
    console.log('SUCCESS: SEO columns and settings ready');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
