const router = require('express').Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const reviewsService = require('../services/reviews.service');

const updateSchema = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
  name: Joi.string().max(100).optional(),
  title: Joi.string().max(150).allow('', null).optional(),
  body: Joi.string().max(3000).optional(),
  rating: Joi.number().integer().min(1).max(5).optional(),
});

router.use(auth());

router.get('/', requirePermission('products.read'), asyncHandler(async (req, res) => {
  res.json({ data: await reviewsService.listAdmin(req.query) });
}));
router.put('/:id', requirePermission('products.update'), validate(updateSchema), asyncHandler(async (req, res) => {
  res.json({ data: await reviewsService.update(parseInt(req.params.id, 10), req.body, req.user.id, req) });
}));
router.delete('/:id', requirePermission('products.update'), asyncHandler(async (req, res) => {
  res.json(await reviewsService.remove(parseInt(req.params.id, 10), req.user.id, req));
}));

module.exports = router;
