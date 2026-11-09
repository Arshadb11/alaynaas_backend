/**
 * Creates the `menu_items` table (storefront navigation) and seeds the default menu
 * that used to be hard-coded in the storefront header. Safe to re-run: the seed only
 * runs when the menu is empty.
 */
const db = require('../src/config/db');

const AR = {
  world: '\u0639\u0627\u0644\u0645\u0646\u0627',
  shop: '\u062a\u0633\u0648\u0642',
  niche: '\u0625\u0628\u062f\u0627\u0639\u0627\u062a \u062d\u0635\u0631\u064a\u0629',
  journal: '\u0627\u0644\u0645\u062c\u0644\u0629',
  discover: '\u0627\u0643\u062a\u0634\u0641',
};

(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      menu_key VARCHAR(30) NOT NULL DEFAULT 'main',
      parent_id INT NOT NULL DEFAULT 0,
      label VARCHAR(100) NOT NULL,
      label_ar VARCHAR(100) NULL,
      link_type ENUM('category','custom','none') NOT NULL DEFAULT 'custom',
      category_id INT NULL,
      url VARCHAR(500) NULL,
      open_new_tab TINYINT(1) NOT NULL DEFAULT 0,
      is_mega TINYINT(1) NOT NULL DEFAULT 0,
      image_url VARCHAR(500) NULL,
      badge VARCHAR(30) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_menu (menu_key, parent_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM menu_items');
  if (n > 0) {
    console.log('Menu already has items, skipping seed.');
    process.exit(0);
  }

  const add = (row) => db.insert('menu_items', { menu_key: 'main', parent_id: 0, sort_order: 0, ...row });

  await add({ label: 'The World', label_ar: AR.world, link_type: 'custom', url: '/story', sort_order: 0 });
  const shopId = await add({ label: 'Shop', label_ar: AR.shop, link_type: 'custom', url: '/fragrances', is_mega: 1, sort_order: 1 });
  await add({ label: 'Exclusive Creations', label_ar: AR.niche, link_type: 'custom', url: '/exclusive-creations', sort_order: 2 });
  await add({ label: 'The Journal', label_ar: AR.journal, link_type: 'custom', url: '/journal', sort_order: 3 });
  await add({ label: 'Discover', label_ar: AR.discover, link_type: 'custom', url: '/discover', sort_order: 4 });

  // Mega menu under "Shop": every active top-level category as a column, its subcategories as links
  const roots = await db.query('SELECT * FROM categories WHERE parent_id = 0 AND is_active = 1 ORDER BY sort_order, name');
  for (let i = 0; i < roots.length; i += 1) {
    const r = roots[i];
    const colId = await add({
      parent_id: shopId, label: r.name, label_ar: r.name_ar || null,
      link_type: 'category', category_id: r.id, sort_order: i,
    });
    const subs = await db.query('SELECT * FROM categories WHERE parent_id = ? AND is_active = 1 ORDER BY sort_order, name', [r.id]);
    for (let j = 0; j < subs.length; j += 1) {
      await add({
        parent_id: colId, label: subs[j].name, label_ar: subs[j].name_ar || null,
        link_type: 'category', category_id: subs[j].id, sort_order: j,
      });
    }
  }

  console.log('menu_items created and seeded.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
