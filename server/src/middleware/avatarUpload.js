const { makeUpload } = require('./uploadHandler');

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Invalid image format. Only JPEG, PNG, WebP, and SVG are allowed.'));
  }
  cb(null, true);
};

// Stored by authController.uploadAvatar as uploads/avatars/avatar_<userId>_<timestamp>.<ext>
module.exports = makeUpload({
  fileFilter,
  maxBytes: 5 * 1024 * 1024, // 5MB max
  maxFiles: 1,
});
