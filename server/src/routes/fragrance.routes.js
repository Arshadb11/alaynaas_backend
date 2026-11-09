const router = require('express').Router();
const Joi = require('joi');
const fragranceController = require('../controllers/fragrance.controller');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validate');

const olfactoryFamilySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  name_ar: Joi.string().max(100).allow(null, '').optional(),
  nameAr: Joi.string().max(100).allow(null, '').optional(),
  slug: Joi.string().max(120).allow(null, '').optional(),
  description: Joi.string().max(1000).allow(null, '').optional(),
  icon_url: Joi.string().max(500).allow(null, '').optional(),
  iconUrl: Joi.string().max(500).allow(null, '').optional(),
  is_active: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
});

const fragranceNoteSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  name_ar: Joi.string().max(100).allow(null, '').optional(),
  nameAr: Joi.string().max(100).allow(null, '').optional(),
  slug: Joi.string().max(120).allow(null, '').optional(),
  description: Joi.string().max(2000).allow(null, '').optional(),
  description_ar: Joi.string().max(2000).allow(null, '').optional(),
  descriptionAr: Joi.string().max(2000).allow(null, '').optional(),
  image_url: Joi.string().max(500).allow(null, '').optional(),
  imageUrl: Joi.string().max(500).allow(null, '').optional(),
});

router.use(auth());
// Fragrance Library & Profiles CRUD ops bound to products.read for full CRUD access
router.use(requirePermission('products.read'));

// ── Olfactory Families Routes ───────────────────────────
router.get('/olfactory-families', fragranceController.listOlfactoryFamilies);
router.get('/olfactory-families/:id', fragranceController.getOlfactoryFamily);
router.post(
  '/olfactory-families',
  validate(olfactoryFamilySchema),
  fragranceController.createOlfactoryFamily
);
router.put(
  '/olfactory-families/:id',
  validate(olfactoryFamilySchema),
  fragranceController.updateOlfactoryFamily
);
router.delete('/olfactory-families/:id', fragranceController.deleteOlfactoryFamily);

// ── Fragrance Notes Routes ──────────────────────────────
router.get('/notes', fragranceController.listFragranceNotes);
router.get('/notes/:id', fragranceController.getFragranceNote);
router.post(
  '/notes',
  validate(fragranceNoteSchema),
  fragranceController.createFragranceNote
);
router.put(
  '/notes/:id',
  validate(fragranceNoteSchema),
  fragranceController.updateFragranceNote
);
router.delete('/notes/:id', fragranceController.deleteFragranceNote);

module.exports = router;
