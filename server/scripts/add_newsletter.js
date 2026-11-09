/** Creates the `newsletter_subscribers` table (footer sign-up). Safe to re-run. */
const db = require('../src/config/db');

(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(150) NOT NULL,
      lang VARCHAR(5) NOT NULL DEFAULT 'en',
      ip VARCHAR(64) NULL,
      subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_newsletter_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('newsletter_subscribers ready.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
