/**
 * PERMISSION REGISTRY — Single Source of Truth
 * Both server (middleware) and client (hooks/components) read from this.
 * 
 * Structure per permission:
 *   description: Human-readable label
 *   fields.visible: Fields the user can SEE in API responses
 *   fields.editable: Fields the user can EDIT (submit in request body)
 *   ui.nav: Sidebar navigation item key
 *   ui.sections: UI sections to show/hide
 *   ui.buttons: Buttons to show/hide
 */

const PERMISSION_REGISTRY = {

  // ─── PRODUCTS MODULE ──────────────────────────────────
  'products.read': {
    description: 'View product catalog, specifications, and full fragrance library & profiles CRUD',
    fields: {
      visible: [
        'id', 'name', 'name_ar', 'slug', 'brand_id', 'category_id', 'subcategory_id',
        'olfactory_families', 'size_id', 'gender', 'specifications',
        'short_description', 'short_description_ar', 'description', 'description_ar',
        'country_seo', 'seo',
        'sku',
        'images', 'notes', 'pricing', 'relations', 'status', 'is_featured', 'created_at', 'updated_at',
      ],
    },
    ui: { nav: 'products', sections: ['product-list', 'product-detail', 'fragrance-library'] },
  },

  'products.create': {
    description: 'Add new products',
    fields: {
      editable: [
        'name', 'name_ar', 'slug', 'brand_id', 'category_id', 'subcategory_id',
        'olfactory_family_ids', 'size_id', 'gender', 'specifications',
        'short_description', 'short_description_ar', 'description', 'description_ar',
        'sku',
        'images', 'notes', 'status', 'is_featured', 'pricing', 'country_seo', 'seo',
      ],
    },
    ui: { buttons: ['create-product'], sections: ['product-create-form'] },
  },

  'products.update': {
    description: 'Full product update (pricing, warehouse stock, status, availability, and content)',
    fields: {
      visible: ['price', 'cost_price', 'pricing'],
      editable: [
        'name', 'name_ar', 'slug', 'brand_id', 'category_id', 'subcategory_id',
        'olfactory_family_ids', 'size_id', 'gender', 'specifications',
        'short_description', 'short_description_ar', 'description', 'description_ar',
        'country_seo', 'seo',
        'sku',
        'images', 'notes', 'relations', 'status', 'is_featured', 'pricing', 'price', 'cost_price',
      ],
    },
    ui: { sections: ['content-editor', 'spec-editor', 'note-editor', 'seo-editor', 'image-manager', 'pricing-panel'], buttons: ['save-content', 'save-pricing'] },
  },

  'products.update_content': {
    description: 'Edit product copywriting, descriptions, specifications, notes, media, and SEO (no pricing/stock/status)',
    fields: {
      editable: [
        'name', 'name_ar', 'slug', 'brand_id', 'category_id', 'subcategory_id',
        'olfactory_family_ids', 'size_id', 'gender', 'specifications',
        'short_description', 'short_description_ar', 'description', 'description_ar',
        'country_seo', 'seo',
        'sku',
        'images', 'notes', 'relations',
      ],
    },
    ui: { sections: ['content-editor', 'spec-editor', 'note-editor', 'seo-editor', 'image-manager'], buttons: ['save-content'] },
  },

  'products.delete': {
    description: 'Remove or archive products',
    ui: { buttons: ['delete-product'] },
  },

  // ─── ORDERS MODULE ────────────────────────────────────
  'orders.read': {
    description: 'View order list and details',
    fields: {
      visible: [
        'id', 'order_number', 'customer_name', 'customer_email',
        'items', 'subtotal', 'total', 'status', 'payment_status',
        'shipping_address', 'tracking_number', 'notes', 'created_at', 'updated_at',
      ],
    },
    ui: { nav: 'orders', sections: ['order-list', 'order-detail'] },
  },

  'orders.create': {
    description: 'Create manual orders',
    ui: { buttons: ['create-order'], sections: ['order-create-form'] },
  },

  'orders.update': {
    description: 'Update order status and notes',
    fields: {
      editable: ['status', 'payment_status', 'tracking_number', 'notes'],
    },
    ui: { sections: ['order-status-editor'], buttons: ['update-order'] },
  },

  'orders.delete': {
    description: 'Cancel or delete orders',
    ui: { buttons: ['delete-order', 'cancel-order'] },
  },

  // ─── USERS MODULE ─────────────────────────────────────
  'users.read': {
    description: 'View user list and details',
    ui: { nav: 'users', sections: ['user-list', 'user-detail'] },
  },

  'users.create': {
    description: 'Create new users',
    ui: { buttons: ['create-user'], sections: ['user-create-form'] },
  },

  'users.update': {
    description: 'Edit user profiles',
    ui: { buttons: ['edit-user'], sections: ['user-edit-form'] },
  },

  'users.delete': {
    description: 'Deactivate or delete users',
    ui: { buttons: ['delete-user', 'toggle-user-active'] },
  },

  'users.manage_permissions': {
    description: 'Assign or revoke user permissions',
    ui: {
      nav: 'permissions',
      sections: ['permission-editor', 'preset-manager'],
      buttons: ['save-permissions', 'apply-preset'],
    },
  },

  // ─── REPORTS MODULE ───────────────────────────────────
  'reports.read': {
    description: 'View reports and analytics',
    ui: { nav: 'reports', sections: ['sales-report', 'product-report'] },
  },

  // ─── SETTINGS MODULE ─────────────────────────────────
  'settings.read': {
    description: 'View store settings',
    ui: { nav: 'settings', sections: ['settings-view'] },
  },

  'settings.update': {
    description: 'Modify store settings',
    ui: { sections: ['settings-editor'], buttons: ['save-settings'] },
  },

  // ─── AUDIT MODULE ────────────────────────────────────
  'audit.read': {
    description: 'View activity logs',
    ui: { nav: 'audit-logs', sections: ['log-viewer', 'request-log-viewer'] },
  },

  // ─── COUNTRIES MODULE ──────────────────────────────────
  'countries.read': {
    description: 'View assigned countries and their data',
    ui: { nav: 'countries', sections: ['country-list'] },
  },

  'countries.manage': {
    description: 'Add, edit, delete countries and currencies',
    ui: { buttons: ['create-country', 'edit-country', 'delete-country'] },
  },

  // ─── CATEGORIES MODULE ────────────────────────────────
  'categories.read': {
    description: 'View categories and subcategories',
    ui: { sections: ['category-list'] },
  },

  'categories.manage': {
    description: 'Add, edit, delete categories',
    ui: { buttons: ['create-category', 'edit-category', 'delete-category'] },
  },

  // ─── BRANDS MODULE ────────────────────────────────────
  'brands.read': {
    description: 'View brands',
    ui: { sections: ['brand-list'] },
  },

  'brands.manage': {
    description: 'Add, edit, delete brands',
    ui: { buttons: ['create-brand', 'edit-brand', 'delete-brand'] },
  },

  // ─── FILES & MEDIA MODULE ─────────────────────────────
  'files.read': {
    description: 'Browse local folders and preview files',
    ui: { nav: 'file-manager', sections: ['file-explorer', 'file-preview'] },
  },

  'files.create': {
    description: 'Upload files and create new folders',
    ui: { buttons: ['upload-files', 'create-folder'] },
  },

  'files.update': {
    description: 'Rename files and folders',
    ui: { buttons: ['rename-file', 'rename-folder'] },
  },

  'files.delete': {
    description: 'Delete files and folders from disk',
    ui: { buttons: ['delete-file', 'delete-folder'] },
  },
};

/**
 * Get all permission keys
 */
function getAllPermissionKeys() {
  return Object.keys(PERMISSION_REGISTRY);
}

/**
 * Get permissions grouped by module
 */
function getPermissionsByModule() {
  const grouped = {};
  for (const [key, value] of Object.entries(PERMISSION_REGISTRY)) {
    const [module] = key.split('.');
    if (!grouped[module]) grouped[module] = [];
    grouped[module].push({ key, ...value });
  }
  return grouped;
}

/**
 * Collect all visible fields for a set of permissions within a module
 */
function getVisibleFields(permissions, module) {
  const fields = new Set();
  for (const perm of permissions) {
    if (!perm.startsWith(module + '.')) continue;
    const entry = PERMISSION_REGISTRY[perm];
    if (entry?.fields?.visible) {
      entry.fields.visible.forEach((f) => fields.add(f));
    }
    // editable implies visible
    if (entry?.fields?.editable) {
      entry.fields.editable.forEach((f) => fields.add(f));
    }
  }
  return fields;
}

/**
 * Collect all editable fields for a set of permissions within a module
 */
function getEditableFields(permissions, module) {
  const fields = new Set();
  for (const perm of permissions) {
    if (!perm.startsWith(module + '.')) continue;
    const entry = PERMISSION_REGISTRY[perm];
    if (entry?.fields?.editable) {
      entry.fields.editable.forEach((f) => fields.add(f));
    }
  }
  return fields;
}

module.exports = {
  PERMISSION_REGISTRY,
  getAllPermissionKeys,
  getPermissionsByModule,
  getVisibleFields,
  getEditableFields,
};