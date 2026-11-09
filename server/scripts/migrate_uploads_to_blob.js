/**
 * One-time migration: copy server/uploads/** to Vercel Blob (pathname "uploads/<rel>").
 * Safe to re-run: files already in Blob with the same size are skipped.
 *
 * Usage (from server/):  BLOB_READ_WRITE_TOKEN=... node scripts/migrate_uploads_to_blob.js [--dry-run]
 * The token can also be put in server/.env.blob (git-ignored) as BLOB_READ_WRITE_TOKEN=...
 */
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '../.env.blob');
if (!process.env.BLOB_READ_WRITE_TOKEN && fs.existsSync(envFile)) {
  const line = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find((l) => l.startsWith('BLOB_READ_WRITE_TOKEN='));
  if (line) process.env.BLOB_READ_WRITE_TOKEN = line.slice('BLOB_READ_WRITE_TOKEN='.length).trim().replace(/^["']|["']$/g, '');
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN is not set (env var or server/.env.blob).');
  process.exit(1);
}

const { put, list, createFolder } = require('@vercel/blob');
const UPLOADS = path.resolve(__dirname, '../uploads');
const DRY = process.argv.includes('--dry-run');

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.avif': 'image/avif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile()) out.push(full);
  }
  return out;
}

(async () => {
  const files = walk(UPLOADS);
  const totalBytes = files.reduce((s, f) => s + fs.statSync(f).size, 0);
  console.log(`Local: ${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

  // What's already in Blob (pathname -> size)
  const existing = new Map();
  let cursor;
  do {
    const page = await list({ prefix: 'uploads/', cursor, limit: 1000 });
    page.blobs.forEach((b) => existing.set(b.pathname, b.size));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  console.log(`Already in Blob: ${existing.size}`);

  const todo = files.filter((f) => {
    const pathname = `uploads/${path.relative(UPLOADS, f).split(path.sep).join('/')}`;
    return existing.get(pathname) !== fs.statSync(f).size;
  });
  console.log(`To upload: ${todo.length}${DRY ? ' (dry run)' : ''}`);
  if (DRY) return;

  let done = 0;
  let failed = 0;
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const f = todo[i++];
      const rel = path.relative(UPLOADS, f).split(path.sep).join('/');
      try {
        await put(`uploads/${rel}`, fs.readFileSync(f), {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: CONTENT_TYPES[path.extname(f).toLowerCase()],
          multipart: fs.statSync(f).size > 8 * 1024 * 1024,
        });
        done++;
        if (done % 25 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}`);
      } catch (err) {
        failed++;
        console.error(`  FAILED ${rel}: ${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(`Uploaded ${done}, failed ${failed}.`);

  // Empty folders have no files to imply them: create Blob folder markers so the file manager shows them
  const emptyDirs = [];
  const findEmpty = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.startsWith('.'));
    if (dir !== UPLOADS && entries.length === 0) emptyDirs.push(dir);
    entries.filter((e) => e.isDirectory()).forEach((e) => findEmpty(path.join(dir, e.name)));
  };
  findEmpty(UPLOADS);
  for (const d of emptyDirs) {
    const rel = path.relative(UPLOADS, d).split(path.sep).join('/');
    await createFolder(`uploads/${rel}/`, { access: 'public' });
    console.log(`  folder ${rel}/`);
  }
  if (failed) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
