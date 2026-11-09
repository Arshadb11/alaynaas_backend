const router = require('express').Router();
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const brandingUpload = require('../middleware/brandingUpload');
const settingsController = require('../controllers/settings.controller');

// All admin settings routes require authentication
router.use(auth());

// ── Settings CRUD ──────────────────────────────────────────
router.get('/', requirePermission('settings.read'), settingsController.getSettings);
router.put('/', requirePermission('settings.update'), settingsController.updateSettings);

// ── Branding Upload (Logo & Favicon) ───────────────────────
router.post(
  '/upload',
  requirePermission('settings.update'),
  brandingUpload.single('file'),
  settingsController.uploadBrandingAsset
);

// ── Cache & Performance ────────────────────────────────────
router.post('/cache/flush', requirePermission('settings.update'), settingsController.flushCache);
router.post('/trash/empty', requirePermission('settings.update'), settingsController.emptyTrash);
router.post('/system/optimize', requirePermission('settings.update'), settingsController.optimizeDatabase);
router.get('/system/metrics', requirePermission('settings.read'), settingsController.getSystemMetrics);

// ── Email / Notifications Test ─────────────────────────────
router.post('/email/test', requirePermission('settings.update'), settingsController.testSmtp);

module.exports = router;
