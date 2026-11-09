const db = require('../src/config/db');

async function main() {
  const [rows] = await db.query('SELECT `key`, `value` FROM system_settings WHERE `group` = "branding"');
  console.log(rows);
  process.exit(0);
}

main();
