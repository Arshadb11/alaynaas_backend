const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');

// Custom format for structured logs
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create a daily-rotating file transport.
 * Logs go to: logs/YYYY-MM-DD/<filename>
 */
function createTransport(filename, level) {
  return new DailyRotateFile({
    dirname: path.join(logDir, '%DATE%'),
    filename: filename,
    datePattern: 'YYYY-MM-DD',
    level: level,
    maxSize: '20m',
    maxFiles: '90d',
    zippedArchive: true,
    format: structuredFormat,
  });
}

const logger = winston.createLogger({
  level: 'http',
  format: structuredFormat,
  transports: [
    createTransport('app.log', 'info'),
    createTransport('error.log', 'error'),
    createTransport('security.log', 'warn'),
    createTransport('access.log', 'http'),
  ],
  exceptionHandlers: [
    createTransport('exceptions.log', 'error'),
  ],
  rejectionHandlers: [
    createTransport('rejections.log', 'error'),
  ],
});

// Console output in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
      })
    ),
  }));
}

// Convenience methods
logger.security = (message, meta = {}) => {
  logger.warn(message, { category: 'security', ...meta });
};

logger.access = (message, meta = {}) => {
  logger.http(message, { category: 'access', ...meta });
};

module.exports = logger;
