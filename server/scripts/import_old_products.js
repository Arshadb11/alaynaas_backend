/**
 * Automated Migration Script: Imports legacy product database from Botble/Laravel (old_products.sql)
 * into the modern Admin Panel MySQL schema (perfume_admin).
 *
 * Tables Migrated:
 * 1. ec_product_categories -> categories
 * 2. ec_product_tags -> product_sizes
 * 3. product_fragrance_notes & product_fragrance_map -> fragrance_notes & product_fragrance_notes
 * 4. ec_products -> products
 * 5. ec_products.images / image -> product_images
 * 6. ec_products.olfactory_family -> product_olfactory_families & products.olfactory_family_id
 * 7. ec_products.price & quantity -> product_country_pricing (all 6 GCC countries)
 * 8. ec_products.seo_content / seo_content_ar -> product_country_seo
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// GCC Currency conversion rates relative to AED (base)
const GCC_RATES = {
  1: { code: 'AE', rate: 1.0, decimals: 2 },    // AED
  2: { code: 'SA', rate: 1.02, decimals: 2 },   // SAR
  3: { code: 'KW', rate: 0.084, decimals: 3 },  // KWD
  4: { code: 'QA', rate: 0.99, decimals: 2 },   // QAR
  5: { code: 'BH', rate: 0.103, decimals: 3 },  // BHD
  6: { code: 'OM', rate: 0.105, decimals: 3 },  // OMR
};

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/&amp;/g, 'and')
    .replace(/&/g, 'and')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSize(name) {
  if (!name) return null;
  const str = name.trim();
  
  let m = str.match(/^(\d+(?:\.\d+)?)\s*ml(?:\s+each)?$/i);
  if (m) return { value: parseFloat(m[1]), unit: 'ml', name: `${parseFloat(m[1])}ml` };
  
  m = str.match(/^(\d+(?:\.\d+)?)\s*g$/i);
  if (m) return { value: parseFloat(m[1]), unit: 'gm', name: `${parseFloat(m[1])}g` };
  
  m = str.match(/^(\d+(?:\.\d+)?)\s*tl$/i);
  if (m) return { value: parseFloat(m[1]), unit: 'tola', name: `${parseFloat(m[1])} Tola` };
  
  m = str.match(/^(\d+)\s*tabs?(?:\s+small)?$/i);
  if (m) return { value: parseInt(m[1], 10), unit: 'pcs', name: `${parseInt(m[1], 10)} Tabs` };

  m = str.match(/^(\d+(?:\.\d+)?)\s*(ml|gm|g|pcs|tab|tabs|tola|tl)$/i);
  if (m) {
    let unit = m[2].toLowerCase();
    if (unit === 'g') unit = 'gm';
    if (unit === 'tab' || unit === 'tabs') unit = 'pcs';
    if (unit === 'tl') unit = 'tola';
    return { value: parseFloat(m[1]), unit, name: `${parseFloat(m[1])} ${unit}` };
  }

  return null;
}

function cleanNoteString(str) {
  if (!str) return [];
  let cleaned = str
    .replace(/^(\||\s)*النفحات\s+(العليا|الوسطى|الأساسية)\s*:\s*/gi, '')
    .replace(/^(\||\s)*قلب\s+العطر\s*:\s*/gi, '')
    .replace(/^(\||\s)*قاعدة\s+العطر\s*:\s*/gi, '')
    .replace(/^(\||\s)*(Top|Heart|Base|Middle)\s+Notes?\s*:\s*/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim();

  return cleaned
    .split(/[,;\n،]+/)
    .map(n => n.trim().replace(/^[-•*–—\s]+/, '').replace(/[.\s]+$/, ''))
    .filter(n => n.length > 1 && !/^(top|heart|base|middle)\s+notes?$/i.test(n));
}

async function runMigration() {
  console.log('========================================================');
  console.log('   STARTING PRODUCT CATALOG MIGRATION (ETL)');
  console.log('========================================================');

  const stagingConn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'perfume_staging',
  });

  const adminConn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'perfume_admin',
    multipleStatements: true,
  });

  try {
    // ----------------------------------------------------
    // STEP 0: ENSURE SCHEMA COLUMNS IN PERFUME_ADMIN
    // ----------------------------------------------------
    console.log('\n[Step 0] Verifying and updating schema columns in perfume_admin...');
    await adminConn.query(`
      ALTER TABLE categories 
        ADD COLUMN IF NOT EXISTS description_ar TEXT AFTER description,
        ADD COLUMN IF NOT EXISTS icon_image VARCHAR(500) AFTER is_active,
        ADD COLUMN IF NOT EXISTS menu_image2 VARCHAR(500) AFTER icon_image,
        ADD COLUMN IF NOT EXISTS image VARCHAR(500) AFTER menu_image2,
        ADD COLUMN IF NOT EXISTS mobile_image VARCHAR(500) AFTER image;
    `);

    // ----------------------------------------------------
    // STEP 1: MIGRATE CATEGORIES
    // ----------------------------------------------------
    console.log('\n[Step 1] Migrating Categories...');
    const [legacyCats] = await stagingConn.query('SELECT * FROM ec_product_categories ORDER BY parent_id ASC, id ASC');
    const categoryMap = new Map(); // legacy_id -> admin_id

    for (const cat of legacyCats) {
      const slug = slugify(cat.name);
      const isActive = cat.status === 'published' ? 1 : 0;
      
      let mappedParentId = 0;
      if (cat.parent_id > 0 && categoryMap.has(cat.parent_id)) {
        mappedParentId = categoryMap.get(cat.parent_id);
      }

      const [existing] = await adminConn.query('SELECT id, parent_id FROM categories WHERE slug = ? OR name = ?', [slug, cat.name]);
      
      let adminCatId;
      if (existing.length > 0) {
        adminCatId = existing[0].id;
        await adminConn.query(`
          UPDATE categories SET 
            description = COALESCE(?, description),
            description_ar = COALESCE(?, description_ar),
            is_active = ?,
            icon_image = COALESCE(?, icon_image),
            menu_image2 = COALESCE(?, menu_image2),
            image = COALESCE(?, image),
            mobile_image = COALESCE(?, mobile_image)
          WHERE id = ?
        `, [cat.description, cat.description_ar, isActive, cat.icon_image, cat.menu_image2, cat.image, cat.mobile_image, adminCatId]);
      } else {
        const [insertRes] = await adminConn.query(`
          INSERT INTO categories (name, name_ar, slug, description, description_ar, parent_id, sort_order, is_active, icon_image, menu_image2, image, mobile_image)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [cat.name, cat.name, slug, cat.description, cat.description_ar, mappedParentId, cat.order || 0, isActive, cat.icon_image, cat.menu_image2, cat.image, cat.mobile_image]);
        adminCatId = insertRes.insertId;
      }

      categoryMap.set(cat.id, adminCatId);
    }
    console.log(`✓ Categories mapped: ${categoryMap.size} legacy categories reconciled.`);

    // ----------------------------------------------------
    // STEP 2: MIGRATE SIZES (ec_product_tags -> product_sizes)
    // ----------------------------------------------------
    console.log('\n[Step 2] Migrating Sizes from ec_product_tags...');
    const [legacyTags] = await stagingConn.query('SELECT id, name, status FROM ec_product_tags');
    const sizeMap = new Map(); // legacy_tag_id -> admin_size_id

    for (const tag of legacyTags) {
      const parsed = parseSize(tag.name);
      if (!parsed) continue;

      const isActive = tag.status === 'published' ? 1 : 0;
      
      await adminConn.query(`
        INSERT INTO product_sizes (name, value, unit, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          name = VALUES(name),
          is_active = VALUES(is_active)
      `, [parsed.name, parsed.value, parsed.unit, isActive, Math.round(parsed.value)]);

      const [sizeRow] = await adminConn.query('SELECT id FROM product_sizes WHERE value = ? AND unit = ?', [parsed.value, parsed.unit]);
      if (sizeRow.length > 0) {
        sizeMap.set(tag.id, sizeRow[0].id);
      }
    }
    console.log(`✓ Sizes mapped: ${sizeMap.size} size tags linked to product_sizes.`);

    // ----------------------------------------------------
    // STEP 3: MIGRATE FRAGRANCE NOTES MASTER LIBRARY
    // ----------------------------------------------------
    console.log('\n[Step 3] Migrating Master Fragrance Notes...');
    const [legacyNotesRows] = await stagingConn.query('SELECT * FROM product_fragrance_notes');
    const noteLookup = new Map(); // lower(name) -> admin note id

    const [existingNotes] = await adminConn.query('SELECT id, name, slug FROM fragrance_notes');
    for (const n of existingNotes) {
      noteLookup.set(n.name.toLowerCase().trim(), n.id);
    }

    for (const row of legacyNotesRows) {
      const levels = [
        { en: row.top_note, ar: row.top_note_ar, img: row.top_note_image, desc: row.top_note_description },
        { en: row.heart_note, ar: row.heart_note_ar, img: row.heart_note_image, desc: row.heart_note_description },
        { en: row.base_note, ar: row.base_note_ar, img: row.base_note_image, desc: row.base_note_description },
      ];

      for (const lvl of levels) {
        const enNotes = cleanNoteString(lvl.en);
        const arNotes = cleanNoteString(lvl.ar);

        for (let i = 0; i < enNotes.length; i++) {
          const noteName = enNotes[i];
          const noteKey = noteName.toLowerCase().trim();
          if (noteLookup.has(noteKey)) continue;

          const noteAr = arNotes[i] || null;
          let noteSlug = slugify(noteName);
          if (!noteSlug) noteSlug = `note-${Date.now()}-${Math.floor(Math.random()*1000)}`;

          try {
            const [ins] = await adminConn.query(`
              INSERT INTO fragrance_notes (name, name_ar, slug, description, image_url)
              VALUES (?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE 
                name_ar = COALESCE(VALUES(name_ar), name_ar),
                image_url = COALESCE(VALUES(image_url), image_url)
            `, [noteName, noteAr, noteSlug, lvl.desc ? stripHtml(lvl.desc) : null, lvl.img || null]);
            
            const [saved] = await adminConn.query('SELECT id FROM fragrance_notes WHERE slug = ? OR name = ?', [noteSlug, noteName]);
            if (saved.length > 0) {
              noteLookup.set(noteKey, saved[0].id);
            }
          } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') {
              noteSlug = `${noteSlug}-${Math.floor(Math.random()*1000)}`;
              const [ins2] = await adminConn.query(`
                INSERT INTO fragrance_notes (name, name_ar, slug, description, image_url)
                VALUES (?, ?, ?, ?, ?)
              `, [noteName, noteAr, noteSlug, lvl.desc ? stripHtml(lvl.desc) : null, lvl.img || null]);
              noteLookup.set(noteKey, ins2.insertId);
            }
          }
        }
      }
    }
    console.log(`✓ Master fragrance notes library ready: ${noteLookup.size} unique notes available.`);

    // ----------------------------------------------------
    // STEP 4: PREPARE OLFACTORY FAMILIES LOOKUP
    // ----------------------------------------------------
    const [existingFamRows] = await adminConn.query('SELECT id, name, slug FROM olfactory_families');
    const familyLookup = new Map();
    for (const f of existingFamRows) {
      familyLookup.set(f.slug.toLowerCase(), f.id);
      familyLookup.set(f.name.toLowerCase(), f.id);
    }

    function matchOlfactoryFamilies(text) {
      if (!text) return [];
      const lower = text.toLowerCase();
      const matched = new Set();

      const keywords = [
        { key: 'woody', id: familyLookup.get('woody') },
        { key: 'oriental', id: familyLookup.get('oriental') || familyLookup.get('oriental-amber') },
        { key: 'amber', id: familyLookup.get('oriental-amber') || familyLookup.get('amber') },
        { key: 'floral', id: familyLookup.get('floral') },
        { key: 'citrus', id: familyLookup.get('fresh-citrus') },
        { key: 'spicy', id: familyLookup.get('spicy') },
        { key: 'leather', id: familyLookup.get('leather') || familyLookup.get('chypre-leather') },
        { key: 'fruity', id: familyLookup.get('fruity') },
        { key: 'gourmand', id: familyLookup.get('gourmand') },
        { key: 'chypre', id: familyLookup.get('chypre') },
        { key: 'aquatic', id: familyLookup.get('aquatic-marine') },
        { key: 'marine', id: familyLookup.get('aquatic-marine') },
        { key: 'aromatic', id: familyLookup.get('aromatic-fougere') || familyLookup.get('woody-aromatic') },
      ];

      for (const kw of keywords) {
        if (kw.id && lower.includes(kw.key)) {
          matched.add(kw.id);
        }
      }
      return Array.from(matched);
    }

    // ----------------------------------------------------
    // STEP 5: PRELOAD LEGACY RELATIONAL MAPPINGS
    // ----------------------------------------------------
    console.log('\n[Step 5] Preloading legacy relational mappings...');
    
    // Product -> Categories (ec_product_category_product)
    const [prodCatRows] = await stagingConn.query(`
      SELECT cp.product_id, cp.category_id, c.parent_id
      FROM ec_product_category_product cp
      JOIN ec_product_categories c ON c.id = cp.category_id
      ORDER BY cp.product_id, c.parent_id ASC
    `);
    const prodCategoryMap = new Map();
    for (const r of prodCatRows) {
      if (!prodCategoryMap.has(r.product_id)) {
        prodCategoryMap.set(r.product_id, []);
      }
      prodCategoryMap.get(r.product_id).push({
        catId: categoryMap.get(r.category_id) || r.category_id,
        isParent: r.parent_id === 0,
        parentId: r.parent_id > 0 ? (categoryMap.get(r.parent_id) || r.parent_id) : 0,
      });
    }

    // Product -> Size (ec_product_tag_product)
    const [prodTagRows] = await stagingConn.query('SELECT product_id, tag_id FROM ec_product_tag_product');
    const prodTagMap = new Map();
    for (const r of prodTagRows) {
      if (sizeMap.has(r.tag_id)) {
        prodTagMap.set(r.product_id, sizeMap.get(r.tag_id));
      }
    }

    // Product -> Fragrance Notes Row (product_fragrance_map)
    const [prodFragMapRows] = await stagingConn.query('SELECT product_id, fragrance_note_id FROM product_fragrance_map');
    const prodFragMap = new Map();
    for (const r of prodFragMapRows) {
      prodFragMap.set(r.product_id, r.fragrance_note_id);
    }

    const fragNotesById = new Map();
    for (const r of legacyNotesRows) {
      fragNotesById.set(r.id, r);
    }

    // ----------------------------------------------------
    // STEP 6: CLEAR PREVIOUS PRODUCTS & IMPORT CLEANLY
    // ----------------------------------------------------
    console.log('\n[Step 6] Clearing previous products to guarantee clean IDs and relations...');
    await adminConn.query('SET FOREIGN_KEY_CHECKS = 0');
    await adminConn.query('DELETE FROM product_relations');
    await adminConn.query('DELETE FROM product_country_pricing');
    await adminConn.query('DELETE FROM product_country_seo');
    await adminConn.query('DELETE FROM product_images');
    await adminConn.query('DELETE FROM product_fragrance_notes');
    await adminConn.query('DELETE FROM product_olfactory_families');
    await adminConn.query('DELETE FROM products');
    await adminConn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('Importing 264 legacy products into perfume_admin...');
    const [legacyProducts] = await stagingConn.query('SELECT * FROM ec_products ORDER BY id ASC');

    let importedCount = 0;
    const existingSlugs = new Set();
    const existingSkus = new Set();

    for (const prod of legacyProducts) {
      const pid = prod.id;

      // 1. Generate unique slug
      let baseSlug = slugify(prod.name);
      if (!baseSlug) baseSlug = `product-${pid}`;
      let finalSlug = baseSlug;
      if (existingSlugs.has(finalSlug)) {
        finalSlug = `${baseSlug}-${pid}`;
      }
      existingSlugs.add(finalSlug);

      // 2. Resolve SKU
      let finalSku = (prod.sku || '').trim();
      if (!finalSku || finalSku === '*' || existingSkus.has(finalSku)) {
        if (prod.barcode && prod.barcode !== '*' && !existingSkus.has(prod.barcode)) {
          finalSku = prod.barcode.trim();
        } else {
          finalSku = `AAM-${pid}`;
        }
      }
      existingSkus.add(finalSku);

      // 3. Resolve Category & Subcategory
      let categoryId = 1; // default Perfumes
      let subcategoryId = null;
      const assignedCats = prodCategoryMap.get(pid);
      if (assignedCats && assignedCats.length > 0) {
        const rootCat = assignedCats.find(c => c.isParent);
        const childCat = assignedCats.find(c => !c.isParent);
        if (rootCat && childCat) {
          categoryId = rootCat.catId;
          subcategoryId = childCat.catId;
        } else if (childCat) {
          categoryId = childCat.parentId || 1;
          subcategoryId = childCat.catId;
        } else if (rootCat) {
          categoryId = rootCat.catId;
        }
      }

      // 4. Resolve Size
      let sizeId = prodTagMap.get(pid) || null;
      if (!sizeId && prod.size) {
        const parsed = parseSize(prod.size);
        if (parsed) {
          const [foundSize] = await adminConn.query('SELECT id FROM product_sizes WHERE value = ? AND unit = ?', [parsed.value, parsed.unit]);
          if (foundSize.length > 0) sizeId = foundSize[0].id;
        }
      }

      // 5. Resolve Gender
      let gender = 'unisex';
      const catText = `${prod.fragrance_category || ''} ${prod.olfactory_family || ''} ${prod.name || ''}`.toLowerCase();
      if (catText.includes('for women') || catText.includes('femme') || catText.includes('women')) {
        gender = 'women';
      } else if (catText.includes('for men') || catText.includes('homme') || catText.includes('men')) {
        gender = 'men';
      }

      // 6. Build Dynamic Specifications (JSON)
      const specifications = {
        itemFamily: prod.itemFamily || null,
        product_family: prod.product_family || null,
        sillage: prod.sillage || null,
        longevity: prod.longevity || null,
        how_to_use: prod.how_to_use || null,
        occasion: prod.occasion || null,
        olfactory_family: prod.olfactory_family || null,
        fragrance_type: prod.fragrance_type || null,
        fragrance_category: prod.fragrance_category || null,
        dispenser_type: prod.dispenser_type || null,
        is_collection: Boolean(prod.is_collection),
        barcode: (prod.barcode && prod.barcode !== '*') ? prod.barcode : finalSku,
        maximum_order_quantity: prod.maximum_order_quantity || null,
        allow_checkout_when_out_of_stock: Boolean(prod.allow_checkout_when_out_of_stock),
        with_storehouse_management: Boolean(prod.with_storehouse_management),
        video_media: prod.video_media || null,
        created_by_id: prod.created_by_id || null,
        synced: prod.synced || null,
      };

      // 7. Match Olfactory Families
      const matchedFamilies = matchOlfactoryFamilies(prod.olfactory_family);
      const primaryFamilyId = matchedFamilies.length > 0 ? matchedFamilies[0] : null;

      // 8. Status & Descriptions
      const status = prod.status === 'published' ? 'active' : (prod.status === 'draft' ? 'draft' : 'archived');
      const shortDesc = prod.description ? stripHtml(prod.description).slice(0, 490) : null;
      const shortDescAr = prod.description_ar ? stripHtml(prod.description_ar).slice(0, 490) : null;

      // 9. Insert Product
      await adminConn.query(`
        INSERT INTO products (
          id, name, name_ar, slug, brand_id, category_id, subcategory_id,
          olfactory_family_id, size_id, gender, specifications,
          short_description, short_description_ar, description, description_ar,
          seo_title, seo_description, seo_keywords,
          sku, status, is_featured, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        pid,
        prod.name,
        prod.name_ar || null,
        finalSlug,
        1, // brand_id
        categoryId,
        subcategoryId,
        primaryFamilyId,
        sizeId,
        gender,
        JSON.stringify(specifications),
        shortDesc,
        shortDescAr,
        prod.description || null,
        prod.description_ar || null,
        prod.name,
        prod.seo_content ? stripHtml(prod.seo_content).slice(0, 490) : shortDesc,
        prod.seo_content_ar ? stripHtml(prod.seo_content_ar).slice(0, 490) : null,
        finalSku,
        status,
        prod.is_featured ? 1 : 0,
        prod.created_at || new Date(),
        prod.updated_at || new Date(),
      ]);

      // 10. Insert Multi-Accords (product_olfactory_families)
      if (matchedFamilies.length > 0) {
        for (let i = 0; i < matchedFamilies.length; i++) {
          await adminConn.query(`
            INSERT INTO product_olfactory_families (product_id, olfactory_family_id, is_primary, sort_order)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary)
          `, [pid, matchedFamilies[i], i === 0, i]);
        }
      }

      // 11. Insert Images (product_images)
      const imageList = [];
      const primaryImg = (prod.image || '').trim();

      if (prod.images) {
        try {
          const parsed = JSON.parse(prod.images);
          if (Array.isArray(parsed)) {
            for (const img of parsed) {
              if (typeof img === 'string' && img.trim()) {
                imageList.push(img.trim());
              }
            }
          }
        } catch (_) {}
      }

      if (primaryImg && !imageList.includes(primaryImg)) {
        imageList.unshift(primaryImg);
      }

      for (let i = 0; i < imageList.length; i++) {
        const imgUrl = imageList[i];
        const isPrimary = (imgUrl === primaryImg) || (i === 0 && !primaryImg);
        await adminConn.query(`
          INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
          VALUES (?, ?, ?, ?, ?)
        `, [pid, imgUrl, prod.name, i + 1, isPrimary ? 1 : 0]);
      }

      // 12. Insert Fragrance Notes Pyramid (product_fragrance_notes)
      const notesRowId = prodFragMap.get(pid);
      const notesRow = notesRowId ? fragNotesById.get(notesRowId) : null;

      const levelsToInsert = [
        { level: 'top', text: notesRow?.top_note || prod.note_1 },
        { level: 'heart', text: notesRow?.heart_note || prod.note_2 },
        { level: 'base', text: notesRow?.base_note || prod.note_3 },
      ];

      for (const lvl of levelsToInsert) {
        const noteItems = cleanNoteString(lvl.text);
        const seenInLevel = new Set();
        let sortIdx = 1;

        for (const noteName of noteItems) {
          const nKey = noteName.toLowerCase().trim();
          const noteId = noteLookup.get(nKey);
          if (noteId && !seenInLevel.has(noteId)) {
            seenInLevel.add(noteId);
            await adminConn.query(`
              INSERT INTO product_fragrance_notes (product_id, note_id, note_level, sort_order)
              VALUES (?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)
            `, [pid, noteId, lvl.level, sortIdx++]);
          }
        }
      }

      // 13. Insert Multi-Country Pricing & Stock (product_country_pricing)
      const basePrice = parseFloat(prod.price) || 0;
      const stockQty = parseInt(prod.quantity, 10) || 0;
      const isAvailable = prod.stock_status === 'in_stock' ? 1 : 0;

      for (let cId = 1; cId <= 6; cId++) {
        const rateInfo = GCC_RATES[cId];
        const localizedPrice = (basePrice * rateInfo.rate).toFixed(rateInfo.decimals);
        const countryStock = (cId === 1) ? stockQty : Math.floor(stockQty * 0.5);

        await adminConn.query(`
          INSERT INTO product_country_pricing (
            product_id, country_id, price, cost_price, stock_quantity, low_stock_threshold, is_available
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [pid, cId, localizedPrice, (localizedPrice * 0.4).toFixed(rateInfo.decimals), countryStock, 5, isAvailable]);
      }

      // 14. Insert Country SEO Metadata (product_country_seo)
      for (let cId = 1; cId <= 6; cId++) {
        await adminConn.query(`
          INSERT INTO product_country_seo (product_id, country_id, seo_title, seo_description, seo_keywords)
          VALUES (?, ?, ?, ?, ?)
        `, [
          pid,
          cId,
          prod.name,
          prod.seo_content ? stripHtml(prod.seo_content).slice(0, 490) : shortDesc,
          prod.seo_content_ar ? stripHtml(prod.seo_content_ar).slice(0, 490) : null,
        ]);
      }

      importedCount++;
      if (importedCount % 50 === 0 || importedCount === legacyProducts.length) {
        console.log(`  Imported ${importedCount}/${legacyProducts.length} products...`);
      }
    }

    console.log('\n========================================================');
    console.log('   MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('========================================================');

    // Final verification summaries
    const [prodTotal] = await adminConn.query('SELECT COUNT(*) as cnt FROM products');
    const [imgTotal] = await adminConn.query('SELECT COUNT(*) as cnt FROM product_images');
    const [pfnTotal] = await adminConn.query('SELECT COUNT(*) as cnt FROM product_fragrance_notes');
    const [pcpTotal] = await adminConn.query('SELECT COUNT(*) as cnt FROM product_country_pricing');
    const [pofTotal] = await adminConn.query('SELECT COUNT(*) as cnt FROM product_olfactory_families');
    const [seoTotal] = await adminConn.query('SELECT COUNT(*) as cnt FROM product_country_seo');

    console.log('\nFinal Database State (perfume_admin):');
    console.log(`- Products:                  ${prodTotal[0].cnt}`);
    console.log(`- Product Images:            ${imgTotal[0].cnt}`);
    console.log(`- Fragrance Notes Links:     ${pfnTotal[0].cnt}`);
    console.log(`- Multi-Country Pricing:     ${pcpTotal[0].cnt}`);
    console.log(`- Olfactory Accord Links:    ${pofTotal[0].cnt}`);
    console.log(`- Country SEO Records:       ${seoTotal[0].cnt}`);

  } catch (err) {
    console.error('\n❌ MIGRATION FAILED:', err);
    throw err;
  } finally {
    await stagingConn.end();
    await adminConn.end();
  }
}

runMigration().then(() => {
  console.log('\nScript finished cleanly.');
  process.exit(0);
}).catch(() => {
  process.exit(1);
});
