const mysql = require('mysql2/promise');

async function migrateBundles() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'perfume_admin',
    multipleStatements: true,
  });

  console.log('Connected to perfume_admin.');

  // 1. Add is_bundle column to products
  console.log('1. Adding is_bundle column to products...');
  await conn.query(`
    ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN DEFAULT FALSE AFTER is_featured;
  `);

  // 2. Create product_bundle_items table
  console.log('2. Creating product_bundle_items table...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS product_bundle_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bundle_product_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      name_ar VARCHAR(255) DEFAULT NULL,
      size VARCHAR(50) DEFAULT NULL,
      quantity INT NOT NULL DEFAULT 1,
      image_url VARCHAR(500) DEFAULT NULL,
      scent_profile VARCHAR(255) DEFAULT NULL,
      notes_summary TEXT DEFAULT NULL,
      notes_summary_ar TEXT DEFAULT NULL,
      description TEXT DEFAULT NULL,
      description_ar TEXT DEFAULT NULL,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (bundle_product_id) REFERENCES products(id) ON DELETE CASCADE,
      INDEX idx_bundle_product (bundle_product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Mark is_bundle = TRUE for K-series Giftset (id=614) and other giftset collections
  console.log('3. Updating is_bundle flag on products...');
  await conn.query(`
    UPDATE products 
    SET is_bundle = TRUE 
    WHERE id = 614 
       OR name LIKE '%Giftset%' 
       OR name LIKE '%Gift Set%' 
       OR JSON_UNQUOTE(JSON_EXTRACT(specifications, '$.is_collection')) = 'true'
       OR JSON_UNQUOTE(JSON_EXTRACT(specifications, '$.is_collection')) = '1';
  `);

  // 4. Seed bundle items for K-series Giftset (#614)
  console.log('4. Seeding bundle items for K-series Giftset (#614)...');
  await conn.query('DELETE FROM product_bundle_items WHERE bundle_product_id = 614');
  
  await conn.query(`
    INSERT INTO product_bundle_items (
      bundle_product_id, name, name_ar, size, quantity, image_url, scent_profile, notes_summary, notes_summary_ar, sort_order
    ) VALUES 
    (
      614,
      'The Roots 2000',
      'الجذور ٢٠٠٠',
      '10ml',
      1,
      'octophotos/the-roots.jpg',
      'Oriental Aldehydic Woody',
      'Top: Grapefruit, Aldehydes, Jasmine | Heart: White Flowers, Lily, Rose, Saffron | Base: Hindi Oud, Incense, Vanilla, Ambroxan',
      'القمة: جريب فروت، ألدهيدات، ياسمين | القلب: زهور بيضاء، زنبق، ورد، زعفران | القاعدة: عود هندي، بخور، فانيليا، أمبروكسان',
      1
    ),
    (
      614,
      'The Alchemy Lab 2025',
      'مختبر الخيمياء ٢٠٢٥',
      '10ml',
      1,
      'octophotos/alchemy-lab.jpg',
      'Vibrant Citrus Aromatic Woody',
      'Top: Bergamot, Mandarin, Juniper, Saffron | Heart: Sambac Jasmine, Rose, Cardamom, Bakhoor | Base: Cambodian Oud, Leather, Cedarwood, Ambergris',
      'القمة: برغموت، يوسفي، زعفران | القلب: ياسمين سامباك، ورد، هيل، بخور | القاعدة: عود كمبودي، جلد، خشب الأرز، عنبر',
      2
    ),
    (
      614,
      'The Beyond 2050',
      'ما وراء ٢٠٥٠',
      '10ml',
      1,
      'octophotos/the-beyond.jpg',
      'Fruity Oriental Woody',
      'Top: Mandarin, Peach, Pear, Bergamot, Ginger | Heart: Freesia, Jasmine, Orange Blossom, Saffron, Leather | Base: Bakhoory, Musk, Vanilla, Rose, Ambroxan',
      'القمة: يوسفي، خوخ، كمثرى، زنجبيل | القلب: فريزيا، ياسمين، زهر البرتقال، زعفران، جلد | القاعدة: بخوري، مسك، فانيليا، ورد، أمبروكسان',
      3
    );
  `);

  // 5. Clean up the 3 fake placeholder products (615, 616, 617) from products table
  console.log('5. Removing fake placeholder products (615, 616, 617) from products...');
  await conn.query('DELETE FROM products WHERE id IN (615, 616, 617)');

  // Verify
  const [bundleRows] = await conn.query('SELECT * FROM product_bundle_items WHERE bundle_product_id = 614');
  console.log('\n✓ Bundle items for K-series Giftset (#614):');
  console.table(bundleRows.map(r => ({
    id: r.id,
    bundle_id: r.bundle_product_id,
    name: r.name,
    name_ar: r.name_ar,
    size: r.size,
    qty: r.quantity,
    profile: r.scent_profile
  })));

  const [count] = await conn.query('SELECT COUNT(*) as total FROM products');
  console.log(`✓ Clean total products in catalog: ${count[0].total}`);

  await conn.end();
}

migrateBundles().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
