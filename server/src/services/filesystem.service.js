const path = require('path');
const storage = require('./storage.service');

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

const cleanItemName = (name) => (name || '').replace(/[\\/:*?"<>|]/g, '').trim();
const joinRel = (dir, name) => (dir ? `${dir}/${name}` : name);

function describeFile(rel, size, mtime, ctime) {
  const name = rel.split('/').pop();
  const ext = path.extname(name).toLowerCase().replace('.', '');
  return {
    name,
    path: rel,
    url: storage.relativeUrl(rel),
    fullUrl: storage.publicUrl(rel),
    isDirectory: false,
    size,
    sizeFormatted: formatBytes(size),
    extension: ext,
    category: getCategoryFromExtension(ext),
    modifiedAt: mtime,
    createdAt: ctime,
  };
}

class FilesystemService {
  /**
   * Normalize a client-supplied directory into a safe relative path (forward slashes,
   * no leading slash, no parent navigation). Strictly prevents path traversal.
   */
  getSafePath(relativeDir = '') {
    const cleaned = String(relativeDir || '')
      .replace(/\\/g, '/')
      .split('/')
      .map((seg) => seg.trim())
      .filter((seg) => seg && seg !== '.' && seg !== '..' && !seg.startsWith('.'))
      .join('/');
    return { relativeDir: cleaned };
  }

  /**
   * List directory contents (folders and files) with search, filter, and sorting
   */
  async listDirectory({ dir = '', search = '', filterType = '', sortBy = 'name', sortOrder = 'asc' }) {
    const { relativeDir } = this.getSafePath(dir);
    const depth = relativeDir ? relativeDir.split('/').length : 0;

    // One recursive listing of the subtree, then split into direct children
    const tree = await storage.listTree(relativeDir);

    const childCounts = new Map(); // folder rel -> number of direct children
    for (const item of tree) {
      const parent = item.rel.split('/').slice(0, -1).join('/');
      childCounts.set(parent, (childCounts.get(parent) || 0) + 1);
    }

    const folders = [];
    const files = [];
    for (const item of tree) {
      if (item.rel.split('/').length !== depth + 1) continue; // only direct children
      if (item.type === 'dir') {
        folders.push({
          name: item.rel.split('/').pop(),
          path: item.rel,
          isDirectory: true,
          itemCount: childCounts.get(item.rel) || 0,
          size: item.size,
          modifiedAt: item.mtime,
          createdAt: item.ctime,
        });
      } else {
        files.push(describeFile(item.rel, item.size, item.mtime, item.ctime));
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
      filteredFiles = filteredFiles.filter((f) => f.category === filterType);
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
   * Create a new folder
   */
  async createFolder({ dir = '', name }) {
    const sanitized = cleanItemName(name);
    if (!sanitized || sanitized.startsWith('.')) {
      throw new Error('Invalid folder name. Cannot be empty or contain special characters.');
    }

    const { relativeDir } = this.getSafePath(dir);
    const newRelPath = joinRel(relativeDir, sanitized);

    if (await storage.exists(newRelPath)) {
      throw new Error(`A folder or file named "${sanitized}" already exists.`);
    }

    await storage.createFolder(newRelPath);

    return {
      name: sanitized,
      path: newRelPath,
      isDirectory: true,
      itemCount: 0,
      modifiedAt: new Date(),
    };
  }

  /**
   * Rename a file or folder
   */
  async renameItem({ dir = '', oldName, newName }) {
    const cleanOld = path.basename(oldName || '').trim();
    const cleanNew = cleanItemName(newName);

    if (!cleanOld || !cleanNew || cleanNew.startsWith('.')) {
      throw new Error('Both old and new names are required.');
    }

    const { relativeDir } = this.getSafePath(dir);
    const oldRel = joinRel(relativeDir, cleanOld);
    const newRel = joinRel(relativeDir, cleanNew);

    if (!(await storage.exists(oldRel))) {
      throw new Error(`"${cleanOld}" does not exist.`);
    }
    if (await storage.exists(newRel)) {
      throw new Error(`An item named "${cleanNew}" already exists.`);
    }

    await storage.move(oldRel, newRel);

    return {
      oldName: cleanOld,
      newName: cleanNew,
      path: newRel,
    };
  }

  /**
   * Delete a file or folder
   */
  async deleteItem({ dir = '', name }) {
    const cleanName = path.basename(name || '').trim();
    if (!cleanName) {
      throw new Error('Item name is required.');
    }

    const { relativeDir } = this.getSafePath(dir);
    const rel = joinRel(relativeDir, cleanName);

    const info = await storage.stat(rel);
    if (!info) {
      throw new Error(`"${cleanName}" does not exist.`);
    }

    await storage.remove(rel);

    return {
      name: cleanName,
      isDirectory: info.type === 'dir',
      success: true,
    };
  }

  /**
   * Store uploaded files in a directory with collision-free names ("a.jpg" -> "a (1).jpg").
   * Returns the descriptors sent back to the client.
   */
  async saveUploads(dir, files) {
    const { relativeDir } = this.getSafePath(dir);
    const saved = [];
    for (const file of files) {
      const originalClean = cleanItemName(file.originalname) || 'upload';
      const finalName = await storage.uniqueName(relativeDir, originalClean);
      const rel = joinRel(relativeDir, finalName);
      await storage.save(rel, file);
      saved.push({
        name: finalName,
        originalName: file.originalname,
        path: rel,
        url: storage.relativeUrl(rel),
        fullUrl: storage.publicUrl(rel),
        size: file.size,
        mimeType: file.mimetype,
      });
    }
    return { relativeDir, saved };
  }

  /**
   * Storage statistics
   */
  async getStorageStats() {
    let totalSize = 0;
    let totalFiles = 0;
    let totalFolders = 0;
    const categoryCounts = { image: 0, document: 0, video: 0, audio: 0, archive: 0, other: 0 };

    for (const item of await storage.listTree('')) {
      if (item.type === 'dir') {
        totalFolders++;
      } else {
        totalFiles++;
        totalSize += item.size;
        const cat = getCategoryFromExtension(path.extname(item.rel));
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
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
