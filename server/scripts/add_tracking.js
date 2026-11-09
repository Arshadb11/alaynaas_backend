/**
 * Tracking & verification IDs (Admin > Storefront > Pages > SEO defaults).
 * Public settings so the storefront can place the scripts. Safe to re-run: existing values are never overwritten.
 */
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const SETTINGS = [
  ['tracking_ga4_id', '', 'Google Analytics 4 measurement ID (G-XXXXXXXXXX)'],
  ['tracking_gtm_id', '', 'Google Tag Manager container ID (GTM-XXXXXXX). Use either GA4 or GTM, not both.'],
  ['tracking_meta_pixel_id', '', 'Meta (Facebook/Instagram) Pixel ID'],
  ['tracking_google_verification', '', 'Google Search Console verification token (content of the meta tag)'],
  ['tracking_bing_verification', '', 'Bing Webmaster verification token (msvalidate.01)'],
];

(async () => {
  try {
    for (const [key, value, description] of SETTINGS) {
      await db.query(
        'INSERT IGNORE INTO system_settings (`group`, `key`, `value`, `type`, `is_public`, `description`) VALUES (?, ?, ?, ?, 1, ?)',
        ['seo', key, value, 'string', description]
      );
    }
    if (redisClient) { try { await redisClient.del('settings:public'); } catch { /* ignore */ } }
    console.log('SUCCESS: tracking settings ready');
    process.exit(0);
  } catch (e) { console.error('Error:', e); process.exit(1); }
})();
