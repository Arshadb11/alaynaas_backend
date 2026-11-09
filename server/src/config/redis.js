const Redis = require('ioredis');
const config = require('./env');
const winstonLogger = require('./winston');

const redisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 200, 5000),
  lazyConnect: true,
};

// Hosted Redis (e.g. Upstash) gives a single URL like rediss://default:pass@host:6379
const redis = config.redis.url
  ? new Redis(config.redis.url, redisOptions)
  : new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    ...redisOptions,
  });

redis.on('error', (err) => {
  winstonLogger.error('Redis connection error', { error: err.message });
});

redis.on('connect', () => {
  winstonLogger.info('Redis connected', { host: config.redis.host, port: config.redis.port });
});

// Connect on import
redis.connect().catch((err) => {
  winstonLogger.error('Redis initial connection failed', { error: err.message });
});

// ── Token Blacklist ─────────────────────────────────────
async function blacklistToken(jti, expiresAt) {
  try {
    const ttl = Math.max(1, Math.floor(expiresAt - Date.now() / 1000));
    await redis.set(`blacklist:${jti}`, '1', 'EX', ttl);
  } catch (err) {
    winstonLogger.error('Failed to blacklist token', { jti, error: err.message });
    throw err; // Fail secure
  }
}

async function isTokenBlacklisted(jti) {
  try {
    const result = await redis.get(`blacklist:${jti}`);
    return result === '1';
  } catch (err) {
    winstonLogger.error('Failed to check blacklist', { jti, error: err.message });
    return true; // Fail secure — treat as blacklisted
  }
}

// ── Permission Cache ────────────────────────────────────
async function getCachedPermissions(userId) {
  try {
    const cached = await redis.get(`perms:user:${userId}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

async function cachePermissions(userId, permissions) {
  try {
    await redis.set(`perms:user:${userId}`, JSON.stringify(permissions), 'EX', 300);
  } catch {
    // Non-critical — will query DB next time
  }
}

async function invalidatePermissions(userId) {
  try {
    await redis.del(`perms:user:${userId}`);
  } catch {
    // Non-critical
  }
}

// ── Rate Limiting ───────────────────────────────────────
async function checkRateLimit(key, maxAttempts, windowSec) {
  try {
    const redisKey = `ratelimit:${key}`;
    const current = await redis.incr(redisKey);
    if (current === 1) {
      await redis.expire(redisKey, windowSec);
    }
    const ttl = await redis.ttl(redisKey);
    return {
      allowed: current <= maxAttempts,
      remaining: Math.max(0, maxAttempts - current),
      retryAfter: ttl,
    };
  } catch (err) {
    winstonLogger.error('Rate limit check failed', { key, error: err.message });
    return { allowed: true, remaining: maxAttempts, retryAfter: 0 }; // Fail open
  }
}

// ── Session Tracking ────────────────────────────────────
async function trackSession(userId, sessionId) {
  try {
    await redis.sadd(`session:user:${userId}`, sessionId);
    await redis.expire(`session:user:${userId}`, 7 * 24 * 3600); // 7 days
  } catch {
    // Non-critical
  }
}

async function removeSession(userId, sessionId) {
  try {
    await redis.srem(`session:user:${userId}`, sessionId);
  } catch {
    // Non-critical
  }
}

async function getUserSessions(userId) {
  try {
    return await redis.smembers(`session:user:${userId}`);
  } catch {
    return [];
  }
}

async function clearAllSessions(userId) {
  try {
    await redis.del(`session:user:${userId}`);
  } catch {
    // Non-critical
  }
}

module.exports = {
  redis,
  blacklistToken,
  isTokenBlacklisted,
  getCachedPermissions,
  cachePermissions,
  invalidatePermissions,
  checkRateLimit,
  trackSession,
  removeSession,
  getUserSessions,
  clearAllSessions,
};
