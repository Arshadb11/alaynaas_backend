const multer = require('multer');
const path = require('path');
const fsSync = require('fs');
const filesystemService = require('../services/filesystem.service');

const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'php3', 'php4', 'php5',
  'cgi', 'pl', 'py', 'jsp', 'asp', 'aspx', 'vbs', 'ps1',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const targetDir = req.body.dir || req.query.dir || '';
      const { targetPath } = filesystemService.getSafePath(targetDir);

      if (!fsSync.existsSync(targetPath)) {
        fsSync.mkdirSync(targetPath, { recursive: true });
      }

      cb(null, targetPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    try {
      const targetDir = req.body.dir || req.query.dir || '';
      const { targetPath } = filesystemService.getSafePath(targetDir);

      // Clean original filename (strip invalid chars but keep readable name)
      const originalClean = file.originalname.replace(/[\\/:*?"<>|]/g, '').trim() || 'upload';
      const { finalName } = filesystemService.getUniqueDestinationPath(targetPath, originalClean);

      cb(null, finalName);
    } catch (err) {
      cb(err);
    }
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return cb(new Error(`File type .${ext} is blocked for security reasons.`));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 20, // max 20 files per batch
  },
});

module.exports = upload;
