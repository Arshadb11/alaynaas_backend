/**
 * Trust & footer settings (Admin > Storefront > Contact > "Trust & footer"):
 *  - footer_payment_methods: comma list of badges shown in the footer (cod, visa, mastercard, amex, applepay, tabby, tamara)
 *  - promise_*: the "Our promise" block on the home page (heading + 4 pillars, English and Arabic).
 *    Tokens {free_over}, {delivery_days}, {refund_days} are replaced with the live shipping settings.
 * Safe to re-run: existing values are never overwritten.
 */
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const P = [
  ['Authentic and hand-finished', 'أصلي ومُنجز يدويًا', 'Every fragrance is composed with care by our perfumers and prepared by hand before it reaches you.', 'كل عطر يُركَّب بعناية على يد صانعي العطور لدينا ويُجهَّز يدويًا قبل أن يصل إليك.'],
  ['Delivered across the UAE', 'توصيل إلى جميع أنحاء الإمارات', 'Delivered in {delivery_days} working days. Free delivery on orders over {free_over}.', 'يصلك الطلب خلال {delivery_days} أيام عمل. توصيل مجاني للطلبات فوق {free_over}.'],
  ['Easy returns', 'إرجاع سهل', 'Not right? Ask for a return or an exchange within {refund_days} days of delivery.', 'لم يناسبك؟ اطلب الإرجاع أو الاستبدال خلال {refund_days} أيام من التسليم.'],
  ['Pay when it arrives', 'ادفع عند الاستلام', 'Cash on delivery is available, so you pay only when your order reaches you.', 'الدفع عند الاستلام متاح، فلا تدفع إلا حين يصلك طلبك.'],
];

const SETTINGS = [
  ['footer_payment_methods', 'cod', 'Payment badges shown in the footer (comma separated)'],
  ['promise_kicker_en', 'Our promise', 'Home "Our promise" small heading (English)'],
  ['promise_kicker_ar', 'وعدنا', 'Home "Our promise" small heading (Arabic)'],
  ['promise_title_en', 'Made with care. Delivered with confidence.', 'Home "Our promise" heading (English)'],
  ['promise_title_ar', 'صُنع بعناية. يصلك بثقة.', 'Home "Our promise" heading (Arabic)'],
];
P.forEach(([te, ta, xe, xa], i) => {
  const n = i + 1;
  SETTINGS.push([`promise_${n}_title_en`, te, `Promise ${n} title (English)`]);
  SETTINGS.push([`promise_${n}_title_ar`, ta, `Promise ${n} title (Arabic)`]);
  SETTINGS.push([`promise_${n}_text_en`, xe, `Promise ${n} text (English)`]);
  SETTINGS.push([`promise_${n}_text_ar`, xa, `Promise ${n} text (Arabic)`]);
});

(async () => {
  try {
    for (const [key, value, description] of SETTINGS) {
      await db.query(
        'INSERT IGNORE INTO system_settings (`group`, `key`, `value`, `type`, `is_public`, `description`) VALUES (?, ?, ?, ?, 1, ?)',
        ['contact', key, value, 'string', description]
      );
    }
    if (redisClient) { try { await redisClient.del('settings:public'); } catch { /* ignore */ } }
    console.log('SUCCESS: trust & promise settings ready');
    process.exit(0);
  } catch (e) { console.error('Error:', e); process.exit(1); }
})();
