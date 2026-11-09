const countryService = require('../services/country.service');

/**
 * Middleware: injects req.allowedCountryIds
 * 
 * If user has countries.manage → null (all countries)
 * Otherwise → array of assigned country IDs from user_countries
 * 
 * Use in product/order routes to scope data by country.
 */
function filterByCountryAccess() {
  return async (req, res, next) => {
    try {
      if (req.user.permissions.includes('countries.manage')) {
        req.allowedCountryIds = null; // null = ALL countries
        return next();
      }

      const ids = await countryService.getUserCountryIds(req.user.id);
      req.allowedCountryIds = ids;

      // If a specific country filter is requested, validate access
      const requestedCountry = req.query.country_id || req.body?.country_id;
      if (requestedCountry) {
        const countryId = parseInt(requestedCountry);
        if (!ids.includes(countryId)) {
          return res.status(403).json({
            error: 'You do not have access to this country\'s data',
          });
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: require access to a specific country (from req.params.countryId)
 */
function requireCountryAccess() {
  return async (req, res, next) => {
    try {
      if (req.user.permissions.includes('countries.manage')) {
        return next();
      }

      const countryId = parseInt(req.params.countryId || req.params.id);
      const hasAccess = await countryService.userHasCountryAccess(req.user.id, countryId);

      if (!hasAccess) {
        return res.status(403).json({
          error: 'You do not have access to this country',
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { filterByCountryAccess, requireCountryAccess };
