/**
 * Seeds the Storefront "Hero Slider" settings with the slides that used to be hard-coded.
 * Safe to re-run: existing values are never overwritten.
 *
 *   hero_slides    json    list of slides (see _sanitizeHeroSlides in settings.service.js)
 *   hero_interval  number  seconds each slide stays on screen
 */
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const DEFAULT_SLIDES = [
  {
    img: '/images/opening.jpg', pos: '50% 50%', active: true, start_at: '', end_at: '',
    kick_en: 'Perfume · Bakhoor · Oud Ma\u2019attar · Oils', kick_ar: 'عطور · بخور · عود معطر · زيوت',
    l1_en: 'For those who carry', l1_ar: 'لمن يحملون',
    l2_en: 'the crown.', l2_ar: 'التاج.',
    sub_en: '', sub_ar: '',
    alt_en: 'ALAYNAAS luxury perfumes, bakhoor and oud', alt_ar: 'عطور وبخور وعود ألاينا الفاخرة',
    href: '#shop', cta_en: 'Shop the collection', cta_ar: 'تسوّق المجموعة',
    href2: '', cta2_en: '', cta2_ar: '',
  },
  {
    img: '/images/story.jpg', pos: '50% 50%', active: true, start_at: '', end_at: '',
    kick_en: 'Bakhoor \u00b7 Oud Ma\u2019attar', kick_ar: 'بخور · عود معطر',
    l1_en: 'The ritual', l1_ar: 'طقوس',
    l2_en: 'of scent.', l2_ar: 'العطر.',
    sub_en: '', sub_ar: '', alt_en: '', alt_ar: '',
    href: '/fragrances/bakhoor', cta_en: 'Explore the rituals', cta_ar: 'اكتشف الطقوس',
    href2: '', cta2_en: '', cta2_ar: '',
  },
  {
    img: '/images/discovery-set.jpg', pos: '50% 50%', active: true, start_at: '', end_at: '',
    kick_en: 'Discovery & Travel Sets', kick_ar: 'مجموعات الاستكشاف والسفر',
    l1_en: 'Start small.', l1_ar: 'ابدأ صغيراً.',
    l2_en: 'Choose well.', l2_ar: 'اختر بعناية.',
    sub_en: '', sub_ar: '', alt_en: '', alt_ar: '',
    href: '/fragrances/sets', cta_en: 'Shop the sets', cta_ar: 'تسوّق المجموعات',
    href2: '', cta2_en: '', cta2_ar: '',
  },
  {
    img: '/images/exclusive.jpg', pos: '50% 50%', active: true, start_at: '', end_at: '',
    kick_en: 'Exclusive Creations', kick_ar: 'إبداعات حصرية',
    l1_en: 'Rare', l1_ar: 'نادرة',
    l2_en: 'by design.', l2_ar: 'بتصميم.',
    sub_en: '', sub_ar: '', alt_en: '', alt_ar: '',
    href: '/exclusive-creations', cta_en: 'Enter the collection', cta_ar: 'ادخل المجموعة',
    href2: '', cta2_en: '', cta2_ar: '',
  },
];

const SETTINGS = [
  { key: 'hero_slides', value: JSON.stringify(DEFAULT_SLIDES), type: 'json', description: 'Homepage hero slider slides (en/ar)' },
  { key: 'hero_interval', value: '7', type: 'number', description: 'Seconds each hero slide stays on screen' },
];

async function main() {
  try {
    for (const s of SETTINGS) {
      // INSERT IGNORE keeps any value the admin has already saved.
      await db.query(
        `INSERT IGNORE INTO system_settings (\`group\`, \`key\`, \`value\`, \`type\`, \`is_public\`, \`description\`)
         VALUES ('storefront', ?, ?, ?, 1, ?)`,
        [s.key, s.value, s.type, s.description]
      );
    }
    if (redisClient) {
      try { await redisClient.del('settings:public'); } catch { /* ignore */ }
    }
    console.log('SUCCESS: hero slider settings ready');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
