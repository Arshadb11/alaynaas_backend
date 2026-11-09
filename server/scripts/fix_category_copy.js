/**
 * Replaces the pasted third-party article in the "perfumes" category description with Alaynaas copy,
 * and fills categories that have no description. Edit later in Admin > Catalog > Categories.
 * Only empty descriptions and the foreign "Ahmed Al Maghribi" text are touched. Safe to re-run.
 */
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const COPY = {
  perfumes: [
    'Eau de parfum from Alaynaas, made to be worn every day and remembered. Warm ambers, resinous oud and clean modern woods, each one blended in the UAE.',
    'أو دو بارفان من أليناس، صُنع ليُرتدى كل يوم ويبقى في الذاكرة. عنبر دافئ وعود راتنجي وأخشاب حديثة نقية، وكل عطر مُركَّب في الإمارات.',
  ],
  'discovery-sets': [
    'Small sizes of our fragrances in one set, so you can wear them on your own skin before choosing a full bottle.',
    'أحجام صغيرة من عطورنا في طقم واحد، لتجربها على بشرتك قبل اختيار الزجاجة الكاملة.',
  ],
  bakhoor: [
    'Hand-finished bakhoor that fills a room with warm, lasting incense.',
    'بخور مصنوع يدويًا يملأ المكان بدخان دافئ يدوم طويلًا.',
  ],
  'oud-maattar': [
    'Oud and maattar in the traditional way, resinous, deep and unhurried.',
    'عود ومعطّر على الطريقة التقليدية، عميق وراتنجي وهادئ.',
  ],
  'concentrated-oils': [
    'Pure concentrated perfume oils. Alcohol-free, close to the skin and long-lasting.',
    'زيوت عطرية مركّزة نقية، خالية من الكحول، قريبة من البشرة وتدوم طويلًا.',
  ],
};

(async () => {
  try {
    const rows = await db.query('SELECT id, slug, description FROM categories');
    let n = 0;
    for (const r of rows) {
      const c = COPY[r.slug];
      if (!c) continue;
      const d = String(r.description || '');
      if (d.trim() && !/Maghribi/i.test(d)) continue;
      await db.query('UPDATE categories SET description = ?, description_ar = ? WHERE id = ?', [c[0], c[1], r.id]);
      n++;
    }
    if (redisClient) {
      try { const keys = await redisClient.keys('*categor*'); if (keys.length) await redisClient.del(keys); } catch { /* ignore */ }
    }
    console.log(`SUCCESS: ${n} category descriptions updated`);
    process.exit(0);
  } catch (e) { console.error('Error:', e); process.exit(1); }
})();
