/**
 * Adds soft-delete ("Trash") columns to products and orders.
 *   deleted_at - when the record was moved to Trash (NULL = active)
 *   deleted_by - admin user who trashed it
 * Safe to re-run.
 */
const db = require('../src/config/db');

async function main() {
  try {
    for (const table of ['products', 'orders']) {
      await db.query(`ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS \`deleted_at\` DATETIME NULL DEFAULT NULL`);
      await db.query(`ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS \`deleted_by\` INT NULL DEFAULT NULL`);
      await db.query(`ALTER TABLE \`${table}\` ADD INDEX IF NOT EXISTS \`idx_${table}_deleted_at\` (\`deleted_at\`)`);
      console.log(`OK: ${table} trash columns ready`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

main();
