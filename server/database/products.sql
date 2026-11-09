-- =============================================
-- PRODUCTS MODULE SCHEMA
-- =============================================

USE perfume_admin;

-- 1. ALTER EXISTING TABLES
ALTER TABLE countries 
  ADD COLUMN IF NOT EXISTS decimal_places TINYINT NOT NULL DEFAULT 2 AFTER currency_symbol,
  ADD COLUMN IF NOT EXISTS subunits_name VARCHAR(50) DEFAULT 'Fils' AFTER decimal_places;

UPDATE countries SET decimal_places = 2, subunits_name = 'Fils' WHERE code = 'AE';
UPDATE countries SET decimal_places = 2, subunits_name = 'Halala' WHERE code = 'SA';
UPDATE countries SET decimal_places = 3, subunits_name = 'Fils' WHERE code = 'KW';
UPDATE countries SET decimal_places = 2, subunits_name = 'Dirham' WHERE code = 'QA';
UPDATE countries SET decimal_places = 3, subunits_name = 'Fils' WHERE code = 'BH';
UPDATE countries SET decimal_places = 3, subunits_name = 'Baisa' WHERE code = 'OM';

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255) AFTER is_active,
  ADD COLUMN IF NOT EXISTS seo_description VARCHAR(500) AFTER seo_title,
  ADD COLUMN IF NOT EXISTS seo_keywords VARCHAR(500) AFTER seo_description;

-- 2. PRODUCT SIZES (Normalized for faceted storefront filtering)
CREATE TABLE IF NOT EXISTS product_sizes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    name_ar VARCHAR(50),
    value DECIMAL(8,2) NOT NULL,
    unit ENUM('ml', 'gm', 'pcs', 'tola') NOT NULL DEFAULT 'ml',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_size (value, unit)
) ENGINE=InnoDB;

-- 3. OLFACTORY FAMILIES (Scent profiles)
CREATE TABLE IF NOT EXISTS olfactory_families (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    name_ar VARCHAR(100),
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    icon_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. MASTER FRAGRANCE NOTES LIBRARY
CREATE TABLE IF NOT EXISTS fragrance_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    name_ar VARCHAR(100),
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    description_ar TEXT,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_note_name (name)
) ENGINE=InnoDB;

-- 5. PRODUCTS CORE TABLE
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255),
    slug VARCHAR(280) NOT NULL UNIQUE,

    -- Categorization & Brand
    brand_id INT DEFAULT 1,
    category_id INT NOT NULL,
    subcategory_id INT DEFAULT NULL,
    olfactory_family_id INT DEFAULT NULL,
    size_id INT DEFAULT NULL,
    gender ENUM('men', 'women', 'unisex') DEFAULT 'unisex',

    -- Dynamic Specifications (JSON Key-Value)
    -- e.g. {"fragrance_type": "Eau De Parfum", "fragrance_category": "Oriental", "dispenser_type": "Spray", "sillage": "Strong", "longevity": "12+ Hours"}
    specifications JSON,

    -- Content & Copywriting
    short_description VARCHAR(500),
    short_description_ar VARCHAR(500),
    description TEXT,
    description_ar TEXT,

    -- SEO Metadata
    seo_title VARCHAR(255),
    seo_description VARCHAR(500),
    seo_keywords VARCHAR(500),

    -- SKU Identifier
    sku VARCHAR(100) UNIQUE,

    -- Status & Flags
    status ENUM('draft', 'active', 'archived') DEFAULT 'draft',
    is_featured BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (subcategory_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (olfactory_family_id) REFERENCES olfactory_families(id) ON DELETE SET NULL,
    FOREIGN KEY (size_id) REFERENCES product_sizes(id) ON DELETE SET NULL,
    INDEX idx_prod_status (status),
    INDEX idx_prod_cat (category_id),
    INDEX idx_prod_subcat (subcategory_id),
    INDEX idx_prod_family (olfactory_family_id),
    INDEX idx_prod_size (size_id),
    INDEX idx_prod_gender (gender)
) ENGINE=InnoDB;

-- 6. PRODUCT FRAGRANCE NOTES RELATION (PYRAMID & SHARED)
CREATE TABLE IF NOT EXISTS product_fragrance_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    note_id INT NOT NULL,
    note_level ENUM('top', 'heart', 'base', 'general') NOT NULL DEFAULT 'general',
    sort_order INT DEFAULT 0,

    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (note_id) REFERENCES fragrance_notes(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_product_note_level (product_id, note_id, note_level),
    INDEX idx_pfn_product (product_id),
    INDEX idx_pfn_note (note_id),
    INDEX idx_pfn_level (note_level)
) ENGINE=InnoDB;

-- 6b. PRODUCT OLFACTORY FAMILIES (Multi-accords with primary designation)
CREATE TABLE IF NOT EXISTS product_olfactory_families (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    olfactory_family_id INT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (olfactory_family_id) REFERENCES olfactory_families(id) ON DELETE CASCADE,
    UNIQUE KEY uq_prod_family (product_id, olfactory_family_id)
) ENGINE=InnoDB;

-- 7. MULTI-COUNTRY PRICING (NO DISCOUNT COLUMNS)
CREATE TABLE IF NOT EXISTS product_country_pricing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    country_id INT NOT NULL,
    price DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    cost_price DECIMAL(12,3) DEFAULT 0.000,
    price_10ml DECIMAL(12,3) NULL DEFAULT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 5,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_prod_country (product_id, country_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
    INDEX idx_pricing_product (product_id),
    INDEX idx_pricing_country (country_id)
) ENGINE=InnoDB;

-- 8. PRODUCT IMAGES
CREATE TABLE IF NOT EXISTS product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    sort_order INT DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_image_prod (product_id)
) ENGINE=InnoDB;

-- 9. PRODUCT RELATIONS & SAME-FAMILY GROUPINGS
CREATE TABLE IF NOT EXISTS product_relations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    related_product_id INT NOT NULL,
    relation_type ENUM('related', 'same_family') NOT NULL DEFAULT 'related',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (related_product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY uq_prod_relation (product_id, related_product_id, relation_type),
    INDEX idx_rel_prod (product_id),
    INDEX idx_rel_target (related_product_id)
) ENGINE=InnoDB;

-- 10. PRODUCT COUNTRY-SPECIFIC SEO METADATA
CREATE TABLE IF NOT EXISTS product_country_seo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    country_id INT NOT NULL,
    seo_title VARCHAR(255),
    seo_description VARCHAR(500),
    seo_keywords VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_prod_country_seo (product_id, country_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
    INDEX idx_seo_product (product_id),
    INDEX idx_seo_country (country_id)
) ENGINE=InnoDB;

