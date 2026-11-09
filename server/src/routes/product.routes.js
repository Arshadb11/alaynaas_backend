const router = require('express').Router();
const Joi = require('joi');
const productController = require('../controllers/product.controller');
const auth = require('../middleware/auth');
const { requirePermission, requireAnyPermission } = require('../middleware/permission');
const validate = require('../middleware/validate');

const productSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  name_ar: Joi.string().max(255).allow(null, '').optional(),
  slug: Joi.string().max(280).allow(null, '').optional(),
  brand_id: Joi.number().integer().allow(null).empty('').default(null).optional(),
  category_id: Joi.number().integer().required(),
  subcategory_id: Joi.number().integer().allow(null).empty('').default(null).optional(),
  olfactory_family_id: Joi.number().integer().allow(null).empty('').default(null).optional(),
  olfactory_family_ids: Joi.array().items(Joi.number().integer()).optional(),
  size_id: Joi.number().integer().allow(null).empty('').default(null).optional(),
  gender: Joi.string().valid('men', 'women', 'unisex').optional(),
  specifications: Joi.object().unknown().optional(),
  short_description: Joi.string().max(500).allow(null, '').optional(),
  short_description_ar: Joi.string().max(500).allow(null, '').optional(),
  description: Joi.string().allow(null, '').optional(),
  description_ar: Joi.string().allow(null, '').optional(),
  seo_title: Joi.string().max(255).allow(null, '').optional(),
  seo_description: Joi.string().max(500).allow(null, '').optional(),
  seo_keywords: Joi.string().max(500).allow(null, '').optional(),
  sku: Joi.string().max(100).allow(null, '').optional(),
  status: Joi.string().valid('draft', 'active', 'archived').optional(),
  is_featured: Joi.boolean().truthy(1).falsy(0).optional(),
  is_limited_edition: Joi.boolean().truthy(1).falsy(0).optional(),
  edition_size: Joi.number().integer().min(1).max(1000000).allow(null).optional(),
  is_bundle: Joi.boolean().truthy(1).falsy(0).optional(),
  bundle_items: Joi.array().items(
    Joi.object({
      id: Joi.number().integer().optional(),
      bundle_product_id: Joi.number().integer().optional(),
      name: Joi.string().max(255).required(),
      name_ar: Joi.string().max(255).allow(null, '').optional(),
      size: Joi.string().max(50).allow(null, '').optional(),
      quantity: Joi.number().integer().min(1).default(1).optional(),
      image_url: Joi.string().max(500).allow(null, '').optional(),
      scent_profile: Joi.string().max(255).allow(null, '').optional(),
      notes_summary: Joi.string().allow(null, '').optional(),
      notes_summary_ar: Joi.string().allow(null, '').optional(),
      description: Joi.string().allow(null, '').optional(),
      description_ar: Joi.string().allow(null, '').optional(),
      sort_order: Joi.number().integer().optional(),
    })
  ).optional(),
  price: Joi.number().min(0).optional(),
  cost_price: Joi.number().min(0).optional(),
  images: Joi.array().items(
    Joi.object({
      url: Joi.string().uri().required(),
      alt_text: Joi.string().max(255).allow(null, '').optional(),
      sort_order: Joi.number().integer().optional(),
      is_primary: Joi.boolean().truthy(1).falsy(0).optional(),
    })
  ).optional(),
  notes: Joi.array().items(
    Joi.object({
      note_id: Joi.number().integer().optional(),
      id: Joi.number().integer().optional(),
      note_level: Joi.string().valid('top', 'heart', 'base', 'general').required(),
      sort_order: Joi.number().integer().optional(),
    })
  ).optional(),
  pricing: Joi.array().items(
    Joi.object({
      country_id: Joi.number().integer().required(),
      price: Joi.number().min(0).optional(),
      cost_price: Joi.number().min(0).allow(null).optional(),
      price_10ml: Joi.number().min(0).allow(null, '').optional(),
      stock_quantity: Joi.number().integer().min(0).optional(),
      low_stock_threshold: Joi.number().integer().min(0).optional(),
      is_available: Joi.boolean().truthy(1).falsy(0).optional(),
    })
  ).optional(),
  relations: Joi.array().items(
    Joi.object({
      related_product_id: Joi.number().integer().optional(),
      id: Joi.number().integer().optional(),
      relation_type: Joi.string().valid('related', 'same_family').required(),
      sort_order: Joi.number().integer().optional(),
    })
  ).optional(),
  country_seo: Joi.array().items(
    Joi.object({
      country_id: Joi.number().integer().required(),
      seo_title: Joi.string().max(255).allow(null, '').optional(),
      seo_description: Joi.string().max(500).allow(null, '').optional(),
      seo_keywords: Joi.string().max(500).allow(null, '').optional(),
    })
  ).optional(),
  seo: Joi.array().items(
    Joi.object({
      country_id: Joi.number().integer().required(),
      seo_title: Joi.string().max(255).allow(null, '').optional(),
      seo_description: Joi.string().max(500).allow(null, '').optional(),
      seo_keywords: Joi.string().max(500).allow(null, '').optional(),
    })
  ).optional(),
});

const updatePricingSchema = Joi.object({
  pricing: Joi.array().items(
    Joi.object({
      country_id: Joi.number().integer().required(),
      price: Joi.number().min(0).optional(),
      cost_price: Joi.number().min(0).allow(null).optional(),
      price_10ml: Joi.number().min(0).allow(null, '').optional(),
      stock_quantity: Joi.number().integer().min(0).optional(),
      low_stock_threshold: Joi.number().integer().min(0).optional(),
      is_available: Joi.boolean().truthy(1).falsy(0).optional(),
    })
  ).required(),
});

const sizeSchema = Joi.object({
  name: Joi.string().min(1).max(50).required(),
  name_ar: Joi.string().max(50).allow(null, '').optional(),
  value: Joi.number().positive().optional(),
  unit: Joi.string().valid('ml', 'gm', 'pcs', 'tola').optional(),
});

const olfactoryFamilySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  name_ar: Joi.string().max(100).allow(null, '').optional(),
  description: Joi.string().max(500).allow(null, '').optional(),
});

const fragranceNoteSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  name_ar: Joi.string().max(100).allow(null, '').optional(),
  description: Joi.string().max(1000).allow(null, '').optional(),
  description_ar: Joi.string().max(1000).allow(null, '').optional(),
  image_url: Joi.string().uri().allow(null, '').optional(),
});

router.use(auth());

// Metadata & Lookup routes (must be before /:id)
router.get('/metadata', requirePermission('products.read'), productController.getMetadata);
router.post(
  '/sizes',
  requireAnyPermission(['products.read', 'products.create', 'products.update']),
  validate(sizeSchema),
  productController.createSize
);
router.post(
  '/olfactory-families',
  requireAnyPermission(['products.read', 'products.create', 'products.update']),
  validate(olfactoryFamilySchema),
  productController.createOlfactoryFamily
);
router.post(
  '/notes',
  requireAnyPermission(['products.read', 'products.create', 'products.update']),
  validate(fragranceNoteSchema),
  productController.createFragranceNote
);

// Bulk Trash routes (must be before /:id). Max 200 ids per request.
const bulkIdsSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer().positive()).min(1).max(200).unique().required(),
});
router.post('/bulk/trash', requirePermission('products.delete'), validate(bulkIdsSchema), productController.bulkTrash);
router.post('/bulk/restore', requirePermission('products.delete'), validate(bulkIdsSchema), productController.bulkRestore);
router.post('/bulk/purge', requirePermission('products.delete'), validate(bulkIdsSchema), productController.bulkPurge);

// Product CRUD routes
router.get('/', requirePermission('products.read'), productController.listProducts);
router.get('/:id', requirePermission('products.read'), productController.getProduct);
router.post('/', requirePermission('products.create'), validate(productSchema), productController.createProduct);
router.put(
  '/:id',
  requireAnyPermission(['products.update', 'products.update_content']),
  validate(productSchema),
  productController.updateProduct
);
router.put(
  '/:id/pricing',
  requirePermission('products.update'),
  validate(updatePricingSchema),
  productController.updatePricing
);
router.delete('/:id', requirePermission('products.delete'), productController.deleteProduct);

module.exports = router;
