const multer = require('multer');
const path = require('path');
const fs = require('fs');

const BRANDING_DIR = path.join(__dirname, '../../uploads/branding');

// Read-only filesystem on Vercel: don't crash at startup if the folder can't be created
try {
  if (!fs.existsSync(BRANDING_DIR)) fs.mkdirSync(BRANDING_DIR, { recursive: true });
} catch { /* uploads unavailable on this host */ }

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, BRANDING_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanExt = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico'].includes(ext) ? ext : '.png';
    const key = (req.body?.key || req.query?.key || 'asset').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${key}_${Date.now()}${cleanExt}`;
    cb(null, filename);
  },
});

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

const brandingUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

module.exports = brandingUpload;
