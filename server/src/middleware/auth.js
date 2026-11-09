const { verifyAccessToken } = require('../utils/jwt');
const { isTokenBlacklisted } = require('../config/redis');
const winstonLogger = require('../config/winston');

/**
 * JWT authentication middleware.
 * Verifies access token from Authorization header and checks Redis blacklist.
 */
function auth() {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access token required' });
      }

      const token = authHeader.split(' ')[1];

      // Verify JWT signature and expiry
      let decoded;
      try {
        decoded = verifyAccessToken(token);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: 'Invalid access token' });
      }

      // Check Redis blacklist
      const blacklisted = await isTokenBlacklisted(decoded.jti);
      if (blacklisted) {
        winstonLogger.security('Blacklisted token used', {
          userId: decoded.sub,
          jti: decoded.jti,
          ip: req.ip,
        });
        return res.status(401).json({ error: 'Token has been revoked' });
      }

      // Attach user info to request
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions || [],
        sessionId: decoded.sessionId,
        jti: decoded.jti,
        exp: decoded.exp,
      };

      next();
    } catch (err) {
      winstonLogger.error('Auth middleware error', { error: err.message });
      return res.status(500).json({ error: 'Authentication failed' });
    }
  };
}

module.exports = auth;
