-- =============================================
-- SEED DATA — Run after schema.sql
-- =============================================

USE perfume_admin;

-- Default roles
INSERT INTO roles (name, description, is_system) VALUES
('admin', 'Full system access — all permissions', TRUE),
('manager', 'Product & order management', FALSE),
('staff', 'Limited operational access', FALSE);

-- All permissions
INSERT INTO permissions (module, action, description) VALUES
('users', 'create', 'Create new users'),
('users', 'read', 'View user list and details'),
('users', 'update', 'Edit user profiles'),
('users', 'delete', 'Deactivate or delete users'),
('users', 'manage_permissions', 'Assign or revoke user permissions'),
('products', 'create', 'Add new products'),
('products', 'read', 'View product catalog'),
('products', 'update', 'Full product update (pricing, warehouse stock, status, availability, and content)'),
('products', 'update_content', 'Edit product name, description, specs, notes, media, and SEO'),
('products', 'delete', 'Remove products'),
('orders', 'create', 'Create manual orders'),
('orders', 'read', 'View orders'),
('orders', 'update', 'Update order status and notes'),
('orders', 'delete', 'Cancel or delete orders'),
('reports', 'read', 'View reports and analytics'),
('settings', 'read', 'View store settings'),
('settings', 'update', 'Modify store settings'),
('audit', 'read', 'View activity logs');

-- Admin preset gets ALL permissions
INSERT INTO role_permission_presets (role_id, permission_id)
SELECT 1, id FROM permissions;

-- Manager preset
INSERT INTO role_permission_presets (role_id, permission_id)
SELECT 2, id FROM permissions
WHERE CONCAT(module, '.', action) IN (
    'products.create', 'products.read', 'products.update', 'products.delete',
    'orders.create', 'orders.read', 'orders.update',
    'reports.read'
);

-- Staff preset
INSERT INTO role_permission_presets (role_id, permission_id)
SELECT 3, id FROM permissions
WHERE CONCAT(module, '.', action) IN (
    'products.read', 'orders.read', 'orders.create', 'orders.update'
);

INSERT INTO users (full_name, email, password_hash, role_id) VALUES
('Saood', 'saood@admin.com', '$2b$12$kaw1OXFqir.7oWFg82i94uIyEuRforiieKUvRLd8Q3l9UACwQtOwu', 1);

INSERT INTO user_permissions (user_id, permission_id, granted_by)
SELECT 1, id, 1 FROM permissions;

INSERT INTO users (full_name, email, password_hash, role_id) VALUES
('Rehan', 'rehan@admin.com', '$2b$12$kaw1OXFqir.7oWFg82i94uIyEuRforiieKUvRLd8Q3l9UACwQtOwu', 2);

INSERT INTO user_permissions (user_id, permission_id, granted_by)
SELECT 2, id, 1 FROM permissions
WHERE CONCAT(module, '.', action) IN (
    'orders.create', 'orders.read', 'orders.update', 'orders.delete',
    'products.create', 'products.read', 'products.update', 'products.delete'
);

INSERT INTO users (full_name, email, password_hash, role_id) VALUES
('Sohail', 'sohail@admin.com', '$2b$12$kaw1OXFqir.7oWFg82i94uIyEuRforiieKUvRLd8Q3l9UACwQtOwu', 3);

INSERT INTO user_permissions (user_id, permission_id, granted_by)
SELECT 3, id, 1 FROM permissions
WHERE CONCAT(module, '.', action) IN (
    'products.read', 'products.update_content'
);
