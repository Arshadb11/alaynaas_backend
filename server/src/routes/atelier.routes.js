/**
 * Admin > Storefront > Atelier: leads from the "compose your perfume" page.
 */
const router = require('express').Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const atelierService = require('../services/atelier.service');

const updateSchema = Joi.object({
  status: Joi.string().valid(...atelierService.STATUSES).optional(),
  admin_note: Joi.string().allow('').max(2000).optional(),
}).min(1);

router.use(auth());

router.get('/', requirePermission('settings.read'), asyncHandler(async (req, res) => {
  res.json({ data: await atelierService.listAdmin(req.query) });
}));
router.put('/:id', requirePermission('settings.update'), validate(updateSchema), asyncHandler(async (req, res) => {
  res.json(await atelierService.update(parseInt(req.params.id, 10), req.body, req.user.id, req));
}));
router.delete('/:id', requirePermission('settings.update'), asyncHandler(async (req, res) => {
  res.json(await atelierService.remove(parseInt(req.params.id, 10), req.user.id, req));
}));

module.exports = router;
