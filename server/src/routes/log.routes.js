const router = require('express').Router();
const logController = require('../controllers/log.controller');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');

router.use(auth());

router.get('/audit', requirePermission('audit.read'), logController.getAuditLogs);
router.get('/audit/:id', requirePermission('audit.read'), logController.getAuditLogById);
router.get('/requests', requirePermission('audit.read'), logController.getRequestLogs);

module.exports = router;
