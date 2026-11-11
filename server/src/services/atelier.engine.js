/**
 * ATELIER ENGINE: composes a personal perfume formula from the storefront questionnaire.
 *
 * Rules-based (no AI cost): every answer adds weight to scent "tags"; each note in the palette
 * scores by its tags; the best notes per tier (top / heart / base) are picked with a seeded
 * random touch so two people with the same answers still get slightly different formulas.
 * Everything returned is bilingual (en / ar) so the storefront only renders.
 */

/* ── Note palette: tier, scent tags (0-3), names ── */
const N = (key, tier, en, ar, tags) => ({ key, tier, en, ar, tags });
const PALETTE = [
  // TOP
  N('bergamot', 'top', 'Calabrian bergamot', 'البرغموت الكالابري', { citrus: 3, fresh: 2 }),
  N('lemon', 'top', 'Sicilian lemon', 'الليمون الصقلي', { citrus: 3, fresh: 2 }),
  N('mandarin', 'top', 'Sweet mandarin', 'اليوسفي الحلو', { citrus: 3, fruity: 1, sweet: 1 }),
  N('grapefruit', 'top', 'Pink grapefruit', 'الجريب فروت الوردي', { citrus: 3, fresh: 2, fruity: 1 }),
  N('blood_orange', 'top', 'Blood orange', 'البرتقال الدموي', { citrus: 2, fruity: 2 }),
  N('lime', 'top', 'Persian lime', 'الليمون الأخضر', { citrus: 3, fresh: 2, green: 1 }),
  N('neroli_top', 'top', 'Neroli', 'النيرولي', { citrus: 2, white: 2, floral: 1 }),
  N('pink_pepper', 'top', 'Pink pepper', 'الفلفل الوردي', { spicy: 2, fresh: 1, fruity: 1 }),
  N('cardamom', 'top', 'Green cardamom', 'الهيل', { spicy: 3, fresh: 1, herbal: 1 }),
  N('saffron', 'top', 'Saffron', 'الزعفران', { spicy: 2, leather: 1, amber: 1, royal: 3 }),
  N('ginger', 'top', 'Fresh ginger', 'الزنجبيل الطازج', { spicy: 2, fresh: 2, citrus: 1 }),
  N('mint', 'top', 'Wild mint', 'النعناع البري', { herbal: 3, fresh: 3, green: 1 }),
  N('lavender', 'top', 'French lavender', 'الخزامى الفرنسية', { herbal: 3, floral: 1, fresh: 1, powdery: 1 }),
  N('sea_salt', 'top', 'Sea salt', 'ملح البحر', { aquatic: 3, fresh: 2, mineral: 2 }),
  N('marine', 'top', 'Marine accord', 'النفحة البحرية', { aquatic: 3, fresh: 3 }),
  N('green_apple', 'top', 'Green apple', 'التفاح الأخضر', { fruity: 3, fresh: 2, green: 1 }),
  N('pear', 'top', 'Juicy pear', 'الكمثرى', { fruity: 3, sweet: 1, fresh: 1 }),
  N('blackcurrant', 'top', 'Blackcurrant', 'الكشمش الأسود', { fruity: 3, green: 1 }),
  N('raspberry', 'top', 'Raspberry', 'التوت الأحمر', { fruity: 3, sweet: 2 }),
  N('galbanum', 'top', 'Galbanum', 'القنة', { green: 3, herbal: 1 }),
  // HEART
  N('taif_rose', 'heart', 'Taif rose', 'الورد الطائفي', { rose: 3, floral: 3, royal: 2 }),
  N('damask_rose', 'heart', 'Damask rose', 'الورد الدمشقي', { rose: 3, floral: 3, fruity: 1 }),
  N('turkish_rose', 'heart', 'Turkish rose', 'الورد التركي', { rose: 3, floral: 2, sweet: 1 }),
  N('jasmine', 'heart', 'Jasmine sambac', 'الياسمين', { white: 3, floral: 3, seductive: 2 }),
  N('tuberose', 'heart', 'Tuberose', 'مسك الروم', { white: 3, floral: 3, sweet: 1, seductive: 2 }),
  N('orange_blossom', 'heart', 'Orange blossom', 'زهر البرتقال', { white: 3, floral: 2, citrus: 1 }),
  N('iris', 'heart', 'Iris', 'السوسن', { powdery: 3, floral: 2, royal: 1 }),
  N('violet', 'heart', 'Violet', 'البنفسج', { powdery: 2, floral: 2, green: 1 }),
  N('peony', 'heart', 'Peony', 'الفاوانيا', { floral: 3, fresh: 1, fruity: 1 }),
  N('lily', 'heart', 'Lily of the valley', 'زنبق الوادي', { floral: 3, fresh: 2, green: 1 }),
  N('geranium', 'heart', 'Geranium', 'العطرة', { floral: 2, herbal: 2, rose: 1 }),
  N('cinnamon', 'heart', 'Ceylon cinnamon', 'القرفة السيلانية', { spicy: 3, sweet: 1, amber: 1 }),
  N('clove', 'heart', 'Clove', 'القرنفل', { spicy: 3, smoky: 1 }),
  N('nutmeg', 'heart', 'Nutmeg', 'جوزة الطيب', { spicy: 2, woody: 1 }),
  N('saffron_heart', 'heart', 'Saffron threads', 'خيوط الزعفران', { spicy: 2, royal: 3, leather: 1 }),
  N('tea', 'heart', 'Black tea', 'الشاي الأسود', { herbal: 2, smoky: 1, fresh: 1 }),
  N('fig', 'heart', 'Fig leaf', 'ورق التين', { green: 3, fruity: 1, woody: 1 }),
  N('sea_lotus', 'heart', 'Water lotus', 'زهرة اللوتس', { aquatic: 2, floral: 2, fresh: 1 }),
  N('honey', 'heart', 'Wild honey', 'العسل البري', { sweet: 3, amber: 1, floral: 1 }),
  N('davana', 'heart', 'Davana', 'الدافانا', { fruity: 2, herbal: 1, sweet: 1 }),
  // BASE
  N('cambodi_oud', 'base', 'Cambodian oud', 'العود الكمبودي', { oud: 3, woody: 2, sweet: 1, royal: 3 }),
  N('hindi_oud', 'base', 'Hindi oud', 'العود الهندي', { oud: 3, woody: 2, smoky: 1, leather: 1, royal: 2 }),
  N('sandalwood', 'base', 'Mysore sandalwood', 'خشب الصندل', { woody: 3, musk: 1, sweet: 1 }),
  N('cedar', 'base', 'Atlas cedar', 'خشب الأرز', { woody: 3, fresh: 1 }),
  N('vetiver', 'base', 'Haitian vetiver', 'نجيل الهند', { woody: 2, green: 2, smoky: 1 }),
  N('patchouli', 'base', 'Patchouli', 'الباتشولي', { woody: 2, green: 1, smoky: 1, seductive: 1 }),
  N('guaiac', 'base', 'Guaiac wood', 'خشب الغاياك', { woody: 2, smoky: 2 }),
  N('amber', 'base', 'Golden amber', 'العنبر الذهبي', { amber: 3, sweet: 1, seductive: 1 }),
  N('labdanum', 'base', 'Labdanum', 'اللبدانوم', { amber: 3, leather: 1, smoky: 1 }),
  N('benzoin', 'base', 'Siam benzoin', 'الجاوي', { amber: 2, vanilla: 2, sweet: 1 }),
  N('vanilla', 'base', 'Bourbon vanilla', 'الفانيليا البوربونية', { vanilla: 3, sweet: 3, seductive: 1 }),
  N('tonka', 'base', 'Tonka bean', 'حبوب التونكا', { vanilla: 2, sweet: 2, powdery: 1 }),
  N('frankincense', 'base', 'Omani frankincense', 'اللبان العماني', { incense: 3, smoky: 2, fresh: 1, royal: 1 }),
  N('myrrh', 'base', 'Myrrh', 'المر', { incense: 3, smoky: 1, amber: 1 }),
  N('bakhoor', 'base', 'Bakhoor smoke', 'دخان البخور', { incense: 3, smoky: 3, oud: 1, sweet: 1 }),
  N('leather', 'base', 'Suede leather', 'الجلد الناعم', { leather: 3, smoky: 1, seductive: 1 }),
  N('white_musk', 'base', 'White musk', 'المسك الأبيض', { musk: 3, fresh: 1, powdery: 1 }),
  N('skin_musk', 'base', 'Skin musk', 'مسك البشرة', { musk: 3, seductive: 1, sweet: 1 }),
  N('ambergris', 'base', 'Ambergris', 'العنبر الرمادي', { musk: 2, aquatic: 2, amber: 1, royal: 1 }),
  N('oakmoss', 'base', 'Oakmoss', 'طحلب البلوط', { green: 2, woody: 2, mineral: 1 }),
  N('cashmere', 'base', 'Cashmere wood', 'خشب الكشمير', { woody: 2, musk: 2, sweet: 1 }),
  N('shamama', 'base', 'Shamama', 'الشمامة', { amber: 2, spicy: 2, incense: 1, royal: 2 }),
];

/* ── Questionnaire answers → tag weights ── */
const W = {
  who: {
    self: {},
    him: { woody: 1, leather: 1, spicy: 0.5, fresh: 0.5 },
    her: { floral: 1, rose: 1, fruity: 0.5, vanilla: 0.5 },
    gift: { amber: 0.5, rose: 0.5, woody: 0.5 },
  },
  mood: {
    majestic: { royal: 3, oud: 2, rose: 1.5, amber: 1.5, incense: 1 },
    mysterious: { smoky: 2, incense: 2, oud: 1.5, leather: 1.5, woody: 1 },
    radiant: { citrus: 2.5, floral: 2, fruity: 1, fresh: 1.5, white: 1 },
    serene: { musk: 3, powdery: 1.5, green: 1, herbal: 1.5, woody: 1 },
    seductive: { seductive: 3, vanilla: 2, amber: 2, white: 1.5, musk: 1, spicy: 1 },
    free: { aquatic: 2.5, fresh: 2.5, citrus: 1, green: 2, herbal: 1 },
  },
  place: {
    desert: { amber: 2, oud: 2, spicy: 1, smoky: 1, woody: 1 },
    taif: { rose: 3, floral: 1, green: 1, fruity: 1, musk: 1 },
    sea: { aquatic: 3, fresh: 2, citrus: 1, musk: 1, mineral: 1 },
    souk: { spicy: 3, incense: 2, oud: 1, sweet: 1, royal: 1 },
    lounge: { leather: 2, vanilla: 2, amber: 1.5, smoky: 1, woody: 1, seductive: 1 },
    orchard: { citrus: 3, white: 1.5, green: 1, fruity: 1.5 },
    forest: { green: 2.5, woody: 2.5, herbal: 1, musk: 1, fresh: 1 },
  },
  occasion: {
    daily: { fresh: 1, musk: 1, citrus: 1, oud: -1, smoky: -0.5 },
    evening: { amber: 1, vanilla: 1, smoky: 1, seductive: 1 },
    special: { oud: 1, rose: 1, amber: 1, royal: 1 },
    majlis: { oud: 2, incense: 2, rose: 1, royal: 1 },
    summer: { citrus: 2, aquatic: 1.5, fresh: 1.5, sweet: -1, amber: -1, vanilla: -1 },
  },
  loves: {
    oud: { oud: 3 }, rose: { rose: 3 }, amber: { amber: 3, vanilla: 1 }, citrus: { citrus: 3 }, musk: { musk: 3 },
    spices: { spicy: 3 }, woods: { woody: 3 }, white: { white: 3 }, fruity: { fruity: 3 },
    incense: { incense: 3, smoky: 1 }, fresh: { fresh: 2, aquatic: 2 }, leather: { leather: 3 }, sweet: { sweet: 2, vanilla: 2 },
  },
  avoid: {
    sweet: { sweet: -6, vanilla: -4 }, smoky: { smoky: -6, incense: -4 }, floral: { floral: -4, rose: -3, white: -4 },
    strong: { oud: -2, leather: -2, smoky: -2 }, powdery: { powdery: -6 }, fruity: { fruity: -6 },
  },
};

/* ── Display accords (bars on the result) ── */
const ACCORDS = [
  ['woody', 'Woody', 'خشبي', ['woody', 'oud']],
  ['floral', 'Floral', 'زهري', ['floral', 'rose', 'white']],
  ['amber', 'Amber', 'عنبري', ['amber', 'vanilla']],
  ['fresh', 'Fresh', 'منعش', ['fresh', 'citrus', 'aquatic', 'green']],
  ['spicy', 'Spicy', 'حار', ['spicy']],
  ['musky', 'Musky', 'مسكي', ['musk', 'powdery']],
  ['smoky', 'Smoky', 'مدخّن', ['smoky', 'incense', 'leather']],
  ['sweet', 'Sweet', 'حلو', ['sweet', 'fruity']],
];

/* ── Name + story pieces (Arabic name is an idafa: [mood noun] + [definite place noun]) ── */
const MOOD_NOUNS = {
  majestic: [['Crown', 'تاج'], ['Throne', 'عرش'], ['Majesty', 'جلالة']],
  mysterious: [['Secret', 'سرّ'], ['Shadow', 'ظلّ'], ['Enigma', 'لغز']],
  radiant: [['Light', 'نور'], ['Glow', 'وهج'], ['Dawn', 'فجر']],
  serene: [['Calm', 'سكون'], ['Whisper', 'همس'], ['Peace', 'سلام']],
  seductive: [['Desire', 'شغف'], ['Velvet', 'مخمل'], ['Flame', 'لهيب']],
  free: [['Spirit', 'روح'], ['Horizon', 'أفق'], ['Wings', 'أجنحة']],
};
const PLACE_NOUNS = {
  desert: [['the Dunes', 'الكثبان'], ['the Desert', 'الصحراء'], ['the Sands', 'الرمال']],
  taif: [['Taif', 'الطائف'], ['the Roses', 'الورد'], ['the Garden', 'البستان']],
  sea: [['the Sea', 'البحر'], ['the Waves', 'الموج'], ['the Shore', 'الشاطئ']],
  souk: [['the Souk', 'السوق'], ['Saffron', 'الزعفران'], ['the Caravan', 'القافلة']],
  lounge: [['Midnight', 'منتصف الليل'], ['the Night', 'الليل'], ['the Embers', 'الجمر']],
  orchard: [['the Blossom', 'الزهر'], ['the Sun', 'الشمس'], ['the Orchard', 'البساتين']],
  forest: [['the Forest', 'الغابة'], ['the Rain', 'المطر'], ['the Cedars', 'الأرز']],
};
const PLACE_LINE = {
  desert: ['like the first cool wind over the dunes at dusk', 'كنسمة باردة أولى فوق الكثبان عند الغروب'],
  taif: ['like a rose garden in Taif at first light', 'كبستان ورد في الطائف مع أول ضوء'],
  sea: ['like salt air on a quiet shore', 'كهواء البحر المالح على شاطئ هادئ'],
  souk: ['like a walk through an old spice souk', 'كجولة في سوق بهارات قديم'],
  lounge: ['like a velvet room late at night', 'كغرفة مخملية في آخر الليل'],
  orchard: ['like sunlight through an orchard in bloom', 'كضوء الشمس بين بساتين مزهرة'],
  forest: ['like a forest just after the rain', 'كغابة بعد المطر مباشرة'],
};
const MOOD_LINE = {
  majestic: ['give it a quiet, regal confidence', 'تمنحه ثقة ملكية هادئة'],
  mysterious: ['give it a depth that keeps people guessing', 'تمنحه عمقًا يترك الآخرين في حيرة'],
  radiant: ['give it a bright, joyful glow', 'تمنحه إشراقة مبهجة'],
  serene: ['give it a calm, soft presence', 'تمنحه حضورًا هادئًا وناعمًا'],
  seductive: ['give it a warm, magnetic pull', 'تمنحه جاذبية دافئة لا تقاوم'],
  free: ['give it an easy, open-air freedom', 'تمنحه حرية الهواء الطلق'],
};
const OCCASION_LINE = {
  daily: ['made to be worn every day without effort', 'ليُرتدى كل يوم بلا تكلّف'],
  evening: ['made for evenings that end late', 'لأمسيات تمتد حتى وقت متأخر'],
  special: ['made for the moments you will remember', 'للحظات التي لا تُنسى'],
  majlis: ['made to be noticed in every majlis', 'ليلفت الأنظار في كل مجلس'],
  summer: ['made to stay light in the summer heat', 'ليبقى خفيفًا في حرّ الصيف'],
};
const WHO_TEXT = {
  self: ['you', 'لك'], him: ['him', 'له'], her: ['her', 'لها'], gift: ['someone special', 'لشخص مميز'],
};
const SILLAGE = [null, ['Intimate', 'قريب من البشرة'], ['Soft', 'هادئ'], ['Moderate', 'متوسط'], ['Strong', 'قوي'], ['Commanding', 'طاغٍ']];
const CONCENTRATION = [null,
  ['Eau de Parfum', 'أو دو بارفان', 15], ['Eau de Parfum', 'أو دو بارفان', 18],
  ['Extrait de Parfum', 'إكستريه دو بارفان', 22], ['Extrait de Parfum', 'إكستريه دو بارفان', 25],
  ['Extrait de Parfum', 'إكستريه دو بارفان', 30]];

/* ── Helpers ── */
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
const primaryTag = (n) => Object.entries(n.tags).sort((a, b) => b[1] - a[1])[0][0];
function listEn(a) { return a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`; }
function listAr(a) { return a.join(' و'); }
// Lower-case a note name inside a sentence, but keep place names ("Persian lime", "Taif rose")
const PROPER = /^(Calabrian|Sicilian|Persian|French|Taif|Damask|Turkish|Ceylon|Mysore|Atlas|Haitian|Siam|Bourbon|Omani|Hindi|Cambodian) /;
const inSentence = (en) => (PROPER.test(en) ? en : en.charAt(0).toLowerCase() + en.slice(1));
/** Round a list of weights to integer percentages that sum to `total`. */
function toPercents(weights, total) {
  const sum = weights.reduce((s, w) => s + w, 0) || 1;
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((s, x) => s + x, 0);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { out[i] += 1; rest -= 1; } });
  return out;
}

const OPTIONS = {
  who: Object.keys(W.who), mood: Object.keys(W.mood), place: Object.keys(W.place),
  occasion: Object.keys(W.occasion), loves: Object.keys(W.loves), avoid: Object.keys(W.avoid),
};

/** Answers → scent tag weights (shared by the formula and the product matching). */
function profileOf(a) {
  const tw = {};
  const add = (map, factor = 1) => Object.entries(map || {}).forEach(([t, w]) => { tw[t] = (tw[t] || 0) + w * factor; });
  const moods = (a.mood || []).filter((m) => W.mood[m]).slice(0, 2);
  add(W.who[a.who]);
  moods.forEach((m, i) => add(W.mood[m], i === 0 ? 1 : 0.6));
  add(W.place[a.place]);
  add(W.occasion[a.occasion]);
  (a.loves || []).slice(0, 3).forEach((l) => add(W.loves[l]));
  (a.avoid || []).slice(0, 3).forEach((v) => add(W.avoid[v]));
  return tw;
}

/**
 * @param {object} a  answers: { who, mood: [1-2], place, occasion, loves: [0-3], avoid: [0-3], intensity: 1-5 }
 * @param {number} seed  random seed (stored with the creation so it can be re-built)
 */
function compose(a, seed) {
  const r = rng(seed);
  const moods = (a.mood || []).filter((m) => W.mood[m]).slice(0, 2);
  const mood = moods[0] || 'majestic';
  let intensity = Math.min(5, Math.max(1, parseInt(a.intensity, 10) || 3));
  if ((a.avoid || []).includes('strong')) intensity = Math.min(intensity, 3);

  // 1. Tag weights from the answers
  const tw = profileOf(a);

  // 2. Score every note (+ a seeded touch of variety)
  const scored = PALETTE.map((n) => {
    let s = 0;
    Object.entries(n.tags).forEach(([t, v]) => { s += (tw[t] || 0) * v; });
    return { ...n, score: s + r() * 2.5 };
  });

  // 3. Best 3 per tier, avoiding three notes of the same character
  const tiers = {};
  const family = (n) => n.key.replace(/_.*/, ''); // saffron / saffron_heart count as one
  const takenFamilies = new Set();
  ['top', 'heart', 'base'].forEach((tier) => {
    let pool = scored.filter((n) => n.tier === tier && !takenFamilies.has(family(n)));
    const chosen = [];
    const used = {};
    while (chosen.length < 3 && pool.length) {
      // each note of an already-used character counts a little less
      const best = pool.reduce((b, n) => {
        const eff = n.score * 0.8 ** (used[primaryTag(n)] || 0);
        return !b || eff > b.eff ? { n, eff } : b;
      }, null);
      chosen.push(best.n);
      used[primaryTag(best.n)] = (used[primaryTag(best.n)] || 0) + 1;
      takenFamilies.add(family(best.n));
      pool = pool.filter((n) => n !== best.n && family(n) !== family(best.n));
    }
    tiers[tier] = chosen;
  });

  // 4. Structure: stronger formulas lean on the base
  const split = { top: 30 - (intensity - 1) * 3, heart: 38 - (intensity - 1), base: 0 };
  split.base = 100 - split.top - split.heart;
  const pyramid = {};
  Object.entries(tiers).forEach(([tier, notes]) => {
    const pct = toPercents(notes.map((n) => Math.max(1, n.score)), split[tier]);
    pyramid[tier] = notes.map((n, i) => ({ key: n.key, en: n.en, ar: n.ar, pct: pct[i] }));
  });

  // 5. Accord profile (top 5 bars)
  const all = [...tiers.top.map((n, i) => [n, pyramid.top[i].pct]), ...tiers.heart.map((n, i) => [n, pyramid.heart[i].pct]), ...tiers.base.map((n, i) => [n, pyramid.base[i].pct])];
  const accRaw = ACCORDS.map(([key, en, ar, tags]) => {
    const v = all.reduce((s, [n, pct]) => s + pct * tags.reduce((x, t) => x + (n.tags[t] || 0), 0), 0);
    return { key, en, ar, v };
  }).sort((x, y) => y.v - x.v).slice(0, 5);
  const maxV = accRaw[0]?.v || 1;
  const accords = accRaw.filter((x) => x.v > 0).map((x) => ({ key: x.key, en: x.en, ar: x.ar, value: Math.max(12, Math.round((x.v / maxV) * 100)) }));

  // 6. Name, story, specs
  const place = W.place[a.place] ? a.place : 'desert';
  const [mEn, mAr] = pick(MOOD_NOUNS[mood], r);
  const [pEn, pAr] = pick(PLACE_NOUNS[place], r);
  const name = { en: `${mEn} of ${pEn}`, ar: `${mAr} ${pAr}` };
  const who = WHO_TEXT[a.who] || WHO_TEXT.self;
  const occ = OCCASION_LINE[a.occasion] || OCCASION_LINE.special;
  const story = {
    en: `${name.en} was composed for ${who[0]}. It opens with ${listEn(pyramid.top.map((n) => inSentence(n.en)))}, ${PLACE_LINE[place][0]}. At its heart, ${listEn(pyramid.heart.map((n) => inSentence(n.en)))} ${MOOD_LINE[mood][0]}. It settles into ${listEn(pyramid.base.map((n) => inSentence(n.en)))}, ${occ[0]}.`,
    ar: `رُكّب «${name.ar}» ${who[1]}. يفتتح بنفحات من ${listAr(pyramid.top.map((n) => n.ar))}، ${PLACE_LINE[place][1]}. وفي قلبه ${listAr(pyramid.heart.map((n) => n.ar))} ${MOOD_LINE[mood][1]}. ثم يستقر على ${listAr(pyramid.base.map((n) => n.ar))}، ${occ[1]}.`,
  };
  const conc = CONCENTRATION[intensity];
  const hoursLo = 4 + intensity + Math.round(split.base / 25);
  const longevity = { en: `${hoursLo}–${hoursLo + 3} hours`, ar: `${hoursLo}–${hoursLo + 3} ساعات` };
  const tone = accords[0]?.key || 'amber';

  return {
    version: 1,
    name,
    story,
    pyramid,
    accords,
    intensity,
    concentration: { en: conc[0], ar: conc[1], pct: conc[2] },
    longevity,
    sillage: { en: SILLAGE[intensity][0], ar: SILLAGE[intensity][1] },
    tone, // drives the bottle tint on the storefront
  };
}

/* ═══════════════ The Crown Ritual: matching the answers to real products ═══════════════ */

/* Product note names and family slugs → the same scent tags the answers use */
const NOTE_TAGS = [
  [/oud|agar/, { oud: 3, woody: 1, royal: 1 }],
  [/rose/, { rose: 3, floral: 2 }],
  [/jasmin|tuberose|ylang|orange blossom|neroli|gardenia|frangipani|hyacinth/, { white: 2, floral: 3 }],
  [/iris|orris|violet|heliotrope|powder/, { powdery: 3, floral: 1 }],
  [/peony|lily|floral|flower|immortelle|magnolia|lotus/, { floral: 3 }],
  [/saffron/, { spicy: 2, royal: 3 }],
  [/amber|labdanum|ambrox|resin/, { amber: 3 }],
  [/vanill|tonka|benzoin|caramel|praline|honey/, { vanilla: 2, sweet: 3 }],
  [/musk/, { musk: 3 }],
  [/sandal|cedar|vetiver|patchouli|guaiac|cashmere|wood/, { woody: 3 }],
  [/leather|suede/, { leather: 3 }],
  [/incense|frankincense|olibanum|myrrh|bakhoor/, { incense: 3, smoky: 1 }],
  [/smok|tobacco|birch/, { smoky: 2 }],
  [/bergamot|lemon|orange(?! blossom)|mandarin|grapefruit|lime|citrus|yuzu/, { citrus: 3, fresh: 1 }],
  [/pepper|cardamom|cinnamon|clove|nutmeg|ginger|spic/, { spicy: 3 }],
  [/mint|lavender|basil|sage|rosemary|tea|herb/, { herbal: 3, fresh: 1 }],
  [/sea|marine|aqua|salt|ozon/, { aquatic: 3, fresh: 2 }],
  [/apple|pear|berry|plum|peach|fig|fruit|pineapple|cherry|currant|apricot/, { fruity: 3 }],
  [/moss|green|galbanum|leaf|grass/, { green: 3 }],
  [/aldehyde/, { fresh: 1, powdery: 1 }],
];
const FAMILY_TAGS = [
  [/oriental/, { amber: 2, spicy: 1, oud: 1, royal: 1 }],
  [/amber/, { amber: 3 }], [/vanilla|gourmand/, { vanilla: 3, sweet: 2 }], [/citrus/, { citrus: 3, fresh: 1 }],
  [/fresh/, { fresh: 3 }], [/floral/, { floral: 3 }], [/rose/, { rose: 3 }], [/chypre/, { green: 1, woody: 2, fruity: 1 }],
  [/leather/, { leather: 3 }], [/smok|birch/, { smoky: 3 }], [/fougere|aromatic/, { herbal: 2, fresh: 1, woody: 1 }],
  [/spic/, { spicy: 3 }], [/wood/, { woody: 3 }], [/oud/, { oud: 3 }], [/aqua|marine/, { aquatic: 3 }],
  [/musk/, { musk: 3 }], [/powder/, { powdery: 3 }], [/fruit/, { fruity: 3 }], [/green/, { green: 3 }],
];
const TAG_LABEL = {
  oud: ['oud', 'العود'], rose: ['rose', 'الورد'], amber: ['amber', 'العنبر'], vanilla: ['vanilla', 'الفانيليا'],
  musk: ['musk', 'المسك'], woody: ['precious woods', 'الأخشاب الثمينة'], spicy: ['warm spices', 'التوابل الدافئة'],
  citrus: ['bright citrus', 'الحمضيات المشرقة'], fresh: ['freshness', 'الانتعاش'], floral: ['flowers', 'الزهور'],
  white: ['white flowers', 'الزهور البيضاء'], incense: ['incense', 'البخور'], smoky: ['a touch of smoke', 'لمسة الدخان'],
  leather: ['soft leather', 'الجلد الناعم'], sweet: ['sweetness', 'الحلاوة'], fruity: ['ripe fruit', 'الفواكه الناضجة'],
  powdery: ['powdery softness', 'النعومة البودرية'], green: ['green notes', 'النفحات الخضراء'], herbal: ['herbs', 'الأعشاب'],
  aquatic: ['sea air', 'نسيم البحر'], royal: ['saffron and regal notes', 'الزعفران والنفحات الملكية'],
  mineral: ['mineral notes', 'النفحات المعدنية'], seductive: ['warmth', 'الدفء'],
};

/* Category slug → ritual role */
const ROLE = (slug = '') => {
  const s = String(slug).toLowerCase();
  if (/discovery|sample/.test(s)) return 'discovery';
  if (/bakhoor|incense|oud-chips|dukhoon/.test(s)) return 'finish';
  if (/oil|attar|ma-?attar|mukhallat/.test(s)) return 'base';
  if (/exclusive|niche|private/.test(s)) return 'exclusive';
  if (/perfume|parfum|eau|fragrance/.test(s)) return 'signature';
  return null;
};

function productTags(p) {
  const v = {};
  const add = (map, f) => Object.entries(map).forEach(([t, w]) => { v[t] = (v[t] || 0) + w * f; });
  for (const n of p.notes || []) {
    const name = String(n.name || '').toLowerCase();
    const f = n.level === 'top' ? 0.8 : 1;
    NOTE_TAGS.forEach(([rx, map]) => { if (rx.test(name)) add(map, f); });
  }
  (p.families || []).forEach((slug, i) => FAMILY_TAGS.forEach(([rx, map]) => { if (rx.test(slug)) add(map, i === 0 ? 2.5 : 1.5); }));
  return v;
}

/** How well a product fits the answers, and the two tags that explain why. */
function fit(tw, p) {
  const pt = productTags(p);
  const len = Math.sqrt(Object.values(pt).reduce((s, x) => s + x * x, 0)) || 1;
  const parts = Object.entries(pt).map(([t, x]) => [t, (tw[t] || 0) * x]);
  const score = parts.reduce((s, [, x]) => s + x, 0) / len;
  const why = parts.filter(([t, x]) => x > 0 && TAG_LABEL[t]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => TAG_LABEL[t]);
  return { score, why };
}
const whyText = (why) => {
  if (why.length === 2) return { en: `Chosen for its ${why[0][0]} and ${why[1][0]}.`, ar: `اخترناه لما فيه من ${why[0][1]} و${why[1][1]}.` };
  if (why.length === 1) return { en: `Chosen for its ${why[0][0]}.`, ar: `اخترناه لما فيه من ${why[0][1]}.` };
  return { en: 'Chosen to complete your ritual.', ar: 'اخترناه ليكمل طقسك.' };
};

const STEPS = {
  base: {
    title: { en: 'The base', ar: 'القاعدة' },
    how: { en: 'Warm a drop between your fingers and press it on your wrists, neck and behind the ears.', ar: 'دفّئ قطرة بين أصابعك وضعها على المعصمين والرقبة وخلف الأذنين.' },
  },
  signature: {
    title: { en: 'The signature', ar: 'التوقيع' },
    how: { en: 'Spray two or three times over the oil from a hand’s length away. The oil anchors it, so it lasts longer.', ar: 'رشّه مرتين أو ثلاثًا فوق الزيت من مسافة شبر، فالزيت يثبّته ليدوم أطول.' },
  },
  finish: {
    title: { en: 'The finish', ar: 'اللمسة الأخيرة' },
    how: { en: 'Light a piece and let the smoke pass through your clothes, your hair and your majlis.', ar: 'أشعل قطعة ودع دخانها يعطّر ثيابك وشعرك ومجلسك.' },
  },
};

/**
 * Build the Crown Ritual from the live catalog.
 * @param a        cleaned answers
 * @param products [{ id, category_slug, families: [slug], notes: [{ name, level }], ... }] (in stock only)
 * @param name     the creation name ({ en, ar }) used in the story
 */
function ritual(a, products, name) {
  const tw = profileOf(a);
  const scored = products.map((p) => ({ p, role: ROLE(p.category_slug), ...fit(tw, p) })).filter((x) => x.role);
  const list = scored.filter((x) => x.role !== 'discovery');
  const hi = list.length ? Math.max(...list.map((x) => x.score)) : 1;
  const lo = list.length ? Math.min(...list.map((x) => x.score)) : 0;
  const pct = (s) => Math.round(68 + 29 * ((s - lo) / (hi - lo || 1)));
  const best = (roles, not = []) => list.filter((x) => roles.includes(x.role) && !not.includes(x.p.id)).sort((x, y) => y.score - x.score);

  const steps = [];
  const pickStep = (role, roles) => {
    const top = best(roles)[0];
    if (top) steps.push({ role, title: STEPS[role].title, how: STEPS[role].how, product: top.p, match: pct(top.score), why: whyText(top.why) });
  };
  pickStep('base', ['base']);
  pickStep('signature', best(['signature']).length ? ['signature'] : ['exclusive']);
  pickStep('finish', ['finish']);

  const used = steps.map((s) => s.product.id);
  const matches = best(['signature', 'exclusive'], used).slice(0, 3)
    .map((x) => ({ product: x.p, match: pct(x.score), why: whyText(x.why) }));
  const discovery = scored.find((x) => x.role === 'discovery')?.p || null;

  const mood = (a.mood || []).find((m) => W.mood[m]) || 'majestic';
  const place = W.place[a.place] ? a.place : 'desert';
  const who = WHO_TEXT[a.who] || WHO_TEXT.self;
  const occ = OCCASION_LINE[a.occasion] || OCCASION_LINE.special;
  const story = {
    en: `${name.en} is the scent signature we drew for ${who[0]}, ${PLACE_LINE[place][0]}. We layered it from our own creations, whose notes ${MOOD_LINE[mood][0]}, ${occ[0]}.`,
    ar: `«${name.ar}» هو التوقيع العطري الذي رسمناه ${who[1]}، ${PLACE_LINE[place][1]}. نسجناه من إبداعاتنا، ونوتاتها ${MOOD_LINE[mood][1]}، ${occ[1]}.`,
  };
  return { story, steps, matches, discovery };
}

module.exports = { compose, OPTIONS, ritual, profileOf, ROLE };
