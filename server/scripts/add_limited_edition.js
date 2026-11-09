/**
 * Adds the Limited Edition flag to products and creates the homepage product-type categories.
 * Safe to re-run (checks before altering / inserting).
 */
const db = require('../src/config/db');

const CATEGORIES = [
  { slug: 'discovery-sets', name: 'Discovery Sets', name_ar: 'مجموعات الاستكشاف', sort: 20 },
  { slug: 'bakhoor', name: 'Bakhoor', name_ar: 'بخور', sort: 30 },
  { slug: 'oud-maattar', name: "Oud Ma'attar", name_ar: 'معطر العود', sort: 31 },
  { slug: 'concentrated-oils', name: 'Concentrated Oils', name_ar: 'زيوت مركزة', sort: 40 },
  { slug: 'exclusive-creations', name: 'Exclusive Creations', name_ar: 'إبداعات حصرية', sort: 50 },
];

(async () => {
  const cols = await db.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'"
  );
  const have = new Set(cols.map((c) => c.COLUMN_NAME));
  if (!have.has('is_limited_edition')) {
    await db.query('ALTER TABLE products ADD COLUMN is_limited_edition TINYINT(1) NOT NULL DEFAULT 0 AFTER is_featured');
    console.log('+ products.is_limited_edition');
  }
  if (!have.has('edition_size')) {
    await db.query('ALTER TABLE products ADD COLUMN edition_size INT NULL AFTER is_limited_edition');
    console.log('+ products.edition_size');
  }

  for (const c of CATEGORIES) {
    const [row] = await db.query('SELECT id FROM categories WHERE slug = ?', [c.slug]);
    if (row) { console.log(`= category exists: ${c.slug}`); continue; }
    await db.query(
      'INSERT INTO categories (name, name_ar, slug, parent_id, sort_order, is_active) VALUES (?, ?, ?, 0, ?, 1)',
      [c.name, c.name_ar, c.slug, c.sort]
    );
    console.log(`+ category: ${c.slug}`);
  }
  console.log('Done.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
