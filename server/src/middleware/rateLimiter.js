const { checkRateLimit } = require('../config/redis');
const config = require('../config/env');
const winstonLogger = require('../config/winston');

/**
 * Redis-backed rate limiter for login endpoint.
 * Limits by IP address.
 */
function loginRateLimiter() {
  return async (req, res, next) => {
    // Disable rate limiting in development
    if (config.nodeEnv === 'development') {
      return next();
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const key = `login:${ip}`;

    const { allowed, remaining, retryAfter } = await checkRateLimit(
      key,
      config.rateLimit.loginMaxAttempts,
      config.rateLimit.loginWindowMinutes * 60
    );

    res.set('X-RateLimit-Limit', String(config.rateLimit.loginMaxAttempts));
    res.set('X-RateLimit-Remaining', String(remaining));

    if (!allowed) {
      winstonLogger.security('Login rate limit exceeded', {
        ip,
        retryAfter,
      });

      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too many login attempts. Please try again later.',
        retryAfter,
      });
    }

    next();
  };
}

module.exports = { loginRateLimiter };
