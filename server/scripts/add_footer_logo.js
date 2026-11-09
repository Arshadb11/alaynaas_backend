const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

async function main() {
  try {
    // 1. Get current frontend_logo
    const [rows] = await db.query('SELECT `value` FROM system_settings WHERE `key` = "frontend_logo"');
    const defaultVal = rows?.[0]?.value || '/LOGO/Desktop.svg';

    // 2. Set footer_logo
    await db.query(`
      INSERT INTO system_settings (\`group\`, \`key\`, \`value\`, \`type\`, \`is_public\`, \`description\`)
      VALUES ('branding', 'footer_logo', ?, 'string', 1, 'Logo displayed in customer storefront footer')
      ON DUPLICATE KEY UPDATE \`value\` = IF(\`value\` = '' OR \`value\` IS NULL, VALUES(\`value\`), \`value\`), \`is_public\` = 1
    `, [defaultVal]);

    // 3. Clear public settings cache
    if (redisClient) {
      try {
        await redisClient.del('settings:public');
        console.log('Redis settings:public cache cleared');
      } catch (e) {
        // Ignore
      }
    }

    console.log('SUCCESS: footer_logo configured with default', defaultVal);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
