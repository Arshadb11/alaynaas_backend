const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function runOrdersMigration() {
  console.log('🚀 Running Orders Module Migration...');
  const sqlFile = path.join(__dirname, '../database/orders.sql');
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');

  // Split statements by semicolon (ignoring comments and USE statement)
  const statements = sqlContent
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.toLowerCase().startsWith('use '));

  const conn = await db.getConnection();

  try {
    for (const stmt of statements) {
      if (stmt.trim()) {
        await conn.query(stmt);
      }
    }
    console.log('✓ Migration executed successfully.');

    // Verify created tables
    const [tables] = await conn.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME IN ('orders', 'order_payments', 'order_items', 'order_status_history', 'order_notes')
      ORDER BY TABLE_NAME
    `);

    console.log('\nVerified Orders Tables:');
    tables.forEach((t) => console.log(`  - ${t.TABLE_NAME}`));

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    conn.release();
  }
}

runOrdersMigration();
