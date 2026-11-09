-- =============================================
-- PRODUCTS MODULE SEED DATA
-- =============================================

USE perfume_admin;

-- 1. SIZES
INSERT INTO product_sizes (name, name_ar, value, unit, sort_order) VALUES
('100ml', '100 مل', 100.00, 'ml', 1),
('50ml', '50 مل', 50.00, 'ml', 2),
('6ml', '6 مل', 6.00, 'ml', 3),
('12ml', '12 مل', 12.00, 'ml', 4),
('70g', '70 غرام', 70.00, 'gm', 5),
('1 Piece', 'قطعة واحدة', 1.00, 'pcs', 6),
('3-Piece Set', 'طقم هدايا 3 قطع', 3.00, 'pcs', 7)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2. OLFACTORY FAMILIES
INSERT INTO olfactory_families (name, name_ar, slug, description, icon_url) VALUES
('Woody', 'خشبي', 'woody', 'Rich and earthy notes of cedarwood, sandalwood, and patchouli', '/icons/woody.svg'),
('Oriental Amber', 'شرقي عنبري', 'oriental-amber', 'Warm, opulent accords of amber, spices, and precious oud', '/icons/amber.svg'),
('Floral', 'زهري', 'floral', 'Lush romantic bouquets of Taif rose, jasmine, and neroli', '/icons/floral.svg'),
('Fresh Citrus', 'منعش حمضيات', 'fresh-citrus', 'Invigorating bursts of Italian bergamot, lemon, and crisp breezes', '/icons/citrus.svg'),
('Gourmand', 'حلواني', 'gourmand', 'Delicious hints of vanilla, roasted tonka bean, and sweet praline', '/icons/gourmand.svg')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 3. FRAGRANCE NOTES MASTER LIBRARY
INSERT INTO fragrance_notes (name, name_ar, slug, description, description_ar, image_url) VALUES
('Bergamot', 'برغموت', 'bergamot', 'Crisp, sparkling Italian citrus with an uplifting aromatic aroma.', 'حمضيات إيطالية منعشة وفواحة تمنح إحساساً بالحيوية والنشاط.', 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=300'),
('Cardamom', 'هيل', 'cardamom', 'Exotic, warm, resinous green spice delivering refined distinction.', 'توابل خضراء شرقية دافئة وغنية برائحة زكية لا تقاوم.', 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=300'),
('Saffron', 'زعفران', 'saffron', 'The royal red gold of spices with leather and bittersweet facets.', 'ذهب التوابل الأحمر النفيس بنفحات جلدية وحلوة مرهفة.', 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=300'),
('Lavender', 'خزامى', 'lavender', 'Aromatic Provence lavender with soothing herbaceous freshness.', 'أزهار اللافندر الفرنسية العطرية بانتعاشها العشبي المهدئ.', 'https://images.unsplash.com/photo-1528722828814-77b9b83aafb2?w=300'),
('Bulgarian Rose', 'ورد بلغاري', 'bulgarian-rose', 'Velvety, petal-soft Damascena rose exuding timeless elegance.', 'بتلات الورد الجوري البلغاري المخملية برائحتها الرومانسية الخالدة.', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300'),
('Jasmine Sambac', 'ياسمين سامباك', 'jasmine-sambac', 'Nocturnal blooming white jasmine with sensual sweet honeyed notes.', 'أزهار الياسمين الأبيض الفاتنة بنفحاتها العسلية الآسرة.', 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?w=300'),
('Cinnamon', 'قرفة', 'cinnamon', 'Rich Ceylon cinnamon bark offering spicy comfort and warmth.', 'لحاء القرفة السيلانية الفاخر الذي يمنح دفئاً وحلاوة آسرة.', 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=300'),
('Cambodian Oud', 'عود كمبودي', 'cambodian-oud', 'Aged, smoky, and resinous agarwood oil from pristine Cambodian forests.', 'دهن عود كمبودي معتق ودخاني من أجود الغابات الطبيعية.', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=300'),
('Ambergris', 'عنبر كلاسيكي', 'ambergris', 'Warm, oceanic, and velvety amber delivering unforgettable trail.', 'عنبر نقي دافئ بنفحات بحرية مخملية تمنح العطر ثباتاً أسطورياً.', 'https://images.unsplash.com/photo-1563178406-4cdc2923acbc?w=300'),
('Sandalwood', 'صندل', 'sandalwood', 'Creamy Mysore sandalwood imparting sophisticated woody calm.', 'خشب الصندل الهندي الكريمي الفاخر بلمساته الهادئة المتوازنة.', 'https://images.unsplash.com/photo-1541689592655-f5f52825a3b8?w=300'),
('White Musk', 'مسك أبيض', 'white-musk', 'Silky, clean, powdery veil that enhances longevity and purity.', 'عبير المسك الأبيض الحريري النقي لإشراقة ونعومة تدوم طويلاً.', 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=300'),
('Vanilla', 'فانيليا مدغشقر', 'vanilla', 'Gourmand Madagascar bourbon vanilla providing sweet magnetic comfort.', 'فانيليا مدغشقر البوربون الغنية بنعومتها وجاذبيتها المغناطيسية.', 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 4. SEED PRODUCTS
-- Categories reference:
-- 1: Perfumes, 2: Concentrated Parfum, 3: Bakhoor & Incense, 4: Gift Sets
-- 5: Occidental Fragrance (parent 1), 6: Oriental Fragrance (parent 1), 7: French Fragrance (parent 1), 8: K Series (parent 1)

INSERT INTO products (
    id, name, name_ar, slug, brand_id, category_id, subcategory_id,
    olfactory_family_id, size_id, gender, specifications,
    short_description, short_description_ar, description, description_ar,
    seo_title, seo_description, seo_keywords,
    sku, stock_quantity, low_stock_threshold, max_order_quantity,
    status, is_featured
) VALUES
(
    1,
    'Dulook',
    'دلوك',
    'dulook',
    1, 1, 5,
    1, 1, 'unisex',
    JSON_OBJECT(
        'fragrance_type', 'Eau De Parfum',
        'fragrance_category', 'Occidental',
        'dispenser_type', 'Spray',
        'sillage', 'Strong',
        'longevity', '12+ Hours',
        'season', 'All Season',
        'occasion', 'Evening / Signature'
    ),
    'A sophisticated occidental blend pairing French lavender with aged Cambodian oud.',
    'مزيج غربي راقٍ يجمع بين اللافندر الفرنسي ونفحات العود الكمبودي المعتق.',
    'Dulook is a masterpiece of contemporary perfumery that effortlessly bridges Western refinement and Arabian heritage. The fragrance opens with radiant bergamot and soothing French lavender before unfurling into an opulent spicy-floral heart of jasmine and cinnamon. The dry-down reveals rich Cambodian oud wrapped in creamy Mysore sandalwood and warm Madagascar vanilla.',
    'عطر دلوك تحفة عطرية عصرية تمزج بسلاسة بين الأناقة الغربية والأصالة العربية. يبدأ العطر بنفحات منعشة من البرغموت الإيطالي والخزامى الفرنسية، ليتألق قلبه بمزيج دافئ من الياسمين الأبيض والقرفة السيلانية، قبل أن يستقر على قاعدة ملكية آسرة من العود الكمبودي وخشب الصندل والفانيليا الناعمة.',
    'Dulook Eau De Parfum 100ml | Ahmed Al Maghribi Perfumes',
    'Buy Dulook Eau De Parfum 100ml by Ahmed Al Maghribi. A luxury oriental-occidental perfume featuring French lavender, jasmine, and Cambodian oud.',
    'dulook, ahmed al maghribi, luxury perfume, oud perfume, occidental fragrance',
    'AAM-DUL-100', 45, 5, 5,
    'active', TRUE
),
(
    2,
    'Fakhama',
    'فخامة',
    'fakhama',
    1, 1, 6,
    2, 1, 'unisex',
    JSON_OBJECT(
        'fragrance_type', 'Eau De Parfum',
        'fragrance_category', 'Oriental',
        'dispenser_type', 'Spray',
        'sillage', 'Enormous',
        'longevity', 'Eternal',
        'season', 'Winter / Fall',
        'occasion', 'Royal Ceremonies / Special Occasions'
    ),
    'A regal composition of royal saffron, velvety Bulgarian rose, and ambergris.',
    'تركيبة ملكية مهيبة من الزعفران النادر والورد البلغاري الفاخر والعنبر الأصيل.',
    'Fakhama lives up to its noble name—radiating grandeur and aristocratic prestige. Crafted for connoisseurs of authentic oriental perfumery, it opens with fiery Persian saffron and spiced cardamom. The heart blooms with the most precious Bulgarian rose petals, grounded on a foundation of oceanic ambergris, raw Cambodian oud, and precious woods.',
    'عطر فخامة يجسد اسمه الملكي بكل هيبة ووقار. صُمم خصيصاً لعشاق العطور الشرقية الأصيلة، حيث يفتتح بنفحات الهيل الملكي والزعفران الإيراني الفاخر، ويتوسطه عبير الورد البلغاري المخملي، ويرتكز على قاعدة أسطورية من العنبر الطبيعي ودهن العود الكمبودي الفاخر.',
    'Fakhama Eau De Parfum 100ml | Ahmed Al Maghribi Perfumes',
    'Discover Fakhama Eau De Parfum by Ahmed Al Maghribi. A prestigious blend of saffron, Bulgarian rose, ambergris, and Cambodian oud.',
    'fakhama, royal perfume, saffron rose oud, ahmed al maghribi uae',
    'AAM-FAK-100', 30, 5, 5,
    'active', TRUE
),
(
    3,
    'Intense Oud',
    'عود مكثف',
    'intense-oud',
    1, 2, NULL,
    2, 3, 'unisex',
    JSON_OBJECT(
        'fragrance_type', 'Concentrated Perfume Oil',
        'fragrance_category', 'Oriental Pure Dahn',
        'dispenser_type', 'Dipstick / Crystal Wand',
        'sillage', 'Intimate to Strong',
        'longevity', 'Eternal (24h+)',
        'origin', 'Cambodia & India'
    ),
    '100% concentrated artisanal perfume oil capturing the purest essence of aged oud.',
    'زيت عطري مركز ونقي 100% يجسد خلاصة دهن العود المعتق بأعلى معايير النقاء.',
    'Intense Oud is an artisanal concentrated perfume oil created for true oud aficionados. Distilled through traditional copper stills, this single-accord elixir boasts complex leather, animalic, and sweet woody nuances that evolve with skin temperature throughout the day.',
    'دهن عود مكثف نقي فائق الجودة، تم تقطيره بعناية فائقة ليعكس أسرار العود الأصيل بنفحاته الخشبية والجلدية العميقة التي تزداد جمالاً وسحراً مع حرارة الجلد.',
    'Intense Oud Concentrated Perfume Oil 6ml | Ahmed Al Maghribi',
    'Pure Intense Oud concentrated oil 6ml by Ahmed Al Maghribi. Authentic pure oud with unrivaled 24-hour longevity.',
    'intense oud, pure dahn oud, concentrated perfume oil, tola oud',
    'AAM-OUD-006', 60, 10, 10,
    'active', TRUE
),
(
    4,
    'Bakhoor Al Maghribi',
    'بخور المغربي',
    'bakhoor-al-maghribi',
    1, 3, NULL,
    1, 5, 'unisex',
    JSON_OBJECT(
        'fragrance_type', 'Bakhoor / Incense',
        'fragrance_category', 'Traditional Incense',
        'dispenser_type', 'Incense Burner (Mabkhara)',
        'sillage', 'Enormous',
        'longevity', 'Eternal'
    ),
    'Premium incense tablets soaked in rose, musk, and pure agarwood extracts.',
    'أقراص بخور فاخرة مشبعة بخلاصة الورد الجوري والمسك ودهن العود الطبيعي.',
    'Bakhoor Al Maghribi creates an inviting sanctuary of Arabian hospitality. High-grade agarwood chips are slowly steeped in essential perfume oils to infuse homes and garments with a warm, enduring cloud of serene elegance.',
    'بخور المغربي الفاخر يعطر الأجواء بنفحات الضيافة العربية العريقة. رقائق عود طبيعية ممتازة مشبعة بأجود الزيوت العطرية والمسك لتملأ المنازل والملابس برائحة مهدئة تأسر القلوب.',
    'Bakhoor Al Maghribi 70g | Premium Incense by Ahmed Al Maghribi',
    'Authentic Bakhoor Al Maghribi 70g incense. Rich agarwood steeped in Taif rose and precious musk for home and special events.',
    'bakhoor al maghribi, arabian incense, premium bakhoor uae, mabkhara',
    'AAM-BAK-001', 100, 15, 10,
    'active', FALSE
)
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    specifications = VALUES(specifications);

-- 5. PRODUCT FRAGRANCE NOTES MAPPING
-- Dulook (id=1):
-- Top: Bergamot (1), Lavender (4)
-- Heart: Jasmine (6), Cinnamon (7)
-- Base: Cambodian Oud (8), Sandalwood (10), Vanilla (12)
INSERT INTO product_fragrance_notes (product_id, note_id, note_level, sort_order) VALUES
(1, 1, 'top', 1),
(1, 4, 'top', 2),
(1, 6, 'heart', 1),
(1, 7, 'heart', 2),
(1, 8, 'base', 1),
(1, 10, 'base', 2),
(1, 12, 'base', 3),

-- Fakhama (id=2):
-- Top: Cardamom (2), Saffron (3)
-- Heart: Bulgarian Rose (5)
-- Base: Ambergris (9), Cambodian Oud (8)
(2, 2, 'top', 1),
(2, 3, 'top', 2),
(2, 5, 'heart', 1),
(2, 9, 'base', 1),
(2, 8, 'base', 2),

-- Intense Oud (id=3): Single-level General Note
(3, 8, 'general', 1),

-- Bakhoor Al Maghribi (id=4): Single-level General Note
(4, 5, 'general', 1),
(4, 8, 'general', 2),
(4, 11, 'general', 3)
ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order);

-- 6. MULTI-COUNTRY PRICING
-- Country IDs:
-- 1: AE (AED, 2 dec), 2: SA (SAR, 2 dec), 3: KW (KWD, 3 dec), 4: QA (QAR, 2 dec), 5: BH (BHD, 3 dec), 6: OM (OMR, 3 dec)

-- Dulook (id=1):
INSERT INTO product_country_pricing (product_id, country_id, price, cost_price, is_available) VALUES
(1, 1, 300.000, 120.000, TRUE),
(1, 2, 300.000, 120.000, TRUE),
(1, 3, 25.000, 10.000, TRUE),
(1, 4, 295.000, 118.000, TRUE),
(1, 5, 30.000, 12.000, TRUE),
(1, 6, 31.000, 12.500, TRUE),

-- Fakhama (id=2):
(2, 1, 290.000, 115.000, TRUE),
(2, 2, 290.000, 115.000, TRUE),
(2, 3, 24.000, 9.500, TRUE),
(2, 4, 285.000, 112.000, TRUE),
(2, 5, 29.000, 11.500, TRUE),
(2, 6, 30.000, 12.000, TRUE),

-- Intense Oud (id=3):
(3, 1, 150.000, 60.000, TRUE),
(3, 2, 150.000, 60.000, TRUE),
(3, 3, 12.500, 5.000, TRUE),
(3, 4, 145.000, 58.000, TRUE),
(3, 5, 15.000, 6.000, TRUE),
(3, 6, 15.500, 6.200, TRUE),

-- Bakhoor Al Maghribi (id=4):
(4, 1, 120.000, 45.000, TRUE),
(4, 2, 120.000, 45.000, TRUE),
(4, 3, 10.000, 3.800, TRUE),
(4, 4, 115.000, 44.000, TRUE),
(4, 5, 12.000, 4.500, TRUE),
(4, 6, 12.500, 4.800, TRUE)
ON DUPLICATE KEY UPDATE price = VALUES(price), cost_price = VALUES(cost_price);

-- 7. PRODUCT IMAGES
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES
(1, 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600', 'Dulook Eau De Parfum Bottle', 1, TRUE),
(1, 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600', 'Dulook Luxury Packaging', 2, FALSE),
(2, 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=600', 'Fakhama Perfume Bottle', 1, TRUE),
(3, 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600', 'Intense Oud Crystal Bottle', 1, TRUE),
(4, 'https://images.unsplash.com/photo-1563178406-4cdc2923acbc?w=600', 'Bakhoor Al Maghribi Box', 1, TRUE)
ON DUPLICATE KEY UPDATE url = VALUES(url);

-- 8. PRODUCT RELATIONS
INSERT INTO product_relations (product_id, related_product_id, relation_type, sort_order) VALUES
(1, 2, 'related', 1),
(1, 3, 'same_family', 2),
(2, 1, 'related', 1),
(2, 3, 'same_family', 2)
ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order);

-- 9. PERMISSIONS FOR PRODUCT MODULE
INSERT INTO permissions (module, action, description) VALUES
('products', 'read', 'View product catalog and specifications'),
('products', 'create', 'Create new draft products'),
('products', 'update', 'Full product update (pricing, warehouse stock, status, availability, and content)'),
('products', 'update_content', 'Edit product name, description, specs, notes, media, and SEO'),
('products', 'delete', 'Archive or delete products')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Admin (Saood, id=1): All product permissions
INSERT INTO user_permissions (user_id, permission_id, granted_by)
SELECT 1, id, 1 FROM permissions WHERE module = 'products'
ON DUPLICATE KEY UPDATE granted_by = 1;

-- Admin Preset (role_id=1): All product permissions
INSERT INTO role_permission_presets (role_id, permission_id)
SELECT 1, id FROM permissions WHERE module = 'products'
ON DUPLICATE KEY UPDATE role_id = 1;

-- Rehan (id=2): Can edit full products, pricing, and stock
INSERT INTO user_permissions (user_id, permission_id, granted_by)
SELECT 2, id, 1 FROM permissions
WHERE module = 'products' AND action IN ('read', 'create', 'update')
ON DUPLICATE KEY UPDATE granted_by = 1;

-- Sohail (id=3): Content only — read and update content/SEO, NO pricing, NO create/delete
INSERT INTO user_permissions (user_id, permission_id, granted_by)
SELECT 3, id, 1 FROM permissions
WHERE module = 'products' AND action IN ('read', 'update_content')
ON DUPLICATE KEY UPDATE granted_by = 1;
