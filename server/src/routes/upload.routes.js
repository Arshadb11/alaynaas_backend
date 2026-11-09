/**
 * Direct-to-Blob uploads (production). The admin panel asks /config which mode is active;
 * in "blob" mode it requests a one-file, 10-minute client token from /token, uploads the file
 * straight to Vercel Blob, then calls the normal upload endpoint with a reference to it.
 */
const router = require('express').Router();
const auth = require('../middleware/auth');
const storage = require('../services/storage.service');
const { fileFilter, MAX_BYTES } = require('../middleware/fileUpload');
const { asyncHandler } = require('../middleware/errorHandler');

router.use(auth());

router.get('/config', (req, res) => {
  res.json({ data: { mode: storage.useBlob ? 'blob' : 'local', maxBytes: MAX_BYTES } });
});

router.post('/token', asyncHandler(async (req, res) => {
  const { name, size } = req.body || {};
  if (!name) return res.status(400).json({ error: 'File name is required' });
  if (size && Number(size) > MAX_BYTES) {
    return res.status(400).json({ error: `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)` });
  }
  // Same blocked-extension check as regular uploads, before anything reaches storage
  await new Promise((resolve, reject) => fileFilter(req, { originalname: String(name) }, (err) => (err ? reject(Object.assign(err, { statusCode: 400 })) : resolve())));

  const data = await storage.createDirectUploadToken({ name, maxBytes: MAX_BYTES });
  res.json({ data });
}));

module.exports = router;
