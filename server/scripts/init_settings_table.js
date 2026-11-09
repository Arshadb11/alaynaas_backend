const db = require('../src/config/db');

async function setup() {
  console.log('Creating system_settings table...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      \`group\` VARCHAR(50) NOT NULL DEFAULT 'general',
      \`key\` VARCHAR(100) NOT NULL UNIQUE,
      \`value\` LONGTEXT NULL,
      \`type\` ENUM('string', 'number', 'boolean', 'json', 'image') NOT NULL DEFAULT 'string',
      \`is_public\` TINYINT(1) NOT NULL DEFAULT 0,
      \`description\` VARCHAR(255) NULL,
      \`updated_by_user_id\` INT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_group (\`group\`),
      INDEX idx_public (\`is_public\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const initialSettings = [
    // General
    { group: 'general', key: 'store_name', value: 'ALAYNAAS', type: 'string', is_public: 1, description: 'Storefront Brand Name' },
    { group: 'general', key: 'store_tagline', value: 'For those who carry the crown', type: 'string', is_public: 1, description: 'Store Tagline / Slogan' },
    { group: 'general', key: 'support_email', value: 'concierge@alaynaas.ae', type: 'string', is_public: 1, description: 'Customer Support Email' },
    { group: 'general', key: 'support_phone', value: '+971 50 123 4567', type: 'string', is_public: 1, description: 'Customer Support Phone' },
    { group: 'general', key: 'whatsapp_number', value: '+971501234567', type: 'string', is_public: 1, description: 'WhatsApp Business Number' },
    { group: 'general', key: 'store_address', value: 'Al Wasl Road, Jumeirah 2, Dubai, United Arab Emirates', type: 'string', is_public: 1, description: 'Showroom & Headquarters Address' },
    { group: 'general', key: 'default_currency', value: 'AED', type: 'string', is_public: 1, description: 'Default Settlement Currency' },
    { group: 'general', key: 'timezone', value: 'Asia/Dubai', type: 'string', is_public: 1, description: 'Store Operational Timezone' },
    { group: 'general', key: 'tax_trn', value: '100234567800003', type: 'string', is_public: 1, description: 'Federal Tax Authority TRN' },

    // Branding
    { group: 'branding', key: 'frontend_logo', value: '/LOGO/Desktop.svg', type: 'image', is_public: 1, description: 'Storefront Primary Logo' },
    { group: 'branding', key: 'frontend_logo_dark', value: '/LOGO/Desktop.svg', type: 'image', is_public: 1, description: 'Storefront Dark/Inverted Logo' },
    { group: 'branding', key: 'admin_logo', value: '/LOGO/Desktop.svg', type: 'image', is_public: 1, description: 'Admin Panel Desktop Logo' },
    { group: 'branding', key: 'favicon', value: '/favicon.ico', type: 'image', is_public: 1, description: 'Browser Favicon' },
    { group: 'branding', key: 'primary_brand_color', value: '#D4AF37', type: 'string', is_public: 1, description: 'Primary Gold Accent Color' },

    // Shipping
    { group: 'shipping', key: 'shipping_fee', value: '20', type: 'number', is_public: 1, description: 'Standard UAE Courier Delivery Fee' },
    { group: 'shipping', key: 'shipping_free_over', value: '300', type: 'number', is_public: 1, description: 'Free Delivery Minimum Cart Value' },
    { group: 'shipping', key: 'shipping_estimate_text', value: 'Delivered across the UAE in 1–3 working days', type: 'string', is_public: 1, description: 'Customer Delivery SLA' },
    { group: 'shipping', key: 'enable_express_delivery', value: '1', type: 'boolean', is_public: 1, description: 'Offer Same-Day / Express Delivery in Dubai' },
    { group: 'shipping', key: 'express_delivery_fee', value: '45', type: 'number', is_public: 1, description: 'Express Delivery Surcharge' },
    { group: 'shipping', key: 'cod_charge', value: '0', type: 'number', is_public: 1, description: 'Cash On Delivery Collection Fee' },

    // Tax
    { group: 'tax', key: 'tax_percentage', value: '5.00', type: 'number', is_public: 1, description: 'Standard VAT Percentage' },
    { group: 'tax', key: 'tax_inclusive_pricing', value: '1', type: 'boolean', is_public: 1, description: 'Display Prices Inclusive of VAT' },
    { group: 'tax', key: 'tax_label', value: 'UAE VAT (5%)', type: 'string', is_public: 1, description: 'Tax Name on Invoices' },

    // Invoices
    { group: 'invoices', key: 'invoice_prefix', value: 'AM-INV-', type: 'string', is_public: 0, description: 'Sequential Invoice Number Prefix' },
    { group: 'invoices', key: 'invoice_legal_company', value: 'Alaynaas Luxury Perfumes LLC', type: 'string', is_public: 0, description: 'Legal Entity on Tax Invoices' },
    { group: 'invoices', key: 'invoice_terms', value: 'Thank you for choosing ALAYNAAS. Unopened items may be returned within 7 days in original packaging with proof of purchase.', type: 'string', is_public: 0, description: 'Invoice Terms & Return Policy' },
    { group: 'invoices', key: 'invoice_show_logo', value: '1', type: 'boolean', is_public: 0, description: 'Include Brand Logo on Generated PDF / Invoices' },

    // Email
    { group: 'email', key: 'smtp_host', value: 'smtp.mailgun.org', type: 'string', is_public: 0, description: 'SMTP Server Host' },
    { group: 'email', key: 'smtp_port', value: '587', type: 'number', is_public: 0, description: 'SMTP Server Port' },
    { group: 'email', key: 'smtp_secure', value: '0', type: 'boolean', is_public: 0, description: 'Use TLS / SSL for Email Transport' },
    { group: 'email', key: 'smtp_user', value: 'postmaster@alaynaas.ae', type: 'string', is_public: 0, description: 'SMTP Username / API User' },
    { group: 'email', key: 'smtp_password', value: '••••••••', type: 'string', is_public: 0, description: 'SMTP Password / Key' },
    { group: 'email', key: 'smtp_from_email', value: 'concierge@alaynaas.ae', type: 'string', is_public: 0, description: 'Outgoing From Email Address' },
    { group: 'email', key: 'smtp_from_name', value: 'ALAYNAAS Concierge', type: 'string', is_public: 0, description: 'Outgoing From Name' },
    { group: 'email', key: 'email_order_confirmed_template', value: 'Dear {customer_name},\n\nThank you for choosing ALAYNAAS. Your royal order #{order_number} is confirmed.\n\nOur concierge team is preparing your selection.\nTotal: {total_amount} {currency}\nDelivery Address: {delivery_address}\n\nWarm regards,\nALAYNAAS Concierge', type: 'string', is_public: 0, description: 'Order Confirmation Email Body' },
    { group: 'email', key: 'email_order_shipped_template', value: 'Dear {customer_name},\n\nYour bespoke ALAYNAAS order #{order_number} has been dispatched.\n\nCarrier: {carrier}\nTracking: {tracking_number}\n\nWarm regards,\nALAYNAAS Concierge', type: 'string', is_public: 0, description: 'Order Shipped / Tracking Email Body' },

    // System & Optimization
    { group: 'system', key: 'maintenance_mode', value: '0', type: 'boolean', is_public: 1, description: 'Put Storefront into Maintenance Mode' },
    { group: 'system', key: 'maintenance_message', value: 'ALAYNAAS online boutique is currently undergoing scheduled enhancements. We look forward to welcoming you back shortly.', type: 'string', is_public: 1, description: 'Public Maintenance Screen Message' },
    { group: 'system', key: 'cache_driver', value: 'redis', type: 'string', is_public: 0, description: 'Active System Cache Driver' },
    { group: 'system', key: 'enable_ssr_isr', value: '1', type: 'boolean', is_public: 0, description: 'Enable Next.js Incremental Static Regeneration' },
  ];

  for (const s of initialSettings) {
    await db.query(`
      INSERT INTO system_settings (\`group\`, \`key\`, \`value\`, \`type\`, \`is_public\`, \`description\`)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`group\` = VALUES(\`group\`),
        \`type\` = VALUES(\`type\`),
        \`is_public\` = VALUES(\`is_public\`),
        \`description\` = VALUES(\`description\`)
    `, [s.group, s.key, s.value, s.type, s.is_public, s.description]);
  }

  console.log('✅ system_settings table initialized and seeded with', initialSettings.length, 'records.');
  process.exit(0);
}

setup().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
