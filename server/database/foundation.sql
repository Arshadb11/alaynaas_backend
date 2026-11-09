-- =============================================
-- FOUNDATION TABLES — Countries, Categories, Brands
-- Run after schema.sql and seed.sql
-- =============================================

USE perfume_admin;

-- ─── COUNTRIES & CURRENCIES ──────────────────────────────
CREATE TABLE IF NOT EXISTS countries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(5) NOT NULL UNIQUE,
    currency_code VARCHAR(5) NOT NULL,
    currency_symbol VARCHAR(10) NOT NULL,
    currency_name VARCHAR(50) NOT NULL,
    tax_percentage DECIMAL(5,2) DEFAULT 5.00,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Which countries a user can access
CREATE TABLE IF NOT EXISTS user_countries (
    user_id INT NOT NULL,
    country_id INT NOT NULL,
    PRIMARY KEY (user_id, country_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── CATEGORIES (Hierarchical) ──────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100),
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    parent_id INT DEFAULT 0,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parent (parent_id),
    INDEX idx_slug (slug)
) ENGINE=InnoDB;

-- ─── BRANDS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE,
    logo_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================
-- SEED DATA
-- =============================================

-- Countries (GCC region)
INSERT INTO countries (name, code, currency_code, currency_symbol, currency_name, tax_percentage, sort_order) VALUES
('United Arab Emirates', 'AE', 'AED', 'د.إ', 'UAE Dirham', 5.00, 1),
('Saudi Arabia', 'SA', 'SAR', '﷼', 'Saudi Riyal', 15.00, 2),
('Kuwait', 'KW', 'KWD', 'د.ك', 'Kuwaiti Dinar', 0.00, 3),
('Qatar', 'QA', 'QAR', 'ر.ق', 'Qatari Riyal', 0.00, 4),
('Bahrain', 'BH', 'BHD', '.د.ب', 'Bahraini Dinar', 10.00, 5),
('Oman', 'OM', 'OMR', 'ر.ع.', 'Omani Rial', 5.00, 6);

-- Default brand
INSERT INTO brands (name, slug, logo_url) VALUES
('Ahmed Al Maghribi', 'ahmed-al-maghribi', '/LOGO/Full-Logo.svg');

-- Categories (parent_id = 0 means top-level)
INSERT INTO categories (name, name_ar, slug, parent_id, sort_order) VALUES
('Perfumes', 'عطور', 'perfumes', 0, 1),
('Concentrated Parfum', 'عطر مركز', 'concentrated-parfum', 0, 2),
('Bakhoor & Incense', 'بخور', 'bakhoor-incense', 0, 3),
('Gift Sets & Collections', 'مجموعات هدايا', 'gift-sets-collections', 0, 4);

-- Subcategories under Perfumes (id=1)
INSERT INTO categories (name, name_ar, slug, parent_id, sort_order) VALUES
('Occidental Fragrance', 'عطر غربي', 'occidental-fragrance', 1, 1),
('Oriental Fragrance', 'عطر شرقي', 'oriental-fragrance', 1, 2),
('French Fragrance', 'عطر فرنسي', 'french-fragrance', 1, 3),
('K Series', 'سلسلة كي', 'k-series', 1, 4);

-- Subcategories under Gift Sets (id=4)
INSERT INTO categories (name, name_ar, slug, parent_id, sort_order) VALUES
('Essence of Prestige', 'جوهر الأناقة', 'essence-of-prestige', 4, 1);

-- =============================================
-- NEW PERMISSIONS
-- =============================================

INSERT INTO permissions (module, action, description) VALUES
('countries', 'read', 'View assigned countries and their data'),
('countries', 'manage', 'Add, edit, delete countries and currencies'),
('categories', 'read', 'View categories'),
('categories', 'manage', 'Add, edit, delete categories'),
('brands', 'read', 'View brands'),
('brands', 'manage', 'Add, edit, delete brands');

-- Grant admin (Saood, id=1) the new permissions
INSERT INTO user_permissions (user_id, permission_id, granted_by)
SELECT 1, id, 1 FROM permissions
WHERE CONCAT(module, '.', action) IN (
    'countries.read', 'countries.manage',
    'categories.read', 'categories.manage',
    'brands.read', 'brands.manage'
);

-- Also add to admin role preset
INSERT INTO role_permission_presets (role_id, permission_id)
SELECT 1, id FROM permissions
WHERE CONCAT(module, '.', action) IN (
    'countries.read', 'countries.manage',
    'categories.read', 'categories.manage',
    'brands.read', 'brands.manage'
);

-- Grant Rehan (id=2) country read + categories/brands read
INSERT INTO user_permissions (user_id, permission_id, granted_by)
SELECT 2, id, 1 FROM permissions
WHERE CONCAT(module, '.', action) IN (
    'countries.read', 'categories.read', 'brands.read'
);

-- Grant Sohail (id=3) country read + categories/brands read
INSERT INTO user_permissions (user_id, permission_id, granted_by)
SELECT 3, id, 1 FROM permissions
WHERE CONCAT(module, '.', action) IN (
    'countries.read', 'categories.read', 'brands.read'
);

-- =============================================
-- USER-COUNTRY ASSIGNMENTS
-- =============================================

-- Saood (admin) — all 6 countries
INSERT INTO user_countries (user_id, country_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6);

-- Rehan — all 6 countries
INSERT INTO user_countries (user_id, country_id) VALUES
(2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 6);

-- Sohail — only UAE and Saudi
INSERT INTO user_countries (user_id, country_id) VALUES
(3, 1), (3, 2);
