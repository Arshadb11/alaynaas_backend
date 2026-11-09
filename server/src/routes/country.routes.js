const router = require('express').Router();
const Joi = require('joi');
const countryController = require('../controllers/country.controller');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validate');

const countrySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(5).required(),
  currencyCode: Joi.string().min(2).max(5).required(),
  currencySymbol: Joi.string().min(1).max(10).required(),
  currencyName: Joi.string().min(2).max(50).required(),
  taxPercentage: Joi.number().min(0).max(100).optional(),
  isActive: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().optional(),
});

const assignCountriesSchema = Joi.object({
  countryIds: Joi.array().items(Joi.number().integer()).required(),
});

router.use(auth());

// User-country assignments (admin only) — must be before /:id
router.get('/user/:userId/assigned', requirePermission('users.manage_permissions'), countryController.getUserCountries);
router.put('/user/:userId/assigned', requirePermission('users.manage_permissions'), validate(assignCountriesSchema), countryController.setUserCountries);

// List countries (filtered by user access)
router.get('/', requirePermission('countries.read'), countryController.listCountries);
router.get('/:id', requirePermission('countries.read'), countryController.getCountry);

// Admin-only CRUD
router.post('/', requirePermission('countries.manage'), validate(countrySchema), countryController.createCountry);
router.put('/:id', requirePermission('countries.manage'), validate(countrySchema), countryController.updateCountry);
router.delete('/:id', requirePermission('countries.manage'), countryController.deleteCountry);

module.exports = router;
