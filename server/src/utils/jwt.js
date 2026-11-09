const jwt = require('jsonwebtoken');
const { randomUUID: uuidv4 } = require('crypto');
const config = require('../config/env');

/**
 * Generate an access token with JTI for blacklisting
 */
function generateAccessToken(payload) {
  const jti = uuidv4();
  return {
    token: jwt.sign(
      { ...payload, jti },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiry }
    ),
    jti,
  };
}

/**
 * Verify and decode an access token
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

/**
 * Generate a refresh token (opaque UUID)
 */
function generateRefreshToken() {
  return uuidv4();
}

/**
 * Calculate expiry date for refresh token
 */
function getRefreshTokenExpiry() {
  const match = config.jwt.refreshExpiry.match(/^(\d+)([smhd])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 3600 * 1000); // default 7d

  const [, value, unit] = match;
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return new Date(Date.now() + parseInt(value) * multipliers[unit]);
}

/**
 * Decode token without verification (for extracting JTI on logout)
 */
function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  decodeToken,
};
