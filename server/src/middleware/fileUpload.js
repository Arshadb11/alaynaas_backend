const path = require('path');
const { makeUpload } = require('./uploadHandler');

const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'php3', 'php4', 'php5',
  'cgi', 'pl', 'py', 'jsp', 'asp', 'aspx', 'vbs', 'ps1',
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return cb(new Error(`File type .${ext} is blocked for security reasons.`));
  }
  cb(null, true);
};

// Files are stored by the controller (filesystemService.saveUploads) — local disk or Vercel Blob
module.exports = makeUpload({
  fileFilter,
  maxBytes: 50 * 1024 * 1024, // 50MB per file
  maxFiles: 20, // max 20 files per batch
});
module.exports.fileFilter = fileFilter;
module.exports.MAX_BYTES = 50 * 1024 * 1024;
