const router = require('express').Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const pagesService = require('../services/pages.service');

const pageSchema = Joi.object({
  slug: Joi.string().max(120).allow('').optional(),
  titleEn: Joi.string().max(200).allow('').optional(),
  titleAr: Joi.string().max(200).allow('', null).optional(),
  summaryEn: Joi.string().max(500).allow('', null).optional(),
  summaryAr: Joi.string().max(500).allow('', null).optional(),
  metaTitle: Joi.string().max(200).allow('', null).optional(),
  metaKeywords: Joi.string().max(300).allow('', null).optional(),
  contentEn: Joi.string().max(100000).allow('').optional(),
  contentAr: Joi.string().max(100000).allow('', null).optional(),
  isPublished: Joi.boolean().optional(),
  showInFooter: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().min(0).max(9999).optional(),
});

router.use(auth());

router.get('/', requirePermission('settings.read'), asyncHandler(async (req, res) => {
  res.json({ data: await pagesService.listAdmin() });
}));
router.get('/:id', requirePermission('settings.read'), asyncHandler(async (req, res) => {
  res.json({ data: await pagesService.getAdmin(parseInt(req.params.id, 10)) });
}));
router.post('/', requirePermission('settings.update'), validate(pageSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await pagesService.create(req.body, req.user.id, req) });
}));
router.put('/:id', requirePermission('settings.update'), validate(pageSchema), asyncHandler(async (req, res) => {
  res.json({ data: await pagesService.update(parseInt(req.params.id, 10), req.body, req.user.id, req) });
}));
router.delete('/:id', requirePermission('settings.update'), asyncHandler(async (req, res) => {
  res.json(await pagesService.remove(parseInt(req.params.id, 10), req.user.id, req));
}));

module.exports = router;
