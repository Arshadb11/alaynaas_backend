const UAParser = require('ua-parser-js');

/**
 * Parse User-Agent string into device info
 */
function parseUserAgent(uaString) {
  const parser = new UAParser(uaString);
  const result = parser.getResult();

  const browser = result.browser.name
    ? `${result.browser.name} ${result.browser.version || ''}`.trim()
    : 'Unknown Browser';

  const os = result.os.name
    ? `${result.os.name} ${result.os.version || ''}`.trim()
    : 'Unknown OS';

  let deviceType = 'desktop';
  if (result.device.type === 'mobile') deviceType = 'mobile';
  else if (result.device.type === 'tablet') deviceType = 'tablet';

  return { browser, os, deviceType };
}

/**
 * Get client IP from request
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

module.exports = { parseUserAgent, getClientIp };
