const router = require('express').Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const journalService = require('../services/journal.service');

const schema = Joi.object({
  slug: Joi.string().max(160).allow('').optional(),
  titleEn: Joi.string().max(200).allow('').optional(),
  titleAr: Joi.string().max(200).allow('', null).optional(),
  excerptEn: Joi.string().max(500).allow('', null).optional(),
  excerptAr: Joi.string().max(500).allow('', null).optional(),
  categoryEn: Joi.string().max(80).allow('', null).optional(),
  categoryAr: Joi.string().max(80).allow('', null).optional(),
  contentEn: Joi.string().max(100000).allow('').optional(),
  contentAr: Joi.string().max(100000).allow('', null).optional(),
  coverImage: Joi.string().max(500).allow('', null).optional(),
  isPublished: Joi.boolean().optional(),
  isFeatured: Joi.boolean().optional(),
  publishedAt: Joi.string().max(40).allow('', null).optional(),
});

router.use(auth());

router.get('/', requirePermission('settings.read'), asyncHandler(async (req, res) => {
  res.json({ data: await journalService.listAdmin() });
}));
router.get('/:id', requirePermission('settings.read'), asyncHandler(async (req, res) => {
  res.json({ data: await journalService.getAdmin(parseInt(req.params.id, 10)) });
}));
router.post('/', requirePermission('settings.update'), validate(schema), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await journalService.create(req.body, req.user.id, req) });
}));
router.put('/:id', requirePermission('settings.update'), validate(schema), asyncHandler(async (req, res) => {
  res.json({ data: await journalService.update(parseInt(req.params.id, 10), req.body, req.user.id, req) });
}));
router.delete('/:id', requirePermission('settings.update'), asyncHandler(async (req, res) => {
  res.json(await journalService.remove(parseInt(req.params.id, 10), req.user.id, req));
}));

module.exports = router;
