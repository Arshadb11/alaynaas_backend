/**
 * Creates the `static_pages` table (Admin > Storefront > Pages) and seeds the policy pages.
 * Also sets the policy values: shipping fee 15, free over 200, delivery 2 - 5 days, refund window 7 days.
 *
 * Safe to re-run: existing pages are never overwritten (edit them in the admin instead).
 * Pass --reset-values to force the shipping/delivery/refund settings back to the defaults above.
 */
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const PAGES = [
  {
    slug: 'shipping', sort: 10,
    title_en: 'Shipping & Delivery', title_ar: 'الشحن والتوصيل',
    summary_en: 'Delivery fees, free shipping threshold, delivery times and how we pack your order.',
    summary_ar: 'رسوم التوصيل، حد الشحن المجاني، مدة التوصيل وطريقة تغليف طلبك.',
    content_en: `## Delivery across the UAE
{store_name} delivers to all seven Emirates. Every order is prepared by hand, checked and packed with care before it leaves us.

## Delivery charges
- Standard delivery: **{shipping_fee}** per order.
- **Free delivery** on every order of **{free_over}** or more.
- The delivery charge is shown in your cart and at checkout before you confirm. There are no hidden fees.

## Delivery time
Orders are delivered within **{delivery_days} working days**, depending on your location. Dubai, Sharjah and Ajman are usually the quickest. Remote areas may take a little longer.

## Order processing
- Orders placed before 2 PM (UAE time) on a working day are usually dispatched the same or the next working day.
- Orders placed on Fridays, weekends or public holidays are processed on the next working day.
- You will receive an email or a message once your order is on its way.

## Cash on delivery
Cash on delivery is available across the UAE. Please keep the exact amount ready if you can, and have a valid phone number so our courier can reach you.

## Delivery attempts
Our courier will try to contact you before delivery. If we cannot reach you after two attempts, the order is returned to us and we will contact you to arrange a new delivery.

## Damaged or missing parcels
Please check your parcel when it arrives. If it is damaged, or something is missing, contact us within 48 hours at {support_email} with your order number and photos, and we will put it right.

## Questions
Write to us at {support_email} or call {support_phone}. We are happy to help.`,
    content_ar: `## التوصيل في جميع أنحاء الإمارات
يوصّل {store_name} إلى جميع الإمارات السبع. يُجهَّز كل طلب يدويًا ويُفحص ويُغلَّف بعناية قبل مغادرته.

## رسوم التوصيل
- التوصيل العادي: **{shipping_fee}** لكل طلب.
- **التوصيل مجاني** لكل طلب بقيمة **{free_over}** أو أكثر.
- تظهر رسوم التوصيل في السلة وعند إتمام الطلب قبل التأكيد، ولا توجد أي رسوم مخفية.

## مدة التوصيل
يتم تسليم الطلبات خلال **{delivery_days} أيام عمل** بحسب موقعك. عادةً تكون دبي والشارقة وعجمان الأسرع، وقد تستغرق المناطق البعيدة وقتًا أطول قليلًا.

## تجهيز الطلبات
- الطلبات المقدمة قبل الساعة 2 ظهرًا (بتوقيت الإمارات) في يوم عمل تُشحن عادةً في اليوم نفسه أو في يوم العمل التالي.
- الطلبات المقدمة أيام الجمعة أو العطلات الأسبوعية أو الرسمية تُجهَّز في يوم العمل التالي.
- ستصلك رسالة بريد إلكتروني أو رسالة نصية عند خروج طلبك للتوصيل.

## الدفع عند الاستلام
الدفع عند الاستلام متاح في جميع أنحاء الإمارات. يُرجى تجهيز المبلغ المطلوب إن أمكن، والتأكد من صحة رقم هاتفك ليتمكن المندوب من الوصول إليك.

## محاولات التوصيل
سيحاول المندوب التواصل معك قبل التسليم. إذا تعذّر الوصول إليك بعد محاولتين، يُعاد الطلب إلينا وسنتواصل معك لترتيب توصيل جديد.

## الشحنات التالفة أو الناقصة
يُرجى فحص الشحنة عند وصولها. إذا كانت تالفة أو ينقصها شيء، تواصل معنا خلال 48 ساعة على {support_email} مع رقم الطلب وصور، وسنعالج الأمر.

## للاستفسار
راسلنا على {support_email} أو اتصل بنا على {support_phone}. يسعدنا مساعدتك.`,
  },
  {
    slug: 'returns', sort: 20,
    title_en: 'Refund & Return Policy', title_ar: 'سياسة الاسترجاع والاسترداد',
    summary_en: 'How returns, exchanges and refunds work within {refund_days} days of delivery.',
    summary_ar: 'كيف تعمل عمليات الإرجاع والاستبدال والاسترداد خلال {refund_days} أيام من التسليم.',
    content_en: `## Our promise
We want you to love what you receive. If something is not right, you have **{refund_days} days from the date of delivery** to ask for a return, an exchange or a refund.

## What can be returned
- Items that are **unopened, unused and sealed**, in their original packaging.
- Items that arrive **damaged, defective or leaking**.
- Items that are **not what you ordered**.

## What cannot be returned
For hygiene and safety reasons, we cannot accept returns of:
- Fragrances, oils or bakhoor that have been **opened, sprayed or used**.
- Discovery and travel sets whose seals or packaging have been broken.
- Gift cards and personalised or made-to-order items.
- Products returned after **{refund_days} days**.

## How to request a return
1. Email {support_email} or call {support_phone} within **{refund_days} days** of delivery.
2. Include your order number, the product, the reason, and clear photos if the item is damaged or incorrect.
3. Once approved, we will arrange a pick-up or tell you where to send the item.

Please keep the product and all packaging together until the return is collected.

## Refunds
- Once we receive and inspect the item, we confirm your refund by email.
- Approved refunds are returned to your **original payment method** within **5 to 10 working days**. Orders paid by cash on delivery are refunded by bank transfer.
- The original delivery charge is refunded only if the return is due to our error (damaged, defective or wrong item).
- For a change of mind on an unopened item, the return delivery cost is borne by the customer.

## Exchanges
If you would like a different product or size, tell us within **{refund_days} days** and we will do our best to arrange an exchange, subject to availability.

## Cancelling an order
You can cancel an order before it is dispatched by contacting us as soon as possible. Once it is on its way, the return policy above applies.

## Your rights
This policy does not affect your statutory rights as a consumer under UAE law.`,
    content_ar: `## وعدنا لك
نريدك أن تحب ما يصلك. إذا لم يكن هناك شيء على ما يرام، فلديك **{refund_days} أيام من تاريخ التسليم** لطلب الإرجاع أو الاستبدال أو الاسترداد.

## ما يمكن إرجاعه
- المنتجات **غير المفتوحة وغير المستخدمة والمختومة** في عبوتها الأصلية.
- المنتجات التي تصل **تالفة أو معيبة أو متسرّبة**.
- المنتجات **المختلفة عمّا طلبتَه**.

## ما لا يمكن إرجاعه
لأسباب تتعلق بالنظافة والسلامة، لا نقبل إرجاع:
- العطور أو الزيوت أو البخور التي **فُتحت أو رُشّت أو استُخدمت**.
- مجموعات الاستكشاف والسفر التي كُسر ختمها أو تغليفها.
- بطاقات الهدايا والمنتجات المخصصة أو المصنوعة حسب الطلب.
- المنتجات المُعادة بعد **{refund_days} أيام**.

## كيف تطلب الإرجاع
1. راسلنا على {support_email} أو اتصل بنا على {support_phone} خلال **{refund_days} أيام** من التسليم.
2. أرفق رقم الطلب والمنتج والسبب وصورًا واضحة إذا كان المنتج تالفًا أو خاطئًا.
3. بعد الموافقة، سنرتب استلام المنتج أو نخبرك بمكان إرساله.

يُرجى الاحتفاظ بالمنتج وجميع عبواته معًا حتى يتم استلام الإرجاع.

## الاسترداد
- بعد استلام المنتج وفحصه، نؤكد لك الاسترداد عبر البريد الإلكتروني.
- تُردّ المبالغ المعتمدة إلى **وسيلة الدفع الأصلية** خلال **5 إلى 10 أيام عمل**. أما الطلبات المدفوعة عند الاستلام فتُسترد عبر تحويل بنكي.
- تُسترد رسوم التوصيل الأصلية فقط إذا كان الإرجاع بسبب خطأ منا (منتج تالف أو معيب أو خاطئ).
- في حال تغيير الرأي بشأن منتج غير مفتوح، يتحمل العميل تكلفة التوصيل عند الإرجاع.

## الاستبدال
إذا رغبت في منتج أو حجم مختلف، أخبرنا خلال **{refund_days} أيام** وسنبذل جهدنا لترتيب الاستبدال بحسب التوفر.

## إلغاء الطلب
يمكنك إلغاء الطلب قبل شحنه بالتواصل معنا في أقرب وقت. بعد خروجه للتوصيل تنطبق سياسة الإرجاع أعلاه.

## حقوقك
لا تؤثر هذه السياسة على حقوقك القانونية كمستهلك بموجب قوانين دولة الإمارات.`,
  },
  {
    slug: 'privacy', sort: 30,
    title_en: 'Privacy Policy', title_ar: 'سياسة الخصوصية',
    summary_en: 'What we collect, why we collect it and how we protect it.',
    summary_ar: 'ما الذي نجمعه ولماذا نجمعه وكيف نحميه.',
    content_en: `## Our approach
{store_name} respects your privacy. We collect only what we need to serve you, we keep it safe, and we never sell it.

## Information we collect
- **Order details:** name, email, phone number and delivery address.
- **Account details:** your email and an encrypted password, if you create an account.
- **Communication:** messages you send us and your newsletter preferences.
- **Technical data:** device, browser and pages visited, collected through cookies to keep the site working and improve it.

Payment card details are handled by our payment provider. We do not store full card numbers.

## How we use it
- To process, deliver and support your orders.
- To contact you about your order or an enquiry.
- To send newsletters and offers, only if you have subscribed. You can unsubscribe at any time.
- To improve our website, products and service.
- To prevent fraud and comply with the law.

## Sharing
We share information only with trusted partners who help us run the store, such as couriers, payment providers and email services, and only what they need to do their job. We never sell your personal data. We may disclose information if required by law or a competent authority.

## Cookies
We use cookies to remember your cart and language and to understand how the site is used. See our Cookie Policy for details.

## Data retention
We keep your information only as long as needed for the purposes above, and as required for accounting and legal obligations.

## Your rights
You may ask to access, correct or delete your personal data, or withdraw your consent to marketing, by writing to {support_email}. We handle personal data in line with the UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data.

## Security
We use secure connections and restricted access to protect your information. No online system is completely risk-free, but we work hard to keep your data safe.

## Changes
We may update this policy from time to time. The latest version is always on this page.

## Contact
{store_name}, {store_address}
Email: {support_email}
Phone: {support_phone}`,
    content_ar: `## نهجنا
يحترم {store_name} خصوصيتك. نجمع فقط ما نحتاجه لخدمتك، ونحفظه بأمان، ولا نبيعه أبدًا.

## المعلومات التي نجمعها
- **بيانات الطلب:** الاسم والبريد الإلكتروني ورقم الهاتف وعنوان التوصيل.
- **بيانات الحساب:** بريدك الإلكتروني وكلمة مرور مشفّرة، إذا أنشأت حسابًا.
- **المراسلات:** الرسائل التي ترسلها إلينا وتفضيلاتك للنشرة البريدية.
- **بيانات تقنية:** الجهاز والمتصفح والصفحات التي تزورها، وتُجمع عبر ملفات تعريف الارتباط لتشغيل الموقع وتحسينه.

تتولى جهة الدفع معالجة بيانات البطاقة، ولا نخزّن أرقام البطاقات كاملة.

## كيف نستخدمها
- لمعالجة طلباتك وتوصيلها ودعمها.
- للتواصل معك بشأن طلبك أو استفسارك.
- لإرسال النشرات والعروض، فقط إذا اشتركت، ويمكنك إلغاء الاشتراك في أي وقت.
- لتحسين موقعنا ومنتجاتنا وخدماتنا.
- لمنع الاحتيال والامتثال للقانون.

## المشاركة
نشارك المعلومات فقط مع شركاء موثوقين يساعدوننا في تشغيل المتجر، مثل شركات التوصيل ومزودي الدفع وخدمات البريد، وبالقدر اللازم لأداء عملهم فقط. لا نبيع بياناتك الشخصية أبدًا. وقد نفصح عن معلومات إذا طلب القانون أو جهة مختصة ذلك.

## ملفات تعريف الارتباط
نستخدمها لتذكّر سلتك ولغتك ولفهم كيفية استخدام الموقع. راجع سياسة ملفات تعريف الارتباط للتفاصيل.

## الاحتفاظ بالبيانات
نحتفظ بمعلوماتك فقط للمدة اللازمة للأغراض المذكورة أعلاه ولما تقتضيه الالتزامات المحاسبية والقانونية.

## حقوقك
يمكنك طلب الاطلاع على بياناتك الشخصية أو تصحيحها أو حذفها، أو سحب موافقتك على التسويق، بمراسلتنا على {support_email}. نتعامل مع البيانات الشخصية وفق المرسوم بقانون اتحادي رقم 45 لسنة 2021 بشأن حماية البيانات الشخصية في دولة الإمارات.

## الأمان
نستخدم اتصالات آمنة وصلاحيات وصول محدودة لحماية معلوماتك. لا يوجد نظام إلكتروني خالٍ تمامًا من المخاطر، لكننا نحرص على حماية بياناتك.

## التغييرات
قد نحدّث هذه السياسة من وقت لآخر، وتجد دائمًا أحدث نسخة في هذه الصفحة.

## التواصل
{store_name}، {store_address}
البريد الإلكتروني: {support_email}
الهاتف: {support_phone}`,
  },
  {
    slug: 'terms', sort: 40,
    title_en: 'Terms & Conditions', title_ar: 'الشروط والأحكام',
    summary_en: 'The terms that apply when you browse and order from our store.',
    summary_ar: 'الشروط المطبقة عند تصفح متجرنا والطلب منه.',
    content_en: `## Agreement
By using this website and placing an order with {store_name}, you agree to these terms. If you do not agree, please do not use the site.

## Our products
We describe and photograph our fragrances, oils and bakhoor as accurately as we can. Colours may vary slightly between screens, and scent is personal: how a fragrance wears depends on your skin. Fragrance notes are descriptive, not a guarantee of how it will smell on you.

## Prices and payment
- All prices are in UAE Dirhams (AED) unless shown otherwise, and include VAT where applicable.
- Delivery is **{shipping_fee}**, and **free on orders of {free_over} or more**.
- We accept the payment methods shown at checkout, including cash on delivery.
- We may correct pricing errors and will contact you before processing an affected order.

## Orders
- Placing an order is an offer to buy. It is accepted when we confirm it by email or message, or dispatch it.
- We may decline or cancel an order, for example for stock issues, suspected fraud or incorrect information, and will refund any amount paid.
- Please make sure your contact and delivery details are correct.

## Delivery
Delivery is typically **{delivery_days} working days** depending on your location. Dates are estimates, not guarantees. See our Shipping & Delivery page.

## Returns and refunds
You have **{refund_days} days** from delivery to request a return of eligible items. See our Refund & Return Policy.

## Age and use
Our products are intended for adults. Bakhoor and oud should be used with care, in ventilated spaces and away from children and pets. Test fragrances on a small area of skin first, and stop using a product if irritation occurs.

## Intellectual property
All content on this site, including text, images, logos, product names and designs, belongs to {store_name} and may not be copied or used without written permission.

## Limitation of liability
To the fullest extent permitted by law, {store_name} is not liable for indirect or consequential losses arising from use of the site or products. Nothing in these terms limits your statutory consumer rights.

## Governing law
These terms are governed by the laws of the United Arab Emirates, and the courts of the UAE have jurisdiction.

## Changes
We may update these terms from time to time. The version on this page at the time of your order applies.

## Contact
Questions? Write to {support_email} or call {support_phone}.`,
    content_ar: `## الاتفاق
باستخدامك هذا الموقع وتقديمك طلبًا لدى {store_name}، فإنك توافق على هذه الشروط. وإن لم توافق فيُرجى عدم استخدام الموقع.

## منتجاتنا
نصف عطورنا وزيوتنا وبخورنا ونصوّرها بأكبر قدر من الدقة. قد تختلف الألوان قليلًا بين الشاشات، والرائحة شخصية: فأداء العطر يتأثر ببشرتك. وصف النوتات للتوضيح وليس ضمانًا لكيفية ظهور الرائحة عليك.

## الأسعار والدفع
- جميع الأسعار بالدرهم الإماراتي (AED) ما لم يُذكر خلاف ذلك، وتشمل ضريبة القيمة المضافة عند انطباقها.
- رسوم التوصيل **{shipping_fee}**، و**مجانًا للطلبات بقيمة {free_over} أو أكثر**.
- نقبل وسائل الدفع الظاهرة عند إتمام الطلب، بما فيها الدفع عند الاستلام.
- يحق لنا تصحيح أخطاء الأسعار وسنتواصل معك قبل معالجة أي طلب متأثر.

## الطلبات
- تقديم الطلب هو عرض للشراء، ويُقبل عند تأكيدنا له عبر البريد أو الرسالة أو عند شحنه.
- يحق لنا رفض الطلب أو إلغاؤه، مثلًا بسبب نفاد المخزون أو الاشتباه بالاحتيال أو خطأ في المعلومات، وسنردّ أي مبلغ مدفوع.
- يُرجى التأكد من صحة بيانات التواصل والتوصيل.

## التوصيل
مدة التوصيل المعتادة **{delivery_days} أيام عمل** بحسب موقعك. المواعيد تقديرية وليست مضمونة. راجع صفحة الشحن والتوصيل.

## الإرجاع والاسترداد
لديك **{refund_days} أيام** من التسليم لطلب إرجاع المنتجات المؤهلة. راجع سياسة الاسترجاع والاسترداد.

## السن والاستخدام
منتجاتنا مخصصة للبالغين. يُستخدم البخور والعود بحذر في أماكن جيدة التهوية وبعيدًا عن الأطفال والحيوانات الأليفة. جرّب العطور على مساحة صغيرة من البشرة أولًا، وتوقف عن الاستخدام عند حدوث تهيّج.

## الملكية الفكرية
جميع محتويات الموقع، بما فيها النصوص والصور والشعارات وأسماء المنتجات والتصاميم، ملك لـ {store_name} ولا يجوز نسخها أو استخدامها دون إذن كتابي.

## حدود المسؤولية
إلى أقصى حد يسمح به القانون، لا يتحمل {store_name} الخسائر غير المباشرة أو التبعية الناتجة عن استخدام الموقع أو المنتجات. ولا يقيّد أي شيء في هذه الشروط حقوقك القانونية كمستهلك.

## القانون الواجب التطبيق
تخضع هذه الشروط لقوانين دولة الإمارات العربية المتحدة، وتختص محاكمها بالنظر في أي نزاع.

## التغييرات
قد نحدّث هذه الشروط من وقت لآخر، وتسري النسخة المنشورة في هذه الصفحة وقت طلبك.

## التواصل
لأي استفسار راسلنا على {support_email} أو اتصل بنا على {support_phone}.`,
  },
  {
    slug: 'cookies', sort: 50,
    title_en: 'Cookie Policy', title_ar: 'سياسة ملفات تعريف الارتباط',
    summary_en: 'The small files we use to keep your cart and preferences.',
    summary_ar: 'الملفات الصغيرة التي نستخدمها لحفظ سلتك وتفضيلاتك.',
    content_en: `## What are cookies
Cookies are small text files stored on your device when you visit a website. They help the site remember you and work properly.

## How we use them
- **Essential:** keep items in your cart, remember your language and keep you signed in. The site cannot work properly without these.
- **Performance:** help us understand which pages are visited and how the site performs, so we can improve it.
- **Preferences:** remember choices you have made, such as language and country.

We do not use cookies to sell your data.

## Managing cookies
You can block or delete cookies in your browser settings. If you block essential cookies, parts of the store such as the cart and checkout may not work.

## More information
See our Privacy Policy for how we handle personal data, or write to {support_email}.`,
    content_ar: `## ما هي ملفات تعريف الارتباط
هي ملفات نصية صغيرة تُخزَّن على جهازك عند زيارة موقع إلكتروني، وتساعد الموقع على تذكّرك والعمل بشكل صحيح.

## كيف نستخدمها
- **أساسية:** تحفظ المنتجات في سلتك وتتذكر لغتك وتبقيك مسجّل الدخول. لا يعمل الموقع بشكل سليم بدونها.
- **الأداء:** تساعدنا على فهم الصفحات التي تُزار وأداء الموقع لتحسينه.
- **التفضيلات:** تتذكر اختياراتك مثل اللغة والدولة.

لا نستخدم ملفات تعريف الارتباط لبيع بياناتك.

## إدارة ملفات تعريف الارتباط
يمكنك حظرها أو حذفها من إعدادات المتصفح. وإذا حظرت الملفات الأساسية فقد لا تعمل أجزاء من المتجر مثل السلة وإتمام الطلب.

## مزيد من المعلومات
راجع سياسة الخصوصية لمعرفة كيفية تعاملنا مع البيانات الشخصية، أو راسلنا على {support_email}.`,
  },
];

const SETTING_VALUES = [
  { group: 'shipping', key: 'shipping_fee', value: '15', type: 'number', description: 'Standard UAE Courier Delivery Fee' },
  { group: 'shipping', key: 'shipping_free_over', value: '200', type: 'number', description: 'Free Delivery Minimum Cart Value' },
  { group: 'shipping', key: 'shipping_estimate_text', value: 'Delivered across the UAE in 2 - 5 working days, depending on location', type: 'string', description: 'Customer Delivery SLA' },
  { group: 'shipping', key: 'delivery_days', value: '2 - 5', type: 'string', description: 'Delivery time in working days, used in the policy pages (e.g. 2 - 5)' },
  { group: 'shipping', key: 'refund_days', value: '7', type: 'number', description: 'Refund / return window in days, used in the policy pages' },
];

async function main() {
  const reset = process.argv.includes('--reset-values');
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS static_pages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(120) NOT NULL UNIQUE,
        title_en VARCHAR(200) NOT NULL,
        title_ar VARCHAR(200) NULL,
        summary_en VARCHAR(500) NULL,
        summary_ar VARCHAR(500) NULL,
        content_en MEDIUMTEXT NOT NULL,
        content_ar MEDIUMTEXT NULL,
        is_published TINYINT(1) NOT NULL DEFAULT 1,
        show_in_footer TINYINT(1) NOT NULL DEFAULT 1,
        is_system TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        updated_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    for (const p of PAGES) {
      await db.query(
        `INSERT IGNORE INTO static_pages
           (slug, title_en, title_ar, summary_en, summary_ar, content_en, content_ar, is_system, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [p.slug, p.title_en, p.title_ar, p.summary_en, p.summary_ar, p.content_en, p.content_ar, p.sort]
      );
    }

    for (const s of SETTING_VALUES) {
      await db.query(
        'INSERT IGNORE INTO system_settings (`group`, `key`, `value`, `type`, `is_public`, `description`) VALUES (?, ?, ?, ?, 1, ?)',
        [s.group, s.key, s.value, s.type, s.description]
      );
      if (reset) {
        await db.query('UPDATE system_settings SET `value` = ? WHERE `key` = ?', [s.value, s.key]);
      }
    }

    if (redisClient) {
      try { await redisClient.del('settings:public'); } catch { /* ignore */ }
    }
    console.log('SUCCESS: static_pages ready (' + PAGES.length + ' policy pages), shipping/delivery/refund settings ready');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
