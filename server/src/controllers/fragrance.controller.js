const fragranceService = require('../services/fragrance.service');
const { asyncHandler } = require('../middleware/errorHandler');

// ── Olfactory Families ──────────────────────────────────
const listOlfactoryFamilies = asyncHandler(async (req, res) => {
  const { search, activeOnly } = req.query;
  const families = await fragranceService.listOlfactoryFamilies({
    search,
    activeOnly: activeOnly === 'true' || activeOnly === '1',
  });
  res.json({ data: families });
});

const getOlfactoryFamily = asyncHandler(async (req, res) => {
  const family = await fragranceService.getOlfactoryFamilyById(parseInt(req.params.id));
  res.json({ data: family });
});

const createOlfactoryFamily = asyncHandler(async (req, res) => {
  const family = await fragranceService.createOlfactoryFamily(req.body, req.user.id, req);
  res.status(201).json({ data: family });
});

const updateOlfactoryFamily = asyncHandler(async (req, res) => {
  const family = await fragranceService.updateOlfactoryFamily(parseInt(req.params.id), req.body, req.user.id, req);
  res.json({ data: family });
});

const deleteOlfactoryFamily = asyncHandler(async (req, res) => {
  const result = await fragranceService.deleteOlfactoryFamily(parseInt(req.params.id), req.user.id, req);
  res.json(result);
});

// ── Fragrance Notes ─────────────────────────────────────
const listFragranceNotes = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const notes = await fragranceService.listFragranceNotes({ search });
  res.json({ data: notes });
});

const getFragranceNote = asyncHandler(async (req, res) => {
  const note = await fragranceService.getFragranceNoteById(parseInt(req.params.id));
  res.json({ data: note });
});

const createFragranceNote = asyncHandler(async (req, res) => {
  const note = await fragranceService.createFragranceNote(req.body, req.user.id, req);
  res.status(201).json({ data: note });
});

const updateFragranceNote = asyncHandler(async (req, res) => {
  const note = await fragranceService.updateFragranceNote(parseInt(req.params.id), req.body, req.user.id, req);
  res.json({ data: note });
});

const deleteFragranceNote = asyncHandler(async (req, res) => {
  const result = await fragranceService.deleteFragranceNote(parseInt(req.params.id), req.user.id, req);
  res.json(result);
});

module.exports = {
  listOlfactoryFamilies,
  getOlfactoryFamily,
  createOlfactoryFamily,
  updateOlfactoryFamily,
  deleteOlfactoryFamily,
  listFragranceNotes,
  getFragranceNote,
  createFragranceNote,
  updateFragranceNote,
  deleteFragranceNote,
};
