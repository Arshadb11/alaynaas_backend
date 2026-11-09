const router = require('express').Router();
const Joi = require('joi');
const catalogController = require('../controllers/catalog.controller');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validate');
const menuController = require('../controllers/menu.controller');

const safeUrl = Joi.string().max(500).pattern(/^(\/(?!\/)|https?:\/\/)/i).allow(null, '');
const menuItemSchema = Joi.object({
  menuKey: Joi.string().valid('main').optional(),
  parentId: Joi.number().integer().min(0).optional(),
  label: Joi.string().trim().min(1).max(100).required(),
  labelAr: Joi.string().trim().max(100).allow(null, '').optional(),
  linkType: Joi.string().valid('category', 'custom', 'none').required(),
  categoryId: Joi.number().integer().positive().allow(null).optional(),
  url: safeUrl.optional(),
  openNewTab: Joi.boolean().optional(),
  isMega: Joi.boolean().optional(),
  imageUrl: safeUrl.optional(),
  badge: Joi.string().trim().max(30).allow(null, '').optional(),
  isActive: Joi.boolean().optional(),
});
const menuReorderSchema = Joi.object({
  parentId: Joi.number().integer().min(0).required(),
  ids: Joi.array().items(Joi.number().integer().positive()).max(200).required(),
});

const categorySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  nameAr: Joi.string().max(100).allow(null, '').optional(),
  slug: Joi.string().min(1).max(120).required(),
  description: Joi.string().max(1000).allow(null, '').optional(),
  parentId: Joi.number().integer().min(0).optional(),
  sortOrder: Joi.number().integer().optional(),
  isActive: Joi.boolean().truthy(1, '1', 'true', true).falsy(0, '0', 'false', false).optional(),
});

const brandSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  slug: Joi.string().min(1).max(120).required(),
  logoUrl: Joi.string().max(500).allow(null, '').optional(),
  isActive: Joi.boolean().truthy(1, '1', 'true', true).falsy(0, '0', 'false', false).optional(),
});

router.use(auth());

// ── Categories ──────────────────────────────────────────
router.get('/categories', requirePermission('categories.read'), catalogController.listCategories);
router.get('/categories/:id', requirePermission('categories.read'), catalogController.getCategory);
router.post('/categories', requirePermission('categories.manage'), validate(categorySchema), catalogController.createCategory);
router.put('/categories/:id', requirePermission('categories.manage'), validate(categorySchema), catalogController.updateCategory);
router.delete('/categories/:id', requirePermission('categories.manage'), catalogController.deleteCategory);

// ── Brands ──────────────────────────────────────────────
router.get('/brands', requirePermission('brands.read'), catalogController.listBrands);
router.get('/brands/:id', requirePermission('brands.read'), catalogController.getBrand);
router.post('/brands', requirePermission('brands.manage'), validate(brandSchema), catalogController.createBrand);
router.put('/brands/:id', requirePermission('brands.manage'), validate(brandSchema), catalogController.updateBrand);
router.delete('/brands/:id', requirePermission('brands.manage'), catalogController.deleteBrand);

// Navigation menu (storefront header / mega menu)
router.get('/menu', requirePermission('categories.read'), menuController.list);
router.post('/menu', requirePermission('categories.manage'), validate(menuItemSchema), menuController.create);
router.post('/menu/reorder', requirePermission('categories.manage'), validate(menuReorderSchema), menuController.reorder);
router.put('/menu/:id', requirePermission('categories.manage'), validate(menuItemSchema), menuController.update);
router.delete('/menu/:id', requirePermission('categories.manage'), menuController.remove);

module.exports = router;
