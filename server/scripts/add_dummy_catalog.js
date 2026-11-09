/**
 * Dummy catalogue data so no product page, card or section is empty.
 * Everything here is placeholder content to be replaced from the admin panel.
 *
 *  - extra gallery images (copied from the storefront's lifestyle photos)
 *  - fragrance notes for products that have none
 *  - olfactory family, edition size, sku where missing
 *  - specifications: occasion, how to use, item family, character sliders, "wear it when"
 *  - related products
 *  - sample reviews (email ends with @dummy.alaynaas, delete them in Admin > Reviews before launch)
 *  - descriptions for categories that have none
 *  - strips the "Ahmed Al Maghribi" prefix from imported note names
 *
 * Only fills what is empty. Safe to re-run. Remove the sample reviews with:
 *   DELETE FROM product_reviews WHERE email LIKE '%@dummy.alaynaas';
 */
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const SRC = path.resolve(__dirname, '../../../../alaynaas-web/public/images');
const DEST = path.resolve(__dirname, '../uploads/Products');
const BASE_URL = process.env.PUBLIC_UPLOADS_BASE || 'http://localhost:3000/uploads/Products';

// slug -> extra gallery images [file, alt]
const GALLERY = {
  'after-dark': [['craft.jpg', 'After Dark, made by hand in small batches'], ['notebook.jpg', 'The After Dark formula notebook']],
  'lost-summer': [['uae.jpg', 'Lost Summer, a bright day in the UAE'], ['finder.jpg', 'Choosing a fragrance with Lost Summer']],
  'bakhoor-al-emarat': [['bakhoor.jpg', 'Bakhoor Al Emarat burning on charcoal'], ['cat-bakhoor.jpg', 'Hand-finished bakhoor tablets']],
  'discovery-set': [['travel-set.jpg', 'The Alaynaas discovery set, travel size'], ['question.jpg', 'Finding your scent with the discovery set']],
  'santal-naqiun': [['oud-maattar.jpg', 'Santal Naqiun concentrated oil'], ['materials.jpg', 'Sandalwood and the materials behind the oil']],
  'oud-exclusive': [['exclusive.jpg', 'Oud Exclusive, a private run'], ['workbench.jpg', 'Blending Oud Exclusive at the workbench']],
};

// note ids already in fragrance_notes
const NOTES = {
  'bakhoor-al-emarat': { top: [2, 1], heart: [25, 60, 47], base: [36, 107, 28] },
  'santal-naqiun': { top: [2, 1], heart: [26, 25], base: [92, 313, 28, 29] },
  'oud-exclusive': { top: [1, 2], heart: [25, 60, 47], base: [8, 36, 107, 21, 28] },
};

const FAMILY = { 'bakhoor-al-emarat': 21, 'discovery-set': 2 }; // Oriental, Oriental Amber
const EDITION = { 'santal-naqiun': 100, 'oud-exclusive': 50 };

// specifications additions. character = [fresh→warm, bright→dark, soft→bold, airy→deep] (0-100)
const SPEC = {
  formula7: { character: [40, 40, 55, 45], wear: ['Everyday wear|الاستخدام اليومي', 'The office|العمل', 'Warm evenings|الأمسيات الدافئة'], occasion: 'Everyday', how: 'Spray on pulse points and clothing, from about 15 cm.' },
  'ember-noir': { character: [75, 80, 70, 75], wear: ['Cool evenings|الأمسيات الباردة', 'Dinner and events|العشاء والمناسبات', 'Autumn and winter|الخريف والشتاء'], occasion: 'Evening', how: 'Spray on pulse points and clothing. One or two sprays is enough.' },
  'lost-summer': { character: [25, 20, 40, 25], wear: ['Warm days|الأيام الدافئة', 'Weekends and travel|عطلات نهاية الأسبوع والسفر', 'Spring and summer|الربيع والصيف'], occasion: 'Daytime', how: 'Spray on skin after a shower, and reapply through the day.' },
  'after-dark': { character: [70, 75, 60, 70], wear: ['Evenings out|الأمسيات', 'Cooler weather|الطقس البارد', 'Special occasions|المناسبات الخاصة'], occasion: 'Evening', how: 'Spray on pulse points or clothing. It stays from dinner to the end of the night.' },
  'bakhoor-al-emarat': { character: [80, 85, 65, 90], wear: ['Welcoming guests|استقبال الضيوف', 'Home and majlis|المنزل والمجلس', 'Eid and celebrations|العيد والمناسبات'], occasion: 'Home', how: 'Light a charcoal disc, let it turn grey, then place one tablet on top.', itemFamily: 'Bakhoor', productFamily: 'Home fragrance' },
  'discovery-set': { character: [50, 50, 50, 50], wear: ['Trying before you buy|التجربة قبل الشراء', 'Travel|السفر', 'Gifting|الإهداء'], occasion: 'Any', how: 'Try one scent at a time on a different pulse point and give it a few hours to settle.', itemFamily: 'Discovery set', productFamily: 'Gift sets' },
  'santal-naqiun': { character: [65, 60, 35, 60], wear: ['Close to the skin|قريب من البشرة', 'Prayer and quiet moments|الصلاة واللحظات الهادئة', 'All year|طوال العام'], occasion: 'Everyday', how: 'Dab a little on the wrists and neck. A drop goes a long way.', itemFamily: 'Concentrated oil', productFamily: 'Perfume oils' },
  'oud-exclusive': { character: [85, 90, 85, 90], wear: ['Special occasions|المناسبات الخاصة', 'Evening and winter|المساء والشتاء', 'Collectors|عشاق العطور النادرة'], occasion: 'Occasion', how: 'Apply sparingly on pulse points. Oud develops slowly on the skin.', itemFamily: 'Oud', productFamily: 'Exclusive creations' },
};

const REVIEWS = {
  formula7: [
    [5, 'Sara M.', 'Easy to wear every day', 'Clean, balanced and it lasts through the workday. I get compliments every time.'],
    [4, 'Omar H.', 'Good all-rounder', 'Not too sweet, not too heavy. A safe and nice choice for the office.'],
  ],
  'ember-noir': [
    [5, 'Khalid A.', 'Proper evening scent', 'Warm and smoky without being heavy. Lasted all night and into the next morning on my shirt.'],
    [5, 'Layla R.', 'Rich and smooth', 'I wear it in winter. The dry-down is beautiful and people ask what it is.'],
    [4, 'Yousef T.', 'Strong projection', 'Two sprays is plenty. Great for dinners.'],
  ],
  'lost-summer': [
    [5, 'Noor S.', 'Fresh and bright', 'It smells like a warm day. Light but I can still smell it hours later.'],
    [4, 'Hessa K.', 'Lovely for daytime', 'Soft and clean. I would like it to last a little longer, but I love the scent.'],
    [5, 'Mariam D.', 'Perfect for summer', 'Not sharp like most citrus perfumes. Very easy to love.'],
  ],
  'after-dark': [
    [5, 'Rashid B.', 'Warm amber, beautiful', 'Smooth vanilla and amber. Gets better as it dries down. Worth the price.'],
    [5, 'Aisha F.', 'My new signature', 'Cozy and elegant. I wear the 10ml in my bag for touch-ups.'],
    [4, 'Faisal N.', 'Great evening fragrance', 'Rich without being overpowering. Nice bottle too.'],
  ],
  'bakhoor-al-emarat': [
    [5, 'Maitha Z.', 'The whole house smells amazing', 'Burns evenly and the scent stays in the room for hours. Our guests always notice it.'],
    [4, 'Saeed M.', 'Authentic bakhoor', 'Warm and traditional. A little goes a long way.'],
  ],
  'discovery-set': [
    [5, 'Dana W.', 'Perfect way to choose', 'I tried all of them over a week and finally picked my bottle. Great idea.'],
    [5, 'Ahmed L.', 'Great gift', 'Bought it for my sister. The box looks lovely and she enjoyed every scent.'],
    [4, 'Reem O.', 'Good value', 'Nice sizes for travel. I wish there were a few more scents in it.'],
  ],
  'santal-naqiun': [
    [5, 'Hamad J.', 'Creamy and calming', 'Soft sandalwood that stays close to the skin. Lasts all day with just a drop.'],
    [5, 'Shamma E.', 'Beautiful oil', 'Smooth and warm. I love that it is alcohol-free.'],
  ],
  'oud-exclusive': [
    [5, 'Abdullah Q.', 'A serious oud', 'Deep, resinous and it keeps changing on the skin. Worth every dirham.'],
    [5, 'Mansoor G.', 'Rare and refined', 'You can tell this is made in small batches. Very long lasting.'],
  ],
};
// two more for the products that already have one real review
REVIEWS.formula7.push([5, 'Ghada P.', 'Love the bottle and the scent', 'Fresh floral opening that settles into something warm. I reorder it.']);

const CATEGORY_COPY = {
  'oriental-fragrance': ['Warm, resinous and rich: amber, oud and spice in the oriental tradition.', 'دافئ وغني براتنجات العنبر والعود والتوابل على الطريقة الشرقية.'],
  'exclusive-creations': ['Small-batch creations made in limited runs, for those who like to own something rare.', 'إبداعات بكميات محدودة، لمن يحب أن يقتني ما هو نادر.'],
};

(async () => {
  try {
    fs.mkdirSync(DEST, { recursive: true });
    const products = await db.query('SELECT id, slug, specifications FROM products');
    const bySlug = Object.fromEntries(products.map((p) => [p.slug, p]));
    const log = { images: 0, notes: 0, reviews: 0, relations: 0, spec: 0, cats: 0 };

    // 1. gallery images
    for (const [slug, list] of Object.entries(GALLERY)) {
      const p = bySlug[slug]; if (!p) continue;
      const have = await db.query('SELECT url FROM product_images WHERE product_id = ?', [p.id]);
      let order = have.length;
      for (const [file, alt] of list) {
        const from = path.join(SRC, file);
        const to = path.join(DEST, `dummy-${slug}-${file}`);
        if (!fs.existsSync(to)) { if (!fs.existsSync(from)) { console.warn('missing source image', from); continue; } fs.copyFileSync(from, to); }
        const url = `${BASE_URL}/${encodeURIComponent(`dummy-${slug}-${file}`)}`;
        if (have.some((h) => h.url === url)) continue;
        await db.query('INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, 0)', [p.id, url, alt, order++]);
        log.images++;
      }
    }

    // 2. notes
    for (const [slug, lv] of Object.entries(NOTES)) {
      const p = bySlug[slug]; if (!p) continue;
      const [{ n }] = await db.query('SELECT COUNT(*) n FROM product_fragrance_notes WHERE product_id = ?', [p.id]);
      if (n > 0) continue;
      let order = 1;
      for (const level of ['top', 'heart', 'base']) {
        for (const noteId of lv[level]) {
          await db.query('INSERT INTO product_fragrance_notes (product_id, note_id, note_level, sort_order) VALUES (?, ?, ?, ?)', [p.id, noteId, level, order++]);
          log.notes++;
        }
      }
    }

    // 3. family, edition size, sku
    for (const [slug, fam] of Object.entries(FAMILY)) {
      const p = bySlug[slug]; if (!p) continue;
      await db.query('UPDATE products SET olfactory_family_id = ? WHERE id = ? AND olfactory_family_id IS NULL', [fam, p.id]);
      const [{ n }] = await db.query('SELECT COUNT(*) n FROM product_olfactory_families WHERE product_id = ?', [p.id]);
      if (!n) await db.query('INSERT INTO product_olfactory_families (product_id, olfactory_family_id, is_primary, sort_order) VALUES (?, ?, 1, 0)', [p.id, fam]);
    }
    for (const [slug, size] of Object.entries(EDITION)) {
      const p = bySlug[slug]; if (!p) continue;
      await db.query('UPDATE products SET edition_size = ? WHERE id = ? AND edition_size IS NULL', [size, p.id]);
    }
    if (bySlug['santal-naqiun']) await db.query("UPDATE products SET sku = 'ALY-SN-010' WHERE id = ? AND (sku IS NULL OR sku = '')", [bySlug['santal-naqiun'].id]);

    // 4. specifications
    for (const [slug, add] of Object.entries(SPEC)) {
      const p = bySlug[slug]; if (!p) continue;
      let spec = p.specifications;
      if (typeof spec === 'string') { try { spec = JSON.parse(spec); } catch { spec = {}; } }
      spec = spec && typeof spec === 'object' ? spec : {};
      const set = (k, v) => { if (v !== undefined && (spec[k] === undefined || spec[k] === null || spec[k] === '')) { spec[k] = v; return true; } return false; };
      let changed = false;
      changed = set('character', add.character) || changed;
      changed = set('wear', add.wear) || changed;
      changed = set('occasion', add.occasion) || changed;
      changed = set('how_to_use', add.how) || changed;
      changed = set('itemFamily', add.itemFamily) || changed;
      changed = set('product_family', add.productFamily) || changed;
      if (changed) { await db.query('UPDATE products SET specifications = ? WHERE id = ?', [JSON.stringify(spec), p.id]); log.spec++; }
    }

    // 5. related products: next three products in the list
    const ids = products.map((p) => p.id);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      for (let k = 1; k <= 3; k++) {
        const rel = ids[(i + k) % ids.length];
        if (rel === id) continue;
        const [{ n }] = await db.query("SELECT COUNT(*) n FROM product_relations WHERE product_id = ? AND related_product_id = ? AND relation_type = 'related'", [id, rel]);
        if (n) continue;
        await db.query("INSERT INTO product_relations (product_id, related_product_id, relation_type, sort_order) VALUES (?, ?, 'related', ?)", [id, rel, k]);
        log.relations++;
      }
    }

    // 6. sample reviews
    for (const [slug, list] of Object.entries(REVIEWS)) {
      const p = bySlug[slug]; if (!p) continue;
      let i = 0;
      for (const [rating, name, title, body] of list) {
        const email = `${slug}-${i++}@dummy.alaynaas`;
        const [{ n }] = await db.query('SELECT COUNT(*) n FROM product_reviews WHERE email = ?', [email]);
        if (n) continue;
        await db.query("INSERT INTO product_reviews (product_id, name, email, rating, title, body, status, ip, moderated_by, moderated_at) VALUES (?, ?, ?, ?, ?, ?, 'approved', '127.0.0.1', 1, NOW())", [p.id, name, email, rating, title, body]);
        log.reviews++;
      }
    }

    // 7. categories with no description, and brand prefixes in imported note names
    for (const [slug, [en, ar]] of Object.entries(CATEGORY_COPY)) {
      const r = await db.query("UPDATE categories SET description = ?, description_ar = ? WHERE slug = ? AND (description IS NULL OR description = '')", [en, ar, slug]);
      log.cats += r.affectedRows || 0;
    }
    // note-name brand prefix is stripped at display time (renaming collides with unique names)

    if (redisClient) {
      try { for (const pat of ['*product*', '*categor*', '*review*']) { const keys = await redisClient.keys(pat); if (keys.length) await redisClient.del(keys); } } catch { /* ignore */ }
    }
    console.log('SUCCESS', JSON.stringify(log));
    process.exit(0);
  } catch (e) { console.error('Error:', e); process.exit(1); }
})();
