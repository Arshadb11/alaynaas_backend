const winstonLogger = require('../config/winston');

/**
 * Global error handler middleware.
 * Must be registered last in the middleware chain.
 */
function errorHandler(err, req, res, _next) {
  // Log the error
  winstonLogger.error(err.message, {
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
  });

  // Store error message for request logger
  res._errorMessage = err.message;

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Don't leak stack traces in production
  const response = {
    error: err.message || 'Internal server error',
  };
  // A short, safe code the storefront can translate (set deliberately by services, never a DB code)
  if (err.publicCode) response.code = err.publicCode;

  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * Wrap async route handlers to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Custom error class with status code
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

module.exports = { errorHandler, asyncHandler, AppError };
