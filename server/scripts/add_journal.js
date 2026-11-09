/**
 * Journal (Admin > Storefront > Journal): creates `journal_entries` and seeds 11 starter entries
 * (English content, Arabic titles/excerpts). Safe to re-run: existing entries are never overwritten.
 */
const db = require('../src/config/db');
const redisClient = require('../src/config/redis');

const IMG = ['/images/journal.jpg', '/images/notebook.jpg', '/images/workbench.jpg', '/images/materials.jpg', '/images/craft.jpg', '/images/story.jpg'];

const ENTRIES = [
  {
    slug: 'why-alaynaas-exists', cat: ['The house', 'البيت'], featured: 1,
    title: ['Why ALAYNAAS exists', 'لماذا وُجدت ألينّاس'],
    excerpt: ['Because fragrance can be more personal than simply smelling good.', 'لأن العطر يمكن أن يكون أكثر شخصية من مجرد رائحة طيبة.'],
    content: `ALAYNAAS began with fascination. Not with a business plan, but with the way a few drops of oud or amber can change how a room feels, and how a person is remembered. We wanted to make fragrances that carry a mood, a memory and a presence, rather than another bottle that simply smells pleasant for the first five minutes.

## What we believe
A fragrance should feel like it belongs to someone. The same perfume sits differently on every skin, which is why we care less about trends and more about character: the warmth of the base, the way the heart opens, and the trace that is left in a scarf the next morning.

## Where we are going
We are a young UAE house and we are honest about it. We are learning, testing and refining in the open, and this journal is where we share that process: the materials, the mistakes and the small decisions that eventually become a bottle in your hands.`,
  },
  {
    slug: 'the-first-fragrance', cat: ['The making', 'الصناعة'], featured: 0,
    title: ['The first fragrance', 'العطر الأول'],
    excerpt: ['Where it started, and what it taught us.', 'من أين بدأنا، وماذا علّمنا.'],
    content: `A first fragrance teaches you what you do not know. We began with a simple idea of a warm, resinous signature and quickly discovered how many decisions hide behind one accord: which oud, how much amber, whether the opening should whisper or announce itself.

## Learning by smelling
There was no shortcut. Every version was smelled on paper, then on skin, then again hours later, because a composition that impresses in the first minute can fall apart by the third hour. We kept notes on everything, including the versions that did not work.

## What stayed with us
The biggest lesson was patience. A fragrance needs time to rest, to settle and to be judged on a different day with a calmer nose. That habit of waiting is still part of how every ALAYNAAS creation is made today.`,
  },
  {
    slug: 'what-makes-a-fragrance-memorable', cat: ['Fragrance notes', 'ملاحظات عطرية'], featured: 0,
    title: ['What makes a fragrance memorable?', 'ما الذي يجعل العطر لا يُنسى؟'],
    excerpt: ['Not the bottle. Not the name. What remains after you leave.', 'ليست الزجاجة ولا الاسم، بل ما يبقى بعد رحيلك.'],
    content: `We rarely remember lists of notes. We remember how a fragrance made a moment feel: a wedding evening, a hot street after rain, someone's coat as they walked past. A memorable perfume is one that attaches itself to a feeling, not one that has the longest ingredient list.

## The three acts
The first few seconds are only an introduction. The real story is made in the heart, when the character of the fragrance appears, and in the dry-down, the quiet trail that lingers on the skin for hours. A great composition is written with all three acts in mind.

## Why skin matters
The same fragrance behaves differently on every person because skin chemistry, warmth and even diet change how it develops. That is why we encourage trying a scent on your own skin and living with it for a day before deciding.`,
  },
  {
    slug: 'behind-the-bottle', cat: ['The making', 'الصناعة'], featured: 0,
    title: ['Behind the bottle', 'خلف الزجاجة'],
    excerpt: ['What goes into a bottle before it reaches you.', 'ما الذي يسبق الزجاجة قبل أن تصل إليك.'],
    content: `A bottle is the last decision, not the first. Before glass, cap or label is chosen, there are weeks of work on the liquid itself: balancing the notes, testing the concentration, and checking how the fragrance behaves in heat, in air conditioning and over a long day.

## Choosing the vessel
Once the fragrance is ready, the container should protect it and respect it. We look for weight in the hand, a clean line and a closure that feels deliberate, because opening a perfume is part of the experience.

## The final check
Every batch is checked for clarity, colour and scent before it is packed. If something is not right, it waits. We would rather delay a release than send out a bottle that does not meet the standard we set for ourselves.`,
  },
  {
    slug: 'before-a-fragrance-is-released', cat: ['The making', 'الصناعة'], featured: 0,
    title: ['What happens before a fragrance is released?', 'ماذا يحدث قبل إطلاق العطر؟'],
    excerpt: ['Testing, adjusting, waiting, and testing again.', 'تجريب، وتعديل، وانتظار، ثم تجريب من جديد.'],
    content: `Before a fragrance reaches the shop there is testing, then adjusting, then more testing. A composition is first built as small trial blends, each one changing a single element so we can understand exactly what it does.

## Time is an ingredient
Fragrances need to mature. After blending, a formula is left to rest so the materials can marry, and it is then smelled again on a different day. Many promising versions change completely after a week, for better or for worse.

## Real-life testing
We test on skin in real conditions: at work, outdoors, in the evening. We ask whether it lasts, whether it projects without overwhelming, and whether we still enjoy it at the end of the day. Only then is it considered ready.`,
  },
  {
    slug: 'the-search-for-the-right-materials', cat: ['Materials', 'المواد'], featured: 0,
    title: ['The search for the right materials', 'البحث عن المواد المناسبة'],
    excerpt: ['Every fragrance is only as good as what it is made from.', 'كل عطر بجودة المواد التي صُنع منها.'],
    content: `A fragrance is built from materials and imagination, and the imagination can only go as far as the materials allow. Oud, amber, rose, musk and saffron each come in many grades, and the difference between an average and an exceptional one is obvious within seconds.

## Smelling before buying
We evaluate materials the slow way: on strips, on skin and over several days. A raw material that smells rich at first can turn flat or sharp as it dries, so we judge it by how it finishes, not how it opens.

## Why it matters to you
Better materials give a fragrance depth, a smoother progression and a longer, more beautiful trail. It is the least visible part of a perfume, and the part we spend the most time on.`,
  },
  {
    slug: 'learning-fragrance-from-the-ground-up', cat: ['The house', 'البيت'], featured: 0,
    title: ['Learning fragrance from the ground up', 'تعلّم العطور من الأساس'],
    excerpt: ['Starting without all the answers.', 'البداية دون امتلاك كل الإجابات.'],
    content: `ALAYNAAS is still learning, and we say so openly. Perfumery is an old craft with a deep vocabulary, and the more we study it, the more we realise how much there is to understand about families, accords and the chemistry of how materials interact.

## Curiosity over certainty
We read, we smell, we ask questions of people who know more than we do, and we compare our work with fragrances we admire. Being a beginner in some areas keeps us careful and keeps us honest about what we claim.

## Sharing the process
We would rather show the real journey than pretend to be finished. If you follow this journal you will see our understanding grow, one fragrance at a time.`,
  },
  {
    slug: 'when-a-formula-doesnt-work', cat: ['The making', 'الصناعة'], featured: 0,
    title: ['When a formula doesn\u2019t work', 'عندما لا تنجح التركيبة'],
    excerpt: ['Mistakes are part of the process, not a detour from it.', 'الأخطاء جزء من الطريق وليست خروجًا عنه.'],
    content: `Some formulas fail. Some fail beautifully. A blend might smell wonderful in the bottle and turn sour on skin, or be balanced on paper and flat after two hours. Each failure shows us where the edges are.

## Reading what went wrong
We keep every failed version and write down why we think it did not work: too much of a heavy base, a heart that disappears, a top note that fades too fast. Those notes often become the starting point for the next, better attempt.

## Knowing when to stop
Sometimes the right decision is to put a formula aside, and sometimes to start again from the beginning. We would rather discard ten versions than release one we are not proud of.`,
  },
  {
    slug: 'building-alaynaas-from-the-uae', cat: ['The house', 'البيت'], featured: 0,
    title: ['Building ALAYNAAS from the UAE', 'بناء ألينّاس من الإمارات'],
    excerpt: ['The place where it is being made.', 'المكان الذي تُصنع فيه.'],
    content: `ALAYNAAS is a UAE fragrance brand, being built with the ambition to become a distinctive fragrance house. The region has a long relationship with perfume, from bakhoor in the majlis to oud on special occasions, and that heritage shapes how we think about scent.

## Rooted here
We work with the traditions we grew up around: resinous woods, rich oils, incense and warm florals. At the same time we want our fragrances to feel modern and wearable every day, not only on occasions.

## Made for customers here
Delivery across the UAE, payment on delivery and clear policies are part of the experience. A beautiful fragrance should also be simple to order and a pleasure to receive.`,
  },
  {
    slug: 'the-story-behind-lost-summer', cat: ['Fragrance notes', 'ملاحظات عطرية'], featured: 0,
    title: ['The story behind Lost Summer', 'قصة لوست سمر'],
    excerpt: ['A summer that exists now only in memory.', 'صيف لم يعد موجودًا إلا في الذاكرة.'],
    content: `Lost Summer is about the feeling of a summer you cannot return to: warm skin, open windows, evenings that seemed to last forever. We wanted to capture that bittersweet brightness rather than the literal smell of a season.

## Building the memory
The composition leans on light, sunny materials in the opening, then softens into a warmer, slightly nostalgic heart. The idea was a fragrance that feels familiar the moment you wear it, even if you cannot say why.

## How to wear it
It suits long afternoons and relaxed evenings. Apply to pulse points and let it develop; its character comes forward after the first hour.`,
  },
  {
    slug: 'why-we-dont-want-another-generic-perfume', cat: ['The house', 'البيت'], featured: 0,
    title: ['Why we don\u2019t want to make another generic perfume', 'لماذا لا نريد صنع عطر عادي آخر'],
    excerpt: ['There are enough of those already.', 'يكفي ما لدينا من العطور المتشابهة.'],
    content: `There is no shortage of fragrances that smell fine. Fresh, clean and inoffensive perfumes fill every shelf. We would rather make something that smells like someone: a fragrance with a point of view that people recognise on you and ask about.

## Character over safety
Taking a clear direction means not everyone will love every creation, and that is acceptable. A fragrance that tries to please everyone usually leaves no impression on anyone.

## Our promise
Every ALAYNAAS fragrance has a reason to exist. If we cannot explain what makes it different, it does not leave the workshop.`,
  },
];

async function main() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(160) NOT NULL UNIQUE,
        title_en VARCHAR(200) NOT NULL,
        title_ar VARCHAR(200) NULL,
        excerpt_en VARCHAR(500) NULL,
        excerpt_ar VARCHAR(500) NULL,
        category_en VARCHAR(80) NULL,
        category_ar VARCHAR(80) NULL,
        content_en MEDIUMTEXT NOT NULL,
        content_ar MEDIUMTEXT NULL,
        cover_image VARCHAR(500) NULL,
        is_published TINYINT(1) NOT NULL DEFAULT 1,
        is_featured TINYINT(1) NOT NULL DEFAULT 0,
        published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_journal_pub (is_published, published_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    let i = 0;
    for (const e of ENTRIES) {
      const when = new Date(Date.now() - i * 9 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
      await db.query(
        `INSERT IGNORE INTO journal_entries
           (slug, title_en, title_ar, excerpt_en, excerpt_ar, category_en, category_ar, content_en, cover_image, is_featured, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [e.slug, e.title[0], e.title[1], e.excerpt[0], e.excerpt[1], e.cat[0], e.cat[1], e.content, IMG[i % IMG.length], e.featured, when]
      );
      i++;
    }
    if (redisClient) { try { await redisClient.del('settings:public'); } catch { /* ignore */ } }
    console.log(`SUCCESS: journal_entries ready (${ENTRIES.length} starter entries)`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
main();
