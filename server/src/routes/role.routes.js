const router = require('express').Router();
const Joi = require('joi');
const roleController = require('../controllers/role.controller');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validate');

const roleSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  description: Joi.string().max(255).allow(null, '').optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
});

router.use(auth());

// Permissions catalog (static path — must come before /:id)
router.get('/permissions/all', requirePermission('users.read'), roleController.getAllPermissions);

router.get('/', requirePermission('users.read'), roleController.listRoles);
router.get('/:id', requirePermission('users.read'), roleController.getRole);
router.post('/', requirePermission('users.manage_permissions'), validate(roleSchema), roleController.createRole);
router.put('/:id', requirePermission('users.manage_permissions'), validate(roleSchema), roleController.updateRole);
router.delete('/:id', requirePermission('users.manage_permissions'), roleController.deleteRole);

module.exports = router;
