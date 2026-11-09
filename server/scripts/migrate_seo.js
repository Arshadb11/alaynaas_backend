const db = require('../src/config/db');

async function migrate() {
  console.log('Creating product_country_seo table...');
  await db.query(`
    CREATE TABLE IF NOT EXISTS product_country_seo (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      country_id INT NOT NULL,
      seo_title VARCHAR(255),
      seo_description VARCHAR(500),
      seo_keywords VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_prod_country_seo (product_id, country_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
      INDEX idx_seo_product (product_id),
      INDEX idx_seo_country (country_id)
    ) ENGINE=InnoDB
  `);

  console.log('Backfilling existing products into product_country_seo for each active country...');
  await db.query(`
    INSERT IGNORE INTO product_country_seo (product_id, country_id, seo_title, seo_description, seo_keywords)
    SELECT p.id, c.id, p.seo_title, p.seo_description, p.seo_keywords
    FROM products p
    CROSS JOIN countries c
    WHERE p.seo_title IS NOT NULL OR p.seo_description IS NOT NULL OR p.seo_keywords IS NOT NULL
  `);

  const count = await db.query('SELECT COUNT(*) as cnt FROM product_country_seo');
  console.log('product_country_seo rows:', count[0]?.cnt);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
