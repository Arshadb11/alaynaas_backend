const { PERMISSION_REGISTRY, getEditableFields } = require('../../shared/permission-registry.cjs');
const winstonLogger = require('../config/winston');

/**
 * Strip fields from req.body that the user doesn't have permission to edit.
 * Uses the Permission Registry to determine which fields each permission grants.
 * 
 * Usage: sanitizeFields('products')
 */
function sanitizeFields(module) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || !req.user) {
      return next();
    }

    const allowedFields = getEditableFields(req.user.permissions, module);

    // If no editable fields defined in registry for this module, pass through
    if (allowedFields.size === 0) {
      return next();
    }

    const stripped = [];
    for (const key of Object.keys(req.body)) {
      if (!allowedFields.has(key)) {
        stripped.push(key);
        delete req.body[key];
      }
    }

    if (stripped.length > 0) {
      req._strippedFields = stripped;
      winstonLogger.security('Unauthorized fields stripped from request', {
        userId: req.user.id,
        email: req.user.email,
        module,
        strippedFields: stripped,
        path: req.originalUrl,
        method: req.method,
      });
    }

    next();
  };
}

module.exports = sanitizeFields;
