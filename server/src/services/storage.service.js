/**
 * Upload storage — one interface, two backends:
 *   - Local disk (server/uploads)  when BLOB_READ_WRITE_TOKEN is not set (local development)
 *   - Vercel Blob                  when BLOB_READ_WRITE_TOKEN is set (production on Vercel)
 *
 * Everything works with "rel" paths relative to the uploads root, using forward slashes
 * (e.g. "Products/BOMBAY OUD/BOMBAY OUD -1.jpg"). Public URL path is always /uploads/<rel>.
 * In Blob, a file lives at pathname "uploads/<rel>"; folders are implied by paths
 * (empty folders are kept with a Blob folder marker "uploads/<rel>/").
 */
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');
const BLOB_PREFIX = 'uploads/';
const INCOMING_DIR = '.incoming'; // browser → Blob direct uploads land here first, then get moved

const token = process.env.BLOB_READ_WRITE_TOKEN || '';
const useBlob = !!token;
const blob = useBlob ? require('@vercel/blob') : null;

// Public base URL of the Blob store: https://<storeId>.public.blob.vercel-storage.com
const storeId = (token.split('_')[3] || '').toLowerCase();
const BLOB_BASE_URL = (process.env.BLOB_BASE_URL || (storeId ? `https://${storeId}.public.blob.vercel-storage.com` : '')).replace(/\/$/, '');

// Public origin of this API, used for absolute URLs of local-disk files (dev)
const API_PUBLIC_ORIGIN = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

const encodeRel = (rel) => rel.split('/').map(encodeURIComponent).join('/');
const isHidden = (rel) => rel.split('/').some((seg) => seg.startsWith('.'));
const blobOpts = (extra = {}) => ({ access: 'public', addRandomSuffix: false, ...extra });

/** Relative URL stored in the database / returned to clients: /uploads/<rel> */
function relativeUrl(rel) {
  return `/uploads/${encodeRel(rel)}`;
}

/** Absolute public URL of a stored file */
function publicUrl(rel) {
  return useBlob ? `${BLOB_BASE_URL}/${BLOB_PREFIX}${encodeRel(rel)}` : `${API_PUBLIC_ORIGIN}${relativeUrl(rel)}`;
}

function localPath(rel) {
  const full = path.resolve(UPLOADS_ROOT, rel);
  if (full !== UPLOADS_ROOT && !full.startsWith(UPLOADS_ROOT + path.sep)) {
    throw new Error('Access denied: Invalid path outside uploads');
  }
  return full;
}

async function blobHead(rel) {
  try {
    return await blob.head(BLOB_PREFIX + rel);
  } catch (err) {
    if (err instanceof blob.BlobNotFoundError) return null;
    throw err;
  }
}

/** All blobs under a folder (recursive), following pagination */
async function blobListAll(relDir) {
  const prefix = BLOB_PREFIX + (relDir ? `${relDir}/` : '');
  const out = [];
  let cursor;
  do {
    const page = await blob.list({ prefix, cursor, limit: 1000 });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

/** Does any blob exist under this folder? */
async function blobFolderExists(rel) {
  const page = await blob.list({ prefix: `${BLOB_PREFIX}${rel}/`, limit: 1 });
  return page.blobs.length > 0;
}

/** Run async fn over items with limited concurrency */
async function eachLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/**
 * What is at rel? → { type: 'file'|'dir', size, mtime } or null
 */
async function stat(rel) {
  if (!useBlob) {
    try {
      const s = await fsp.stat(localPath(rel));
      return { type: s.isDirectory() ? 'dir' : 'file', size: s.size, mtime: s.mtime, ctime: s.birthtime };
    } catch {
      return null;
    }
  }
  const file = await blobHead(rel);
  if (file) return { type: 'file', size: file.size, mtime: file.uploadedAt, ctime: file.uploadedAt };
  if (await blobFolderExists(rel)) return { type: 'dir', size: 0, mtime: new Date(), ctime: new Date() };
  return null;
}

async function exists(rel) {
  return (await stat(rel)) !== null;
}

/**
 * Flat recursive listing under relDir (hidden entries excluded):
 * [{ rel, type: 'file'|'dir', size, mtime }]
 * For Blob, folders are derived from file paths and folder markers.
 */
async function listTree(relDir = '') {
  if (!useBlob) {
    const out = [];
    const walk = async (dirRel) => {
      let entries;
      try {
        entries = await fsp.readdir(localPath(dirRel), { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const rel = dirRel ? `${dirRel}/${e.name}` : e.name;
        if (isHidden(rel)) continue;
        try {
          const s = await fsp.stat(localPath(rel));
          if (e.isDirectory()) {
            out.push({ rel, type: 'dir', size: s.size, mtime: s.mtime, ctime: s.birthtime });
            await walk(rel);
          } else if (e.isFile()) {
            out.push({ rel, type: 'file', size: s.size, mtime: s.mtime, ctime: s.birthtime });
          }
        } catch { /* skip unreadable */ }
      }
    };
    await walk(relDir);
    return out;
  }

  const blobs = await blobListAll(relDir);
  const dirs = new Map();
  const files = [];
  const addDir = (rel, when) => {
    const prev = dirs.get(rel);
    if (!prev || when > prev) dirs.set(rel, when);
  };
  for (const b of blobs) {
    const full = b.pathname.slice(BLOB_PREFIX.length); // may end with "/" for folder markers
    const isMarker = full.endsWith('/');
    const rel = isMarker ? full.slice(0, -1) : full;
    if (!rel || isHidden(rel)) continue;
    // register every ancestor folder below relDir
    const parts = rel.split('/');
    const baseDepth = relDir ? relDir.split('/').length : 0;
    for (let d = baseDepth + 1; d < parts.length; d++) addDir(parts.slice(0, d).join('/'), b.uploadedAt);
    if (isMarker) addDir(rel, b.uploadedAt);
    else files.push({ rel, type: 'file', size: b.size, mtime: b.uploadedAt, ctime: b.uploadedAt });
  }
  return [
    ...[...dirs.entries()].filter(([rel]) => rel !== relDir).map(([rel, when]) => ({ rel, type: 'dir', size: 0, mtime: when, ctime: when })),
    ...files,
  ];
}

/** Ensure a folder exists */
async function createFolder(rel) {
  if (!useBlob) {
    await fsp.mkdir(localPath(rel), { recursive: true });
    return;
  }
  await blob.createFolder(`${BLOB_PREFIX}${rel}/`, { access: 'public' });
}

/**
 * Store an uploaded file at rel.
 * file: { buffer, mimetype } (multipart upload) or { blobPathname, mimetype } (already uploaded to Blob by the browser)
 */
async function save(rel, file) {
  if (!useBlob) {
    if (!file.buffer) throw new Error('Direct uploads are only supported with Blob storage');
    const full = localPath(rel);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, file.buffer);
    return;
  }
  if (file.blobPathname) {
    await blob.rename(file.blobPathname, BLOB_PREFIX + rel, blobOpts({ contentType: file.mimetype || undefined }));
  } else {
    await blob.put(BLOB_PREFIX + rel, file.buffer, blobOpts({ contentType: file.mimetype || undefined }));
  }
}

/** Rename/move a file or folder */
async function move(fromRel, toRel) {
  if (!useBlob) {
    await fsp.rename(localPath(fromRel), localPath(toRel));
    return;
  }
  const file = await blobHead(fromRel);
  if (file) {
    await blob.rename(BLOB_PREFIX + fromRel, BLOB_PREFIX + toRel, blobOpts({ contentType: file.contentType }));
    return;
  }
  const blobs = await blobListAll(fromRel);
  await eachLimit(blobs, 5, async (b) => {
    const rest = b.pathname.slice(`${BLOB_PREFIX}${fromRel}/`.length);
    if (b.pathname.endsWith('/')) {
      await blob.createFolder(`${BLOB_PREFIX}${toRel}/${rest}`, { access: 'public' });
      await blob.del(b.url);
    } else {
      await blob.rename(b.url, `${BLOB_PREFIX}${toRel}/${rest}`, blobOpts());
    }
  });
}

/** Delete a file or a whole folder */
async function remove(rel) {
  if (!useBlob) {
    await fsp.rm(localPath(rel), { recursive: true, force: true });
    return;
  }
  const file = await blobHead(rel);
  if (file) {
    await blob.del(file.url);
    return;
  }
  const urls = (await blobListAll(rel)).map((b) => b.url);
  for (let i = 0; i < urls.length; i += 100) await blob.del(urls.slice(i, i + 100));
}

/** "name.jpg" → "name (1).jpg" … until free in relDir */
async function uniqueName(relDir, name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let candidate = name;
  for (let n = 1; await exists(relDir ? `${relDir}/${candidate}` : candidate); n++) {
    candidate = `${base} (${n})${ext}`;
  }
  return candidate;
}

// ── Browser → Blob direct uploads (bypasses Vercel's 4.5 MB request limit) ──

/** Issue a short-lived client token that only allows uploading one file to a temp pathname */
async function createDirectUploadToken({ name, maxBytes }) {
  if (!useBlob) throw Object.assign(new Error('Direct uploads are not enabled on this server'), { statusCode: 400 });
  const { generateClientTokenFromReadWriteToken } = require('@vercel/blob/client');
  const safeName = String(name || 'upload').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 200) || 'upload';
  const pathname = `${BLOB_PREFIX}${INCOMING_DIR}/${crypto.randomUUID()}/${safeName}`;
  const clientToken = await generateClientTokenFromReadWriteToken({
    pathname,
    maximumSizeInBytes: maxBytes,
    validUntil: Date.now() + 10 * 60 * 1000,
    addRandomSuffix: false,
    allowOverwrite: false,
  });
  return { pathname, clientToken };
}

/** Validate a temp pathname reported by the browser and return its real metadata */
async function getIncoming(pathname) {
  const p = String(pathname || '');
  if (!useBlob || !p.startsWith(`${BLOB_PREFIX}${INCOMING_DIR}/`) || p.includes('..')) return null;
  try {
    const meta = await blob.head(p);
    return { pathname: p, size: meta.size, contentType: meta.contentType };
  } catch {
    return null;
  }
}

/** Delete abandoned temp uploads older than maxAgeMs (run from the daily cron) */
async function purgeIncoming(maxAgeMs = 24 * 60 * 60 * 1000) {
  if (!useBlob) return 0;
  const cutoff = Date.now() - maxAgeMs;
  const stale = (await blobListAll(INCOMING_DIR)).filter((b) => new Date(b.uploadedAt).getTime() < cutoff).map((b) => b.url);
  for (let i = 0; i < stale.length; i += 100) await blob.del(stale.slice(i, i + 100));
  return stale.length;
}

module.exports = {
  useBlob,
  UPLOADS_ROOT,
  BLOB_BASE_URL,
  relativeUrl,
  publicUrl,
  stat,
  exists,
  listTree,
  createFolder,
  save,
  move,
  remove,
  uniqueName,
  createDirectUploadToken,
  getIncoming,
  purgeIncoming,
};
