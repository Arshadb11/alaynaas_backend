const { categoryService, brandService } = require('../services/catalog.service');
const { asyncHandler } = require('../middleware/errorHandler');

// ── Categories ──────────────────────────────────────────
exports.listCategories = asyncHandler(async (req, res) => {
  const flat = req.query.flat === 'true';
  const categories = await categoryService.listCategories({ flat });
  res.json({ data: categories });
});

exports.getCategory = asyncHandler(async (req, res) => {
  const cat = await categoryService.getCategoryById(parseInt(req.params.id));
  res.json({ data: cat });
});

exports.createCategory = asyncHandler(async (req, res) => {
  const cat = await categoryService.createCategory(req.body, req.user.id, req);
  res.status(201).json({ data: cat });
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const cat = await categoryService.updateCategory(parseInt(req.params.id), req.body, req.user.id, req);
  res.json({ data: cat });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const result = await categoryService.deleteCategory(parseInt(req.params.id), req.user.id, req);
  res.json(result);
});

// ── Brands ──────────────────────────────────────────────
exports.listBrands = asyncHandler(async (req, res) => {
  const brands = await brandService.listBrands();
  res.json({ data: brands });
});

exports.getBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.getBrandById(parseInt(req.params.id));
  res.json({ data: brand });
});

exports.createBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.createBrand(req.body, req.user.id, req);
  res.status(201).json({ data: brand });
});

exports.updateBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.updateBrand(parseInt(req.params.id), req.body, req.user.id, req);
  res.json({ data: brand });
});

exports.deleteBrand = asyncHandler(async (req, res) => {
  const result = await brandService.deleteBrand(parseInt(req.params.id), req.user.id, req);
  res.json(result);
});
