const { getVisibleFields } = require('../../shared/permission-registry.cjs');

/**
 * Filter response data to only include fields the user has permission to see.
 * Uses the Permission Registry to determine visibility.
 * 
 * Usage: filterResponse('products')
 */
function filterResponse(module) {
  return (req, res, next) => {
    if (!req.user) return next();

    const originalJson = res.json.bind(res);

    res.json = (body) => {
      const visibleFields = getVisibleFields(req.user.permissions, module);

      // If no visible field rules defined, pass through unfiltered
      if (visibleFields.size === 0) {
        return originalJson(body);
      }

      // Always allow meta fields through
      const alwaysAllow = new Set(['id', 'created_at', 'updated_at']);
      const allowed = new Set([...visibleFields, ...alwaysAllow]);

      const filterObj = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        const filtered = {};
        for (const key of Object.keys(obj)) {
          if (allowed.has(key)) {
            filtered[key] = obj[key];
          }
        }
        return filtered;
      };

      // Handle paginated responses: { data: [...], pagination: {...} }
      if (body && body.data) {
        if (Array.isArray(body.data)) {
          body.data = body.data.map(filterObj);
        } else if (typeof body.data === 'object') {
          body.data = filterObj(body.data);
        }
      }

      return originalJson(body);
    };

    next();
  };
}

module.exports = filterResponse;
