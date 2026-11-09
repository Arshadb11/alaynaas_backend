/**
 * Product page extras:
 *  - product_faq (json, public): the FAQ shown on every product page. Edited in Admin > Storefront > Product FAQ.
 *    Tokens {delivery_days}, {free_over}, {refund_days}, {shipping_fee} are filled from the live settings.
 *  - Placeholder "longevity" and "sillage" for products that have none yet (Admin > Products > Specifications).
 *    Replace them with the real values per product. Existing values are never overwritten.
 * Safe to re-run.
 */
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const FAQ = [
  ['How long does the fragrance last?', 'كم يدوم العطر؟',
    'Longevity depends on your skin and the concentration. Each product page shows an estimate. For longer wear, apply to moisturised skin at the pulse points.',
    'يعتمد الثبات على بشرتك وتركيز العطر. تعرض كل صفحة منتج تقديرًا للثبات. لثبات أطول، ضع العطر على بشرة مرطّبة عند نقاط النبض.'],
  ['How do I choose a fragrance?', 'كيف أختار العطر المناسب؟',
    'Try our Discover quiz, or start with a discovery set to live with a few scents before choosing a full bottle.',
    'جرّب اختبار الاكتشاف، أو ابدأ بطقم الاكتشاف لتجرّب عدة عطور قبل اختيار الزجاجة الكاملة.'],
  ['How long does delivery take?', 'كم تستغرق مدة التوصيل؟',
    'We deliver across the UAE in {delivery_days} working days. Delivery is {shipping_fee}, and free on orders over {free_over}.',
    'نوصّل إلى جميع أنحاء الإمارات خلال {delivery_days} أيام عمل. رسوم التوصيل {shipping_fee}، ومجانًا للطلبات فوق {free_over}.'],
  ['Can I return or exchange my order?', 'هل يمكنني إرجاع الطلب أو استبداله؟',
    'Yes. Contact us within {refund_days} days of delivery and we will arrange a return or an exchange. See our returns policy for details.',
    'نعم. تواصل معنا خلال {refund_days} أيام من التسليم وسنرتّب الإرجاع أو الاستبدال. راجع سياسة الإرجاع للتفاصيل.'],
  ['Can I pay when the order arrives?', 'هل يمكنني الدفع عند الاستلام؟',
    'Yes, cash on delivery is available across the UAE.',
    'نعم، الدفع عند الاستلام متاح في جميع أنحاء الإمارات.'],
  ['How should I store my fragrance?', 'كيف أحفظ عطري؟',
    'Keep the bottle in a cool, dry place away from direct sunlight and heat. Avoid the bathroom, where humidity changes can alter the scent.',
    'احفظ الزجاجة في مكان بارد وجاف بعيدًا عن أشعة الشمس والحرارة. تجنّب الحمّام لأن تغيّر الرطوبة قد يغيّر الرائحة.'],
];
const DEFAULT_FAQ = FAQ.map(([q_en, q_ar, a_en, a_ar]) => ({ q_en, q_ar, a_en, a_ar }));

(async () => {
  try {
    await db.query(
      "INSERT IGNORE INTO system_settings (`group`, `key`, `value`, `type`, `is_public`, `description`) VALUES ('storefront', 'product_faq', ?, 'json', 1, 'FAQ shown on product pages (en/ar)')",
      [JSON.stringify(DEFAULT_FAQ)]
    );

    const rows = await db.query('SELECT id, slug, specifications FROM products');
    let n = 0;
    for (const r of rows) {
      let spec = r.specifications;
      if (typeof spec === 'string') { try { spec = JSON.parse(spec); } catch { spec = {}; } }
      spec = spec && typeof spec === 'object' ? spec : {};
      let changed = false;
      if (!spec.longevity) { spec.longevity = '6-8 hours'; changed = true; }
      if (!spec.sillage) { spec.sillage = 'Moderate'; changed = true; }
      if (changed) {
        await db.query('UPDATE products SET specifications = ? WHERE id = ?', [JSON.stringify(spec), r.id]);
        n++;
      }
    }
    if (redisClient) {
      try { await redisClient.del('settings:public'); } catch { /* ignore */ }
      try { const keys = await redisClient.keys('*product*'); if (keys.length) await redisClient.del(keys); } catch { /* ignore */ }
    }
    console.log(`SUCCESS: product_faq ready, placeholder longevity/sillage set on ${n} products`);
    process.exit(0);
  } catch (e) { console.error('Error:', e); process.exit(1); }
})();
