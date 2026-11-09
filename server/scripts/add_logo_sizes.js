/**
 * Adds logo size settings (height in px) so each brand asset can be sized from the Admin Panel.
 * Safe to re-run: existing values are never overwritten.
 */
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const SIZE_SETTINGS = [
  { key: 'frontend_logo_height', value: '28', description: 'Storefront header logo height (px)' },
  { key: 'footer_logo_height', value: '64', description: 'Storefront footer logo height (px)' },
  { key: 'admin_logo_height', value: '32', description: 'Admin panel sidebar logo height (px)' },
];

async function main() {
  try {
    for (const s of SIZE_SETTINGS) {
      await db.query(
        `INSERT INTO system_settings (\`group\`, \`key\`, \`value\`, \`type\`, \`is_public\`, \`description\`)
         VALUES ('branding', ?, ?, 'number', 1, ?)
         ON DUPLICATE KEY UPDATE \`is_public\` = 1, \`type\` = 'number', \`description\` = VALUES(\`description\`)`,
        [s.key, s.value, s.description]
      );
    }
    if (redisClient) {
      try { await redisClient.del('settings:public'); } catch { /* ignore */ }
    }
    console.log('SUCCESS: logo size settings ready');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
