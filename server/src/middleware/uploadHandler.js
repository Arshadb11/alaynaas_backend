/**
 * Builds upload middleware that accepts files in two ways:
 *
 *  1. Classic multipart upload (file bytes in the request) — local dev, small files.
 *     Files are kept in memory; the route handler stores them via storage.service.
 *  2. Direct-to-Blob upload (production on Vercel): the browser first uploads the file
 *     straight to Vercel Blob (bypassing Vercel's 4.5 MB request limit), then sends this
 *     route a multipart request whose "__blobUploads" field is a JSON list of
 *     { field, pathname, name, type } references. They're validated and turned into
 *     file objects ({ originalname, mimetype, size, blobPathname }) just like multer's.
 *
 * Usage: router.post('/x', ...makeUpload({ fileFilter, maxBytes }).array('files', 20), handler)
 */
const multer = require('multer');
const storage = require('../services/storage.service');

function makeUpload({ fileFilter, maxBytes, maxFiles = 20 }) {
  const mem = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: maxBytes, files: maxFiles },
  });

  const runFilter = (req, file) => new Promise((resolve, reject) => {
    fileFilter(req, file, (err, ok) => (err ? reject(err) : resolve(ok !== false)));
  });

  const collectBlobRefs = (fieldName, max) => async (req, res, next) => {
    try {
      const raw = req.body?.__blobUploads;
      if (!raw) return next();
      delete req.body.__blobUploads;

      let refs;
      try {
        refs = JSON.parse(raw);
      } catch {
        return res.status(400).json({ error: 'Invalid upload reference' });
      }
      if (!Array.isArray(refs)) refs = [refs];
      refs = refs.filter((r) => r && r.field === fieldName);
      if (refs.length > max) return res.status(400).json({ error: `Too many files (max ${max})` });

      const files = [];
      for (const ref of refs) {
        const meta = await storage.getIncoming(ref.pathname);
        if (!meta) return res.status(400).json({ error: 'Uploaded file not found or expired. Please try again.' });
        if (meta.size > maxBytes) {
          return res.status(400).json({ error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)` });
        }
        const file = {
          fieldname: fieldName,
          originalname: String(ref.name || meta.pathname.split('/').pop()),
          mimetype: String(ref.type || meta.contentType || 'application/octet-stream'),
          size: meta.size,
          blobPathname: meta.pathname,
        };
        if (!(await runFilter(req, file))) continue;
        files.push(file);
      }
      req.blobFiles = files;
      next();
    } catch (err) {
      next(err);
    }
  };

  return {
    single(fieldName) {
      return [
        mem.single(fieldName),
        collectBlobRefs(fieldName, 1),
        (req, res, next) => {
          if (!req.file && req.blobFiles?.length) req.file = req.blobFiles[0];
          next();
        },
      ];
    },
    array(fieldName, max = maxFiles) {
      return [
        mem.array(fieldName, max),
        collectBlobRefs(fieldName, max),
        (req, res, next) => {
          if (req.blobFiles?.length) req.files = [...(req.files || []), ...req.blobFiles];
          next();
        },
      ];
    },
  };
}

module.exports = { makeUpload };
