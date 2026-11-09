const path = require('path');
const { makeUpload } = require('./uploadHandler');

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon',
  ];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    return cb(null, true);
  }
  cb(new Error('Invalid brand asset format. Only SVG, PNG, WebP, JPEG, and ICO are permitted.'));
};

// Stored by settingsService.uploadBrandingAsset as uploads/branding/<key>_<timestamp>.<ext>
module.exports = makeUpload({
  fileFilter,
  maxBytes: 10 * 1024 * 1024, // 10MB max
  maxFiles: 1,
});
