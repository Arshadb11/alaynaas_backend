/**
 * Seeds the Storefront "Announcement Bar" (pre-header marquee) settings.
 * Safe to re-run: existing values are never overwritten.
 *
 * Message tokens resolved on the storefront:
 *   {free_over}    -> free-shipping threshold (Shipping settings)
 *   {shipping_fee} -> standard delivery fee   (Shipping settings)
 */
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const DEFAULT_ITEMS = [
  { en: 'Delivered across the UAE', ar: 'التوصيل إلى جميع أنحاء الإمارات', active: true },
  { en: 'Free delivery over {free_over}', ar: 'توصيل مجاني للطلبات فوق {free_over}', active: true },
  { en: 'Cash on delivery or card', ar: 'الدفع عند الاستلام أو بالبطاقة', active: true },
  { en: 'Discovery & travel sets', ar: 'مجموعات الاكتشاف والسفر', active: true },
  { en: 'For those who carry the crown', ar: 'لمن يحملون التاج', active: true },
];

const SETTINGS = [
  { key: 'marquee_enabled', value: '1', type: 'boolean', description: 'Show the announcement bar above the header' },
  { key: 'marquee_speed', value: '48', type: 'number', description: 'Announcement bar scroll duration in seconds (higher = slower)' },
  { key: 'marquee_items', value: JSON.stringify(DEFAULT_ITEMS), type: 'json', description: 'Announcement bar messages (en/ar)' },
];

async function main() {
  try {
    for (const s of SETTINGS) {
      // INSERT IGNORE keeps any value the admin has already saved.
      await db.query(
        `INSERT IGNORE INTO system_settings (\`group\`, \`key\`, \`value\`, \`type\`, \`is_public\`, \`description\`)
         VALUES ('storefront', ?, ?, ?, 1, ?)`,
        [s.key, s.value, s.type, s.description]
      );
    }
    if (redisClient) {
      try { await redisClient.del('settings:public'); } catch { /* ignore */ }
    }
    console.log('SUCCESS: announcement bar settings ready');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
