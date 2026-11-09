-- =============================================
-- PERFUME ADMIN PANEL - COMPLETE SCHEMA (v4)
-- =============================================

CREATE DATABASE IF NOT EXISTS perfume_admin;
USE perfume_admin;

-- 1. Roles (labels/presets)
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Permissions catalog
CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_perm (module, action)
) ENGINE=InnoDB;

-- 3. Role presets (template for quick assignment)
CREATE TABLE IF NOT EXISTS role_permission_presets (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    avatar_url VARCHAR(500) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- 5. User permissions (SOURCE OF TRUTH)
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id INT NOT NULL,
    permission_id INT NOT NULL,
    granted_by INT,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, permission_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 6. User sessions (multi-device tracking)
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(50) PRIMARY KEY,
    user_id INT NOT NULL,
    refresh_token VARCHAR(500) NOT NULL UNIQUE,
    access_token_jti VARCHAR(100),
    device_type VARCHAR(50),
    browser VARCHAR(100),
    os VARCHAR(100),
    ip_address VARCHAR(45),
    location VARCHAR(255),
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_token (refresh_token),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- 7. Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source ENUM('admin_panel','storefront','system','cron') NOT NULL DEFAULT 'admin_panel',
    user_id INT,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    category ENUM('auth','user_mgmt','product','order','permission','settings','system') NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(50),
    target_label VARCHAR(255),
    status ENUM('success','failure','denied') NOT NULL DEFAULT 'success',
    severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
    details JSON,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    session_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_source (source),
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_category (category),
    INDEX idx_target (target_type, target_id),
    INDEX idx_created (created_at),
    INDEX idx_severity (severity)
) ENGINE=InnoDB;

-- 8. Field change logs
CREATE TABLE IF NOT EXISTS field_change_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    audit_log_id BIGINT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id) ON DELETE CASCADE,
    INDEX idx_audit (audit_log_id)
) ENGINE=InnoDB;

-- 9. API request logs
CREATE TABLE IF NOT EXISTS api_request_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source ENUM('admin_panel','storefront','external') NOT NULL DEFAULT 'admin_panel',
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    status_code INT NOT NULL,
    user_id INT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    request_body JSON,
    response_time_ms INT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_source (source),
    INDEX idx_path (path(100)),
    INDEX idx_status (status_code),
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;
