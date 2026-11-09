const productService = require('../services/product.service');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listProducts = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(req.query, req.user);
  res.json(result);
});

exports.getProduct = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(parseInt(req.params.id), req.user);
  res.json({ data: product });
});

exports.createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body, req.user.id, req);
  res.status(201).json({ data: product });
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(parseInt(req.params.id), req.body, req.user, req);
  res.json({ data: product });
});

exports.updatePricing = asyncHandler(async (req, res) => {
  await productService.updateCountryPricing(parseInt(req.params.id), req.body.pricing, req.user, req);
  res.json({ success: true, message: 'Country pricing updated successfully' });
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const result = await productService.deleteProduct(parseInt(req.params.id), req.user.id, req);
  res.json(result);
});

// ---- Bulk Trash operations (ids validated by Joi in the routes) ----
exports.bulkTrash = asyncHandler(async (req, res) => {
  const result = await productService.trashProducts(req.body.ids, req.user, req);
  res.json({ success: true, data: result });
});

exports.bulkRestore = asyncHandler(async (req, res) => {
  const result = await productService.restoreProducts(req.body.ids, req.user, req);
  res.json({ success: true, data: result });
});

exports.bulkPurge = asyncHandler(async (req, res) => {
  const result = await productService.purgeProducts(req.body.ids, req.user, req);
  res.json({ success: true, data: result });
});

exports.getMetadata = asyncHandler(async (req, res) => {
  const metadata = await productService.getMetadata(req.user);
  res.json({ data: metadata });
});

exports.createSize = asyncHandler(async (req, res) => {
  const size = await productService.findOrCreateSize(req.body, req.user);
  res.status(201).json({ success: true, data: size });
});

exports.createOlfactoryFamily = asyncHandler(async (req, res) => {
  const family = await productService.findOrCreateOlfactoryFamily(req.body, req.user);
  res.status(201).json({ success: true, data: family });
});

exports.createFragranceNote = asyncHandler(async (req, res) => {
  const note = await productService.findOrCreateFragranceNote(req.body, req.user);
  res.status(201).json({ success: true, data: note });
});

