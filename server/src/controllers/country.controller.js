const countryService = require('../services/country.service');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listCountries = asyncHandler(async (req, res) => {
  const hasManage = req.user.permissions.includes('countries.manage');
  const countries = await countryService.listCountries(req.user.id, hasManage);
  res.json({ data: countries });
});

exports.getCountry = asyncHandler(async (req, res) => {
  const country = await countryService.getCountryById(parseInt(req.params.id));
  res.json({ data: country });
});

exports.createCountry = asyncHandler(async (req, res) => {
  const country = await countryService.createCountry(req.body, req.user.id, req);
  res.status(201).json({ data: country });
});

exports.updateCountry = asyncHandler(async (req, res) => {
  const country = await countryService.updateCountry(parseInt(req.params.id), req.body, req.user.id, req);
  res.json({ data: country });
});

exports.deleteCountry = asyncHandler(async (req, res) => {
  const result = await countryService.deleteCountry(parseInt(req.params.id), req.user.id, req);
  res.json(result);
});

exports.getUserCountries = asyncHandler(async (req, res) => {
  const countries = await countryService.getUserCountries(parseInt(req.params.userId));
  res.json({ data: countries });
});

exports.setUserCountries = asyncHandler(async (req, res) => {
  const result = await countryService.setUserCountries(
    parseInt(req.params.userId),
    req.body.countryIds,
    req.user.id,
    req
  );
  res.json({ data: result });
});
