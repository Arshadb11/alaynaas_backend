const router = require('express').Router();
const Joi = require('joi');
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const avatarUpload = require('../middleware/avatarUpload');

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const profileSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  avatarUrl: Joi.string().allow(null, '').optional(),
}).min(1);

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required(),
});

// Public routes
router.post('/login', loginRateLimiter(), validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);

// Authenticated routes
router.post('/logout', auth(), authController.logout);
router.post('/logout-all', auth(), authController.logoutAll);
router.post('/logout-others', auth(), authController.logoutAll);
router.get('/me', auth(), authController.getMe);
router.put('/profile', auth(), validate(profileSchema), authController.updateProfile);
router.put('/change-password', auth(), validate(changePasswordSchema), authController.changePassword);
router.post('/avatar', auth(), avatarUpload.single('avatar'), authController.uploadAvatar);
router.get('/sessions', auth(), authController.getSessions);
router.delete('/sessions/:sessionId', auth(), authController.logoutSession);

module.exports = router;
