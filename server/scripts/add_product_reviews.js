/**
 * Creates the `product_reviews` table (Admin > Reviews moderation + storefront product reviews).
 * Safe to re-run.
 */
const db = require('../src/config/db');

async function main() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL,
        rating TINYINT NOT NULL,
        title VARCHAR(150) NULL,
        body TEXT NOT NULL,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        ip VARCHAR(64) NULL,
        moderated_by INT NULL,
        moderated_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_reviews_product_status (product_id, status),
        INDEX idx_reviews_status_created (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('SUCCESS: product_reviews ready');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
