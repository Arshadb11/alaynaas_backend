/**
 * Seeds the Storefront "House Disciplines" homepage section setting.
 * Safe to re-run: an existing saved value is never overwritten.
 *
 *   house_disciplines  json  { kicker_*, heading_*, sub_*, items: [{ category_slug, active, img, href, tagline_*, title_*, desc_*, cta_* }] }
 */
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const DEFAULT = {
  kicker_en: 'Disciplines of Scent', kicker_ar: 'أشكال العطر وفنونه',
  heading_en: 'The House Disciplines', heading_ar: 'تعبيرات الدار العطرية',
  sub_en: 'Fragrance exists across different mediums. From intimate skin contact to atmospheric spaces, each carries its own ritual.',
  sub_ar: 'العطر لا ينحصر في زجاجة واحدة. من ملامسة الجسد إلى إشعال المكان، كل وسيط يحمل طقسه وحضوره الخاص.',
  items: [
    {
      category_slug: 'perfumes', active: true, img: '/images/story.jpg', href: '',
      tagline_en: 'Signature Scent · 100ml & 10ml', tagline_ar: 'العطور الأيقونية · 100 مل و10 مل',
      title_en: 'Eaux de Parfum', title_ar: 'العطور الفاخرة',
      desc_en: 'Composed for presence and enduring memory. Four distinctive worlds worn directly on skin and silk.',
      desc_ar: 'تراكيب صُممت لتدوم وتترك أثراً لا يُنسى. أربعة عوالم عطرية تلامس البشرة والحرير.',
      cta_en: 'Explore Perfumes', cta_ar: 'استكشف العطور',
    },
    {
      category_slug: 'concentrated-oils', active: true, img: '/images/materials.jpg', href: '',
      tagline_en: 'Alcohol-Free · Direct on Skin', tagline_ar: 'دهن نقي خالي من الكحول',
      title_en: 'Pure Concentrated Oils', title_ar: 'الزيوت العطرية المركزة',
      desc_en: 'Intimate, concentrated attars that stay close to the pulse points, unfolding slowly over hours.',
      desc_ar: 'زيوت عطرية حميمية مركزة تدوم طويلاً على أماكن النبض وتفوح بهدوء على مدار اليوم.',
      cta_en: 'Explore Pure Oils', cta_ar: 'استكشف الزيوت',
    },
    {
      category_slug: 'bakhoor', active: true, img: '/images/cat-bakhoor.jpg', href: '',
      tagline_en: 'Atmospheric Ritual · Scented Wood', tagline_ar: 'طقس عطري للمكان · أخشاب معطرة',
      title_en: 'Handcrafted Bakhoor', title_ar: 'البخور الحرفي',
      desc_en: 'Artisanal incense formulated to transform a space. Smoke, warming woods, and resinous comfort.',
      desc_ar: 'بخور حرفي فاخر صُمم ليملأ المكان بالسكينة والدفء بنفحات الراتنجات والأخشاب الثمينة.',
      cta_en: 'Explore Bakhoor', cta_ar: 'استكشف البخور',
    },
    {
      category_slug: 'oud-maattar', active: true, img: '/images/oud-maattar.jpg', href: '',
      tagline_en: 'Aged Agarwood · Precious Essences', tagline_ar: 'رقائق عود معتقة · زيوت نادرة',
      title_en: 'Oud Ma\u2019attar', title_ar: 'معطرات العود',
      desc_en: 'Hand-selected agarwood chips steeped in rare oils. An ancient heritage seen with contemporary restraint.',
      desc_ar: 'رقائق عود طبيعية مغمورة في أندر الزيوت العطرية، لطقوس الضيافة والتطيب الرفيع.',
      cta_en: 'Explore Oud Ma\u2019attar', cta_ar: 'استكشف معطرات العود',
    },
  ],
};

async function main() {
  try {
    await db.query(
      `INSERT IGNORE INTO system_settings (\`group\`, \`key\`, \`value\`, \`type\`, \`is_public\`, \`description\`)
       VALUES ('storefront', 'house_disciplines', ?, 'json', 1, 'Homepage "House Disciplines" section: texts + category cards (en/ar)')`,
      [JSON.stringify(DEFAULT)]
    );
    if (redisClient) {
      try { await redisClient.del('settings:public'); } catch { /* ignore */ }
    }
    console.log('SUCCESS: house disciplines setting ready');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();