const router = require('express').Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const contactService = require('../services/contact.service');

const statusSchema = Joi.object({ status: Joi.string().valid('new', 'read', 'archived').required() });

router.use(auth());

router.get('/', requirePermission('settings.read'), asyncHandler(async (req, res) => {
  res.json({ data: await contactService.listAdmin(req.query) });
}));
router.put('/:id/status', requirePermission('settings.update'), validate(statusSchema), asyncHandler(async (req, res) => {
  res.json(await contactService.setStatus(parseInt(req.params.id, 10), req.body.status, req.user.id, req));
}));
router.delete('/:id', requirePermission('settings.update'), asyncHandler(async (req, res) => {
  res.json(await contactService.remove(parseInt(req.params.id, 10), req.user.id, req));
}));

module.exports = router;
