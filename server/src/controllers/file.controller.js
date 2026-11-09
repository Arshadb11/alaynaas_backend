const filesystemService = require('../services/filesystem.service');
const { asyncHandler } = require('../middleware/errorHandler');
const loggerService = require('../services/logger.service');

const browseDirectory = asyncHandler(async (req, res) => {
  const { dir = '', search = '', filterType = '', sortBy = 'name', sortOrder = 'asc' } = req.query;
  const result = await filesystemService.listDirectory({
    dir,
    search,
    filterType,
    sortBy,
    sortOrder,
  });
  res.json(result);
});

const createFolder = asyncHandler(async (req, res) => {
  const { dir = '', name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Folder name is required.' });
  }

  const result = await filesystemService.createFolder({ dir, name });

  // Audit log
  await loggerService.logAction({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'FOLDER_CREATE',
    category: 'FILES',
    details: { folderPath: result.path, name: result.name },
    req,
  });

  res.status(201).json({ data: result });
});

const uploadFiles = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'No files were uploaded.' });
  }

  const targetDir = req.body.dir || req.query.dir || '';
  const { relativeDir, saved: uploadedList } = await filesystemService.saveUploads(targetDir, files);

  // Audit log
  await loggerService.logAction({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'FILES_UPLOAD',
    category: 'FILES',
    details: { count: files.length, targetDir: relativeDir, fileNames: uploadedList.map((f) => f.name) },
    req,
  });

  res.status(201).json({
    message: `Successfully uploaded ${files.length} file(s)`,
    files: uploadedList,
  });
});

const renameItem = asyncHandler(async (req, res) => {
  const { dir = '', oldName, newName } = req.body;
  const result = await filesystemService.renameItem({ dir, oldName, newName });

  // Audit log
  await loggerService.logAction({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'ITEM_RENAME',
    category: 'FILES',
    details: { oldName, newName, dir },
    req,
  });

  res.json({ data: result });
});

const deleteItem = asyncHandler(async (req, res) => {
  const { dir = '', name } = req.body;
  const result = await filesystemService.deleteItem({ dir, name });

  // Audit log
  await loggerService.logAction({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'ITEM_DELETE',
    category: 'FILES',
    details: { name, dir, isDirectory: result.isDirectory },
    req,
  });

  res.json({ message: `Successfully deleted "${name}"`, data: result });
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await filesystemService.getStorageStats();
  res.json({ data: stats });
});

module.exports = {
  browseDirectory,
  createFolder,
  uploadFiles,
  renameItem,
  deleteItem,
  getStats,
};
