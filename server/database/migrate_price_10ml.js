/**
 * Adds the optional 10ml price attribute to product_country_pricing.
 * Safe to run multiple times.  Usage: node database/migrate_price_10ml.js
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'perfume_admin',
  });

  const [cols] = await conn.query(
    "SHOW COLUMNS FROM product_country_pricing LIKE 'price_10ml'"
  );
  if (cols.length === 0) {
    await conn.query(
      'ALTER TABLE product_country_pricing ADD COLUMN price_10ml DECIMAL(12,3) NULL DEFAULT NULL AFTER cost_price'
    );
    console.log('Added price_10ml column');
  } else {
    console.log('price_10ml already exists');
  }
  await conn.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
