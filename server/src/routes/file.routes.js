const router = require('express').Router();
const fileController = require('../controllers/file.controller');
const upload = require('../middleware/fileUpload');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');

// All file system operations require authentication
router.use(auth());

// Browse and stats
router.get('/', requirePermission('files.read'), fileController.browseDirectory);
router.get('/stats', requirePermission('files.read'), fileController.getStats);

// Create folder & upload
router.post('/folder', requirePermission('files.create'), fileController.createFolder);
router.post('/upload', requirePermission('files.create'), upload.array('files', 20), fileController.uploadFiles);

// Rename & delete
router.patch('/rename', requirePermission('files.update'), fileController.renameItem);
router.delete('/', requirePermission('files.delete'), fileController.deleteItem);

module.exports = router;
