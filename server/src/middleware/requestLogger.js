const db = require('../config/db');
const winstonLogger = require('../config/winston');

/**
 * Middleware that logs every API request to MySQL + Winston access.log
 */
function requestLogger(source = 'admin_panel') {
  return (req, res, next) => {
    const start = Date.now();

    // Capture on response finish
    res.on('finish', async () => {
      const duration = Date.now() - start;

      // Skip health checks
      if (req.path === '/api/health') return;

      // Log to Winston access file
      winstonLogger.access(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        userId: req.user?.id,
        ip: req.ip,
      });

      // Log to MySQL (async, non-blocking)
      try {
        // Sanitize body — remove sensitive data
        let sanitizedBody = null;
        if (req.body && Object.keys(req.body).length > 0) {
          sanitizedBody = { ...req.body };
          delete sanitizedBody.password;
          delete sanitizedBody.password_hash;
          delete sanitizedBody.token;
          delete sanitizedBody.refreshToken;
          sanitizedBody = JSON.stringify(sanitizedBody);
        }

        await db.insert('api_request_logs', {
          source,
          method: req.method,
          path: req.originalUrl.substring(0, 500),
          status_code: res.statusCode,
          user_id: req.user?.id || null,
          ip_address: req.ip,
          user_agent: (req.headers['user-agent'] || '').substring(0, 500),
          request_body: sanitizedBody,
          response_time_ms: duration,
          error_message: res.statusCode >= 400 ? (res._errorMessage || null) : null,
        });
      } catch (err) {
        // Non-critical — don't crash the request
        winstonLogger.error('Failed to log request to DB', { error: err.message });
      }
    });

    next();
  };
}

module.exports = requestLogger;
