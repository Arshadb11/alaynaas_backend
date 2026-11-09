const winstonLogger = require('../config/winston');

/**
 * Require the user to have a specific permission.
 * Usage: requirePermission('users.create')
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.permissions.includes(permission)) {
      winstonLogger.security('Permission denied', {
        userId: req.user.id,
        email: req.user.email,
        required: permission,
        had: req.user.permissions,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });

      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission,
      });
    }

    next();
  };
}

/**
 * Require the user to have at least ONE of the listed permissions.
 * Usage: requireAnyPermission(['products.update_content', 'products.update'])
 */
function requireAnyPermission(permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAny = permissions.some((p) => req.user.permissions.includes(p));

    if (!hasAny) {
      winstonLogger.security('Permission denied (any)', {
        userId: req.user.id,
        email: req.user.email,
        required: permissions,
        had: req.user.permissions,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });

      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permissions,
      });
    }

    next();
  };
}

/**
 * Require the user to have ALL of the listed permissions.
 */
function requireAllPermissions(permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAll = permissions.every((p) => req.user.permissions.includes(p));

    if (!hasAll) {
      const missing = permissions.filter((p) => !req.user.permissions.includes(p));
      winstonLogger.security('Permission denied (all)', {
        userId: req.user.id,
        email: req.user.email,
        missing,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });

      return res.status(403).json({
        error: 'Insufficient permissions',
        missing,
      });
    }

    next();
  };
}

module.exports = { requirePermission, requireAnyPermission, requireAllPermissions };
