const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'perfume_admin',
    multipleStatements: true,
  });

  console.log('Connected to MySQL');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS product_olfactory_families (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      olfactory_family_id INT NOT NULL,
      is_primary BOOLEAN DEFAULT FALSE,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (olfactory_family_id) REFERENCES olfactory_families(id) ON DELETE CASCADE,
      UNIQUE KEY uq_prod_family (product_id, olfactory_family_id)
    ) ENGINE=InnoDB;

    -- Add additional master fragrance families if not existing
    INSERT INTO olfactory_families (name, name_ar, slug, description, icon_url) VALUES
      ('Spicy', 'حار / توابلي', 'spicy', 'Warm, invigorating spices of cardamom, pink pepper, and saffron', '/icons/spicy.svg'),
      ('Leather', 'جلدي', 'leather', 'Smoky, opulent suede, birch tar, and rich leather accords', '/icons/leather.svg'),
      ('Chypre', 'شيبر', 'chypre', 'Classic harmony of bergamot, oakmoss, labdanum, and patchouli', '/icons/chypre.svg'),
      ('Aromatic Fougère', 'أروماتك فوجير', 'aromatic-fougere', 'Herbal, fresh lavender, clary sage, and geranium accords', '/icons/aromatic.svg'),
      ('Aquatic Marine', 'بحري مائي', 'aquatic-marine', 'Cool ocean sea breeze, calone, and aquatic freshness', '/icons/aquatic.svg'),
      ('Fruity', 'فاكهي', 'fruity', 'Succulent notes of blackcurrant, pear, peach, and crisp apple', '/icons/fruity.svg')
    ON DUPLICATE KEY UPDATE name = VALUES(name);

    -- Migrate existing product single olfactory families into the junction table
    INSERT INTO product_olfactory_families (product_id, olfactory_family_id, is_primary, sort_order)
    SELECT id, olfactory_family_id, TRUE, 0
    FROM products
    WHERE olfactory_family_id IS NOT NULL
    ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary);
  `);

  console.log('Table and families created/migrated.');

  const [fams] = await conn.query('SELECT id, slug FROM olfactory_families');
  const famMap = Object.fromEntries(fams.map((f) => [f.slug, f.id]));

  const [existingProducts] = await conn.query('SELECT id FROM products');
  const prodIds = existingProducts.map(p => p.id);

  for (const pid of prodIds) {
    if (pid === 1 && famMap['woody'] && famMap['spicy'] && famMap['oriental-amber']) {
      await conn.query(`
        INSERT INTO product_olfactory_families (product_id, olfactory_family_id, is_primary, sort_order) VALUES
          (1, ${famMap['woody']}, TRUE, 0),
          (1, ${famMap['spicy']}, FALSE, 1),
          (1, ${famMap['oriental-amber']}, FALSE, 2)
        ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary)
      `);
    } else if (pid === 2 && famMap['oriental-amber'] && famMap['floral'] && famMap['woody']) {
      await conn.query(`
        INSERT INTO product_olfactory_families (product_id, olfactory_family_id, is_primary, sort_order) VALUES
          (2, ${famMap['oriental-amber']}, TRUE, 0),
          (2, ${famMap['floral']}, FALSE, 1),
          (2, ${famMap['woody']}, FALSE, 2)
        ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary)
      `);
    } else if (pid === 3 && famMap['woody'] && famMap['leather'] && famMap['oriental-amber']) {
      await conn.query(`
        INSERT INTO product_olfactory_families (product_id, olfactory_family_id, is_primary, sort_order) VALUES
          (3, ${famMap['woody']}, TRUE, 0),
          (3, ${famMap['leather']}, FALSE, 1),
          (3, ${famMap['oriental-amber']}, FALSE, 2)
        ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary)
      `);
    }
  }
  console.log('Seeded multi-accords for existing products.');

  await conn.end();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
