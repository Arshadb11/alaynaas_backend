const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const loggerService = require('./logger.service');

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

// Ensure root directory exists
// (Read-only filesystem on Vercel: don't crash at startup if the folder can't be created)
try {
  if (!fsSync.existsSync(UPLOADS_ROOT)) fsSync.mkdirSync(UPLOADS_ROOT, { recursive: true });
} catch { /* uploads unavailable on this host */ }

/**
 * Categorize extensions for UI icons and filtering
 */
const EXTENSION_CATEGORIES = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'ico', 'bmp', 'tiff'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf', 'ppt', 'pptx', 'odt', 'ods'],
  video: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
  code: ['json', 'xml', 'html', 'css', 'md', 'yaml', 'yml'],
};

function getCategoryFromExtension(ext) {
  const cleanExt = (ext || '').toLowerCase().replace(/^\./, '');
  for (const [category, exts] of Object.entries(EXTENSION_CATEGORIES)) {
    if (exts.includes(cleanExt)) return category;
  }
  return 'other';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

class FilesystemService {
  /**
   * Resolve and validate safe path within UPLOADS_ROOT
   * Strictly prevents path traversal attacks
   */
  getSafePath(relativeDir = '') {
    // Normalize and strip leading / or \
    const cleanDir = path.normalize(relativeDir || '')
      .replace(/^([.\\/\\])+/, '')
      .replace(/\.\./g, ''); // strip any parent navigation

    const targetPath = path.resolve(UPLOADS_ROOT, cleanDir);

    if (!targetPath.startsWith(UPLOADS_ROOT)) {
      throw new Error('Access denied: Invalid directory path outside uploads');
    }

    // Normalized relative path using forward slashes
    let relative = path.relative(UPLOADS_ROOT, targetPath).replace(/\\/g, '/');
    if (relative === '.') relative = '';

    return {
      targetPath,
      relativeDir: relative,
    };
  }

  /**
   * List directory contents (folders and files) with search, filter, and sorting
   */
  async listDirectory({ dir = '', search = '', filterType = '', sortBy = 'name', sortOrder = 'asc' }) {
    const { targetPath, relativeDir } = this.getSafePath(dir);

    if (!fsSync.existsSync(targetPath)) {
      await fs.mkdir(targetPath, { recursive: true });
    }

    const entries = await fs.readdir(targetPath, { withFileTypes: true });

    const folders = [];
    const files = [];

    for (const entry of entries) {
      const itemFullPath = path.join(targetPath, entry.name);
      try {
        const stats = await fs.stat(itemFullPath);

        if (entry.isDirectory()) {
          // Count direct children
          let childCount = 0;
          try {
            const children = await fs.readdir(itemFullPath);
            childCount = children.length;
          } catch {}

          const folderRel = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
          folders.push({
            name: entry.name,
            path: folderRel,
            isDirectory: true,
            itemCount: childCount,
            size: stats.size,
            modifiedAt: stats.mtime,
            createdAt: stats.birthtime,
          });
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          const category = getCategoryFromExtension(ext);
          const fileRel = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
          const url = `/uploads/${fileRel.split('/').map(encodeURIComponent).join('/')}`;

          files.push({
            name: entry.name,
            path: fileRel,
            url,
            isDirectory: false,
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            extension: ext,
            category,
            modifiedAt: stats.mtime,
            createdAt: stats.birthtime,
          });
        }
      } catch (err) {
        // Skip unreadable files
      }
    }

    // Filtering
    let filteredFolders = folders;
    let filteredFiles = files;

    if (search) {
      const q = search.toLowerCase();
      filteredFolders = folders.filter((f) => f.name.toLowerCase().includes(q));
      filteredFiles = files.filter((f) => f.name.toLowerCase().includes(q));
    }

    if (filterType && filterType !== 'all') {
      filteredFiles = files.filter((f) => f.category === filterType);
    }

    // Sorting
    const sortMultiplier = sortOrder === 'desc' ? -1 : 1;
    filteredFolders.sort((a, b) => a.name.localeCompare(b.name) * sortMultiplier);

    filteredFiles.sort((a, b) => {
      if (sortBy === 'size') {
        return (a.size - b.size) * sortMultiplier;
      }
      if (sortBy === 'date' || sortBy === 'modified') {
        return (new Date(a.modifiedAt) - new Date(b.modifiedAt)) * sortMultiplier;
      }
      return a.name.localeCompare(b.name) * sortMultiplier;
    });

    // Compute Breadcrumbs
    const parts = relativeDir ? relativeDir.split('/').filter(Boolean) : [];
    const breadcrumbs = [{ name: 'Home', path: '' }];
    let accum = '';
    for (const part of parts) {
      accum = accum ? `${accum}/${part}` : part;
      breadcrumbs.push({ name: part, path: accum });
    }

    return {
      currentDir: relativeDir,
      breadcrumbs,
      folders: filteredFolders,
      files: filteredFiles,
      totalFolders: filteredFolders.length,
      totalFiles: filteredFiles.length,
    };
  }

  /**
   * Create a new folder on the physical disk
   */
  async createFolder({ dir = '', name }) {
    // Sanitize folder name
    const sanitized = (name || '').replace(/[\\/:*?"<>|]/g, '').trim();
    if (!sanitized) {
      throw new Error('Invalid folder name. Cannot be empty or contain special characters.');
    }

    const { targetPath, relativeDir } = this.getSafePath(dir);
    const newFolderPath = path.join(targetPath, sanitized);

    if (fsSync.existsSync(newFolderPath)) {
      throw new Error(`A folder or file named "${sanitized}" already exists.`);
    }

    await fs.mkdir(newFolderPath, { recursive: true });

    const newRelPath = relativeDir ? `${relativeDir}/${sanitized}` : sanitized;
    return {
      name: sanitized,
      path: newRelPath,
      isDirectory: true,
      itemCount: 0,
      modifiedAt: new Date(),
    };
  }

  /**
   * Rename a file or folder on disk
   */
  async renameItem({ dir = '', oldName, newName }) {
    const cleanOld = path.basename(oldName || '').trim();
    const cleanNew = (newName || '').replace(/[\\/:*?"<>|]/g, '').trim();

    if (!cleanOld || !cleanNew) {
      throw new Error('Both old and new names are required.');
    }

    const { targetPath, relativeDir } = this.getSafePath(dir);
    const oldPath = path.join(targetPath, cleanOld);
    const newPath = path.join(targetPath, cleanNew);

    if (!fsSync.existsSync(oldPath)) {
      throw new Error(`"${cleanOld}" does not exist.`);
    }
    if (fsSync.existsSync(newPath)) {
      throw new Error(`An item named "${cleanNew}" already exists.`);
    }

    await fs.rename(oldPath, newPath);

    const newRelPath = relativeDir ? `${relativeDir}/${cleanNew}` : cleanNew;
    return {
      oldName: cleanOld,
      newName: cleanNew,
      path: newRelPath,
    };
  }

  /**
   * Delete a file or directory from physical disk
   */
  async deleteItem({ dir = '', name }) {
    const cleanName = path.basename(name || '').trim();
    if (!cleanName) {
      throw new Error('Item name is required.');
    }

    const { targetPath } = this.getSafePath(dir);
    const itemPath = path.join(targetPath, cleanName);

    if (!fsSync.existsSync(itemPath)) {
      throw new Error(`"${cleanName}" does not exist.`);
    }

    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      await fs.rm(itemPath, { recursive: true, force: true });
    } else {
      await fs.unlink(itemPath);
    }

    return {
      name: cleanName,
      isDirectory: stats.isDirectory(),
      success: true,
    };
  }

  /**
   * Calculate collision-free filename if destination file already exists
   * e.g. "dulook.jpg" -> "dulook (1).jpg"
   */
  getUniqueDestinationPath(targetDir, originalName) {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);

    let candidateName = originalName;
    let candidatePath = path.join(targetDir, candidateName);
    let counter = 1;

    while (fsSync.existsSync(candidatePath)) {
      candidateName = `${baseName} (${counter})${ext}`;
      candidatePath = path.join(targetDir, candidateName);
      counter++;
    }

    return { finalPath: candidatePath, finalName: candidateName };
  }

  /**
   * Scan disk and return storage statistics
   */
  async getStorageStats() {
    let totalSize = 0;
    let totalFiles = 0;
    let totalFolders = 0;
    const categoryCounts = { image: 0, document: 0, video: 0, audio: 0, archive: 0, other: 0 };

    async function walk(currentPath) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(currentPath, entry.name);
        try {
          const stats = await fs.stat(full);
          if (entry.isDirectory()) {
            totalFolders++;
            await walk(full);
          } else if (entry.isFile()) {
            totalFiles++;
            totalSize += stats.size;
            const ext = path.extname(entry.name).toLowerCase().replace('.', '');
            const cat = getCategoryFromExtension(ext);
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
          }
        } catch {}
      }
    }

    if (fsSync.existsSync(UPLOADS_ROOT)) {
      await walk(UPLOADS_ROOT);
    }

    return {
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      totalFiles,
      totalFolders,
      categoryCounts,
    };
  }
}

module.exports = new FilesystemService();
