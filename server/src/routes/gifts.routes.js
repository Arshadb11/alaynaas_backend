/**
 * Admin > Storefront > Gifts: prizes and claims from the Gift Majlis page (/gifts).
 */
const router = require('express').Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const giftsService = require('../services/gifts.service');

const updateSchema = Joi.object({
  status: Joi.string().valid(...giftsService.STATUSES).optional(),
  admin_note: Joi.string().allow('').max(2000).optional(),
}).min(1);
const prizeSchema = Joi.object({
  name_en: Joi.string().trim().min(2).max(150).required(),
  name_ar: Joi.string().trim().min(2).max(150).required(),
  weight: Joi.number().integer().min(0).max(100000).required(),
  stock: Joi.number().integer().min(0).max(1000000).allow(null, '').optional(),
  active: Joi.boolean().optional(),
  sort: Joi.number().integer().min(0).max(10000).optional(),
});

router.use(auth());

router.get('/', requirePermission('settings.read'), asyncHandler(async (req, res) => {
  res.json({ data: await giftsService.listAdmin(req.query) });
}));
router.get('/prizes', requirePermission('settings.read'), asyncHandler(async (req, res) => {
  res.json({ data: await giftsService.listPrizes() });
}));
router.post('/prizes', requirePermission('settings.update'), validate(prizeSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await giftsService.savePrize(null, req.body, req.user.id, req));
}));
router.put('/prizes/:id', requirePermission('settings.update'), validate(prizeSchema), asyncHandler(async (req, res) => {
  res.json(await giftsService.savePrize(parseInt(req.params.id, 10), req.body, req.user.id, req));
}));
router.delete('/prizes/:id', requirePermission('settings.update'), asyncHandler(async (req, res) => {
  res.json(await giftsService.removePrize(parseInt(req.params.id, 10), req.user.id, req));
}));
router.put('/:id', requirePermission('settings.update'), validate(updateSchema), asyncHandler(async (req, res) => {
  res.json(await giftsService.update(parseInt(req.params.id, 10), req.body, req.user.id, req));
}));
router.delete('/:id', requirePermission('settings.update'), asyncHandler(async (req, res) => {
  res.json(await giftsService.remove(parseInt(req.params.id, 10), req.user.id, req));
}));

module.exports = router;
