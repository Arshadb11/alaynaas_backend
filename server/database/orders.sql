-- ========================================================
-- AHMED AL MAGHRIBI — ORDERS MODULE SCHEMA
-- Migration: server/database/orders.sql
-- ========================================================

USE perfume_admin;

-- 1. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(64) NOT NULL UNIQUE,
    country_id INT NOT NULL,
    customer_id INT NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_email VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,

    -- Financial Breakdown (DECIMAL 12,3 for GCC exact unit arithmetic)
    currency_code VARCHAR(5) NOT NULL,
    currency_symbol VARCHAR(10) NOT NULL,
    subtotal DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    shipping_fee DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    tax_percentage DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
    tax_amount DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    discount_amount DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    total_amount DECIMAL(12, 3) NOT NULL DEFAULT 0.000,

    -- Payment Summary (Mirrored/cached from order_payments)
    payment_status ENUM(
        'unpaid',
        'authorized',
        'paid',
        'partially_refunded',
        'refunded',
        'failed'
    ) NOT NULL DEFAULT 'unpaid',

    payment_method ENUM(
        'credit_card',
        'apple_pay',
        'tabby',
        'tamara',
        'mada',
        'knet',
        'cash_on_delivery',
        'bank_transfer',
        'pos_terminal'
    ) NOT NULL DEFAULT 'credit_card',

    total_paid DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    total_refunded DECIMAL(12, 3) NOT NULL DEFAULT 0.000,

    -- Fulfillment & Order Lifecycle State
    status ENUM(
        'pending_payment',
        'processing',
        'confirmed',
        'packed',
        'shipped',
        'delivered',
        'cancelled',
        'refunded',
        'returned',
        'on_hold',
        'failed'
    ) NOT NULL DEFAULT 'processing',

    -- Shipping & Courier Details
    shipping_carrier VARCHAR(100) NULL,
    tracking_number VARCHAR(100) NULL,
    tracking_url VARCHAR(500) NULL,
    estimated_delivery_date DATE NULL,
    dispatched_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,

    -- Structured Address Records
    shipping_address JSON NOT NULL,
    billing_address JSON NULL,

    customer_notes TEXT NULL,
    internal_notes TEXT NULL,
    is_gift BOOLEAN NOT NULL DEFAULT FALSE,
    gift_engraving_text VARCHAR(255) NULL,

    created_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_orders_country (country_id),
    INDEX idx_orders_status (status),
    INDEX idx_orders_payment_status (payment_status),
    INDEX idx_orders_created_at (created_at),
    INDEX idx_orders_customer_email (customer_email),
    INDEX idx_orders_customer_phone (customer_phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 2. ORDER PAYMENTS (1:N TRANSACTION LEDGER)
CREATE TABLE IF NOT EXISTS order_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    transaction_reference VARCHAR(100) NOT NULL,
    gateway VARCHAR(50) NOT NULL DEFAULT 'manual',
    payment_method ENUM(
        'credit_card',
        'apple_pay',
        'tabby',
        'tamara',
        'mada',
        'knet',
        'cash_on_delivery',
        'bank_transfer',
        'pos_terminal'
    ) NOT NULL,
    
    transaction_type ENUM(
        'authorization',
        'capture',
        'refund',
        'void',
        'cod_collection'
    ) NOT NULL DEFAULT 'capture',

    amount DECIMAL(12, 3) NOT NULL,
    currency_code VARCHAR(5) NOT NULL,
    
    status ENUM('pending', 'successful', 'failed', 'refunded') NOT NULL DEFAULT 'successful',
    
    card_brand VARCHAR(30) NULL,
    card_last4 VARCHAR(4) NULL,
    gateway_response JSON NULL,
    notes VARCHAR(255) NULL,

    recorded_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_order_payments_order (order_id),
    INDEX idx_order_payments_ref (transaction_reference),
    INDEX idx_order_payments_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_name_ar VARCHAR(255) NULL,
    sku VARCHAR(100) NOT NULL,
    size_name VARCHAR(50) NULL,
    image_url VARCHAR(500) NULL,
    unit_price DECIMAL(12, 3) NOT NULL,
    cost_price DECIMAL(12, 3) NULL,
    quantity INT NOT NULL DEFAULT 1,
    line_total DECIMAL(12, 3) NOT NULL,
    
    -- Bundle / Gift Set Handling (Snapshots child discovery items)
    is_bundle BOOLEAN NOT NULL DEFAULT FALSE,
    bundle_items_snapshot JSON NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_order_items_order (order_id),
    INDEX idx_order_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 4. ORDER STATUS HISTORY (AUDIT & TIMELINE)
CREATE TABLE IF NOT EXISTS order_status_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    old_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NOT NULL,
    changed_by_user_id INT NULL,
    notes VARCHAR(500) NULL,
    notified_customer BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_osh_order (order_id),
    INDEX idx_osh_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 5. ORDER INTERNAL NOTES (COLLABORATION)
CREATE TABLE IF NOT EXISTS order_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    author_id INT NOT NULL,
    note TEXT NOT NULL,
    is_customer_visible BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_order_notes_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
