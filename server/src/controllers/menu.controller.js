const menuService = require('../services/menu.service');
const { asyncHandler } = require('../middleware/errorHandler');

exports.list = asyncHandler(async (req, res) => {
  res.json({ data: await menuService.listAdmin('main') });
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json({ data: await menuService.create(req.body, req.user.id, req) });
});

exports.update = asyncHandler(async (req, res) => {
  res.json({ data: await menuService.update(parseInt(req.params.id, 10), req.body, req.user.id, req) });
});

exports.remove = asyncHandler(async (req, res) => {
  res.json(await menuService.remove(parseInt(req.params.id, 10), req.user.id, req));
});

exports.reorder = asyncHandler(async (req, res) => {
  res.json(await menuService.reorder(req.body.parentId, req.body.ids, req.user.id, req));
});

/** Public storefront endpoint */
exports.publicMenu = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await menuService.getPublicMenu('main') });
});
