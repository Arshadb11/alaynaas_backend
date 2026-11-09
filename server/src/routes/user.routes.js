const router = require('express').Router();
const Joi = require('joi');
const userController = require('../controllers/user.controller');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validate');

// Validation schemas
const createUserSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  roleId: Joi.number().integer().positive().required(),
  avatarUrl: Joi.string().uri().allow(null, '').optional(),
  isActive: Joi.boolean().optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
});

const updateUserSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(8).max(128).optional(),
  roleId: Joi.number().integer().positive().optional(),
  avatarUrl: Joi.string().uri().allow(null, '').optional(),
});

const setPermissionsSchema = Joi.object({
  permissions: Joi.array().items(Joi.string()).required(),
});

// All routes require authentication
router.use(auth());

// User CRUD
router.get('/', requirePermission('users.read'), userController.listUsers);
router.get('/:id', requirePermission('users.read'), userController.getUser);
router.post('/', requirePermission('users.create'), validate(createUserSchema), userController.createUser);
router.put('/:id', requirePermission('users.update'), validate(updateUserSchema), userController.updateUser);
router.delete('/:id', requirePermission('users.delete'), userController.deleteUser);
router.patch('/:id/toggle-active', requirePermission('users.update'), userController.toggleActive);

// User permissions
router.get('/:id/permissions', requirePermission('users.manage_permissions'), userController.getUserPermissions);
router.put('/:id/permissions', requirePermission('users.manage_permissions'), validate(setPermissionsSchema), userController.setUserPermissions);
router.post('/:id/apply-preset/:roleId', requirePermission('users.manage_permissions'), userController.applyPreset);

module.exports = router;
