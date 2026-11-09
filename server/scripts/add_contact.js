/**
 * Contact module (Admin > Storefront > Contact):
 *  - table `contact_messages` for messages sent from the storefront contact form
 *  - public settings for the contact page (title/intro, opening hours, map link, social links)
 * Existing settings (support_email, support_phone, whatsapp_number, store_address) are reused.
 * Safe to re-run: existing values are never overwritten.
 */
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const SETTINGS = [
  ['contact_title_en', 'Let us talk.', 'Contact page heading (English)'],
  ['contact_title_ar', 'تحدّث إلينا.', 'Contact page heading (Arabic)'],
  ['contact_text_en', 'A question about a fragrance, an order or a gift? Write to us and we will reply within one working day.', 'Contact page intro (English)'],
  ['contact_text_ar', 'سؤال عن عطر أو طلب أو هدية؟ راسلنا وسنرد خلال يوم عمل واحد.', 'Contact page intro (Arabic)'],
  ['contact_hours_en', 'Saturday to Thursday, 10:00 to 19:00 (UAE time)', 'Opening / support hours (English)'],
  ['contact_hours_ar', 'من السبت إلى الخميس، 10:00 صباحًا حتى 7:00 مساءً (بتوقيت الإمارات)', 'Opening / support hours (Arabic)'],
  ['store_address_ar', '', 'Address (Arabic)'],
  ['contact_map_url', '', 'Google Maps link for the address'],
  ['social_instagram', '', 'Instagram profile URL'],
  ['social_facebook', '', 'Facebook page URL'],
  ['social_tiktok', '', 'TikTok profile URL'],
  ['social_youtube', '', 'YouTube channel URL'],
  ['social_x', '', 'X (Twitter) profile URL'],
  ['social_snapchat', '', 'Snapchat profile URL'],
];

(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL,
        phone VARCHAR(40) NULL,
        subject VARCHAR(150) NULL,
        message TEXT NOT NULL,
        status ENUM('new','read','archived') NOT NULL DEFAULT 'new',
        ip VARCHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_contact_status (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    for (const [key, value, description] of SETTINGS) {
      await db.query(
        'INSERT IGNORE INTO system_settings (`group`, `key`, `value`, `type`, `is_public`, `description`) VALUES (?, ?, ?, ?, 1, ?)',
        ['contact', key, value, 'string', description]
      );
    }
    if (redisClient) { try { await redisClient.del('settings:public'); } catch { /* ignore */ } }
    console.log('SUCCESS: contact_messages + contact settings ready');
    process.exit(0);
  } catch (e) { console.error('Error:', e); process.exit(1); }
})();
