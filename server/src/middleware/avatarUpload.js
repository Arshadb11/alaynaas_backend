const multer = require('multer');
const path = require('path');
const fs = require('fs');

const AVATAR_DIR = path.join(__dirname, '../../uploads/avatars');

if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATAR_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanExt = ['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(ext) ? ext : '.jpg';
    const userId = req.user?.id || 'user';
    const filename = `avatar_${userId}_${Date.now()}${cleanExt}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Invalid image format. Only JPEG, PNG, WebP, and SVG are allowed.'));
  }
  cb(null, true);
};

const avatarUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

module.exports = avatarUpload;
