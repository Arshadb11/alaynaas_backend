/**
 * One-off helper: fills EMPTY (or placeholder) product descriptions so the storefront never looks blank.
 * Replace the text later in Admin > Products. Safe to re-run: only touches products whose short description
 * is empty or shorter than 25 characters.
 */
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const COPY = {
  'oud-exclusive': {
    s: 'A rare, deeply resinous oud creation, made in a small private run.',
    sa: 'إبداع نادر من العود الراتنجي العميق، يُصنع بكميات خاصة محدودة.',
    d: `Oud Exclusive belongs to our private reserve: a dark, resinous oud composition made in small numbers and finished by hand.\n\nIt opens with a warm, smoky depth and settles into a rich, lasting trail on the skin. Apply a little to the pulse points and let it develop over the first hour.\n\nBest for evenings, special occasions and anyone who wants a fragrance that is rarely smelled on someone else.`,
    da: `يُعدّ «عود إكسكلوسيف» من مجموعتنا الخاصة: تركيبة عود داكنة وراتنجية تُصنع بكميات صغيرة وتُنجَز يدويًا.\n\nيبدأ بعمق دافئ ودخاني، ثم يستقر بأثر غني يدوم على البشرة. ضع القليل منه على نقاط النبض واتركه يتطور خلال الساعة الأولى.\n\nمناسب للأمسيات والمناسبات الخاصة ولمن يبحث عن عطر نادرًا ما يُشمّ على غيره.`,
  },
  'santal-naqiun': {
    s: 'A pure concentrated oil with a creamy, woody warmth that stays close to skin.',
    sa: 'زيت عطري مركّز نقي بدفء خشبي كريمي يبقى قريبًا من البشرة.',
    d: `Santal Naqiun is a concentrated, alcohol-free oil made to be worn directly on the skin.\n\nIts creamy, woody character is soft at first and grows warmer as it settles, staying close to the body rather than filling the room. A single touch on the wrists or behind the ears is enough.\n\nA limited edition for quiet, personal wear throughout the day.`,
    da: `«سانتال نقيّون» زيت عطري مركّز خالٍ من الكحول، صُنع ليُوضع مباشرة على البشرة.\n\nطابعه الخشبي الكريمي ناعم في البداية ويزداد دفئًا مع الوقت، ويبقى قريبًا من الجسم دون أن يملأ المكان. تكفي لمسة واحدة على المعصمين أو خلف الأذنين.\n\nإصدار محدود للارتداء الهادئ والشخصي طوال اليوم.`,
  },
  'after-dark': {
    s: 'An amber eau de parfum made for the evening: warm, smooth and unhurried.',
    sa: 'ماء عطر عنبري للأمسيات: دافئ وناعم ويأخذ وقته.',
    d: `After Dark is an eau de parfum designed for the hours after sunset. It is warm and smooth, with a golden, amber character that feels rich without being heavy.\n\nSpray on pulse points or clothing and it will stay with you from dinner to the end of the night. It is available in a 100ml bottle and a 10ml size to try or carry.\n\nIt suits evenings out, cooler weather and anyone who likes a fragrance with presence.`,
    da: `«أفتر دارك» ماء عطر صُمّم لساعات ما بعد الغروب. دافئ وناعم بطابع عنبري ذهبي يبدو غنيًا دون أن يكون ثقيلًا.\n\nرشّه على نقاط النبض أو الملابس ليبقى معك من العشاء حتى نهاية السهرة. متوفر بعبوة 100 مل وحجم 10 مل للتجربة أو للحمل.\n\nمناسب للأمسيات والطقس المعتدل ولمن يحب عطرًا له حضور.`,
  },
  'discovery-set': {
    s: 'A small set of our fragrances, to try on your own skin before choosing a full bottle.',
    sa: 'مجموعة صغيرة من عطورنا لتجربتها على بشرتك قبل اختيار العبوة الكاملة.',
    d: `The Discovery Set lets you live with our fragrances before you commit to a full bottle. Each one is a small, easy-to-carry size.\n\nWear one per day, on your skin, and notice how it changes through the hours. Fragrance behaves differently on every person, and this is the most honest way to find yours.\n\nA thoughtful first purchase, and a good gift for someone who loves to explore.`,
    da: `تتيح لك مجموعة الاكتشاف أن تعيش مع عطورنا قبل شراء العبوة الكاملة. كل عطر بحجم صغير يسهل حمله.\n\nجرّب عطرًا واحدًا كل يوم على بشرتك ولاحظ كيف يتغير عبر الساعات. العطر يتصرف بشكل مختلف على كل شخص، وهذه أصدق طريقة لتجد عطرك.\n\nبداية مدروسة للتسوق وهدية جميلة لمن يحب الاستكشاف.`,
  },
  'bakhoor-al-emarat': {
    s: 'Hand-finished bakhoor tablets that fill a room with warm, lasting incense.',
    sa: 'أقراص بخور مُنجزة يدويًا تملأ المكان ببخور دافئ يدوم.',
    d: `Bakhoor Al Emarat is a box of ten bakhoor tablets in the Emirati tradition of welcoming guests with incense.\n\nPlace a tablet on a lit charcoal disc in your mabkhara and let the smoke rise slowly. The scent is warm, woody and sweet, and it settles into rooms, fabrics and curtains for hours.\n\nIdeal for the home, for gatherings and for special evenings.`,
    da: `«بخور الإمارات» علبة من عشرة أقراص بخور على تقليد الإمارات في استقبال الضيوف بالبخور.\n\nضع قرصًا على فحم مشتعل في المبخرة واترك الدخان يرتفع ببطء. الرائحة دافئة وخشبية وحلوة، وتستقر في الغرف والأقمشة والستائر لساعات.\n\nمثالي للمنزل والتجمعات والأمسيات الخاصة.`,
  },
  'lost-summer': {
    s: 'A bright, nostalgic eau de parfum that feels like a summer you can still remember.',
    sa: 'ماء عطر مشرق وحنين يشبه صيفًا ما زلت تتذكره.',
    d: `Lost Summer is about the feeling of a summer you cannot return to: warm skin, open windows and evenings that seemed to last forever.\n\nIt opens light and sunny, then softens into a warmer, slightly nostalgic heart. It feels familiar from the first spray, even if you cannot say why.\n\nAvailable in 100ml and a 10ml travel size. Perfect for long afternoons and relaxed evenings.`,
    da: `«لوست سمر» عن شعور صيف لا يمكنك العودة إليه: بشرة دافئة ونوافذ مفتوحة وأمسيات بدت بلا نهاية.\n\nيبدأ خفيفًا ومشمسًا، ثم يلين إلى قلب أدفأ وحنين قليلًا. يبدو مألوفًا من أول رشة حتى لو لم تعرف السبب.\n\nمتوفر بحجم 100 مل وحجم سفر 10 مل. مثالي للعصريات الطويلة والأمسيات الهادئة.`,
  },
  'ember-noir': {
    s: 'A dark, glowing eau de parfum with a smoldering warmth that lingers.',
    sa: 'ماء عطر داكن متوهج بدفء مشتعل يدوم طويلًا.',
    d: `Ember Noir is an eau de parfum with the glow of a dying fire: dark, warm and quietly intense.\n\nIt starts deep and smoky, then stays on the skin as a soft, smoldering trail that people notice when you walk past. A little goes a long way.\n\nAvailable in 100ml and a 10ml size. Best for nights, colder days and moments when you want to be remembered.`,
    da: `«إمبر نوار» ماء عطر بتوهج نارٍ تخبو: داكن ودافئ وقوي بهدوء.\n\nيبدأ عميقًا ودخانيًا، ثم يبقى على البشرة أثرًا ناعمًا متوهجًا يلاحظه من يمرّ بجانبك. القليل منه يكفي.\n\nمتوفر بحجم 100 مل وحجم 10 مل. الأنسب للّيالي والأيام الباردة ولحظات تريد أن تُذكر فيها.`,
  },
  formula7: {
    s: 'Our signature eau de parfum: balanced, modern and made to be worn every day.',
    sa: 'ماء عطرنا المميز: متوازن وعصري ومصمم للارتداء كل يوم.',
    d: `Formula 7 is our signature eau de parfum, the result of many trials until the balance felt right.\n\nIt is modern and easy to wear, with enough character to be noticed and enough softness to suit any day. It develops gently on the skin and keeps its shape through the hours.\n\nAvailable in 100ml and a 10ml size, it is the best place to start with ALAYNAAS.`,
    da: `«فورميلا 7» ماء عطرنا المميز، ثمرة تجارب كثيرة حتى استقام التوازن.\n\nعصري وسهل الارتداء، بطابع يكفي ليُلاحَظ ونعومة تناسب أي يوم. يتطور بلطف على البشرة ويحافظ على شكله عبر الساعات.\n\nمتوفر بحجم 100 مل وحجم 10 مل، وهو أفضل بداية مع ألينّاس.`,
  },
};

(async () => {
  try {
    const rows = await db.query('SELECT id, slug, short_description FROM products');
    let n = 0;
    for (const r of rows) {
      const c = COPY[r.slug];
      if (!c) { console.log('no copy for', r.slug); continue; }
      if (r.short_description && r.short_description.trim().length >= 25) continue;
      await db.query(
        'UPDATE products SET short_description = ?, short_description_ar = ?, description = ?, description_ar = ? WHERE id = ?',
        [c.s, c.sa, c.d.replace(/\n\n/g, '</p><p>').replace(/^/, '<p>').concat('</p>'), c.da.replace(/\n\n/g, '</p><p>').replace(/^/, '<p>').concat('</p>'), r.id]
      );
      n++;
    }
    if (redisClient) { try { const keys = await redisClient.keys('*product*'); if (keys.length) await redisClient.del(keys); await redisClient.del('settings:public'); } catch { /* ignore */ } }
    console.log(`SUCCESS: ${n} product descriptions filled`);
    process.exit(0);
  } catch (e) { console.error(e); process.exit(1); }
})();
