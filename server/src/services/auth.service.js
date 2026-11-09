const db = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry, decodeToken } = require('../utils/jwt');
const { blacklistToken, trackSession, removeSession, clearAllSessions, getCachedPermissions, cachePermissions } = require('../config/redis');
const { parseUserAgent, getClientIp } = require('../utils/helpers');
const { randomUUID: uuidv4 } = require('crypto');
const loggerService = require('./logger.service');
const winstonLogger = require('../config/winston');

class AuthService {
  /**
   * Load user permissions from DB (or Redis cache)
   */
  async getUserPermissions(userId) {
    // Check Redis cache first
    const cached = await getCachedPermissions(userId);
    if (cached) return cached;

    const rows = await db.query(
      `SELECT CONCAT(p.module, '.', p.action) AS permission_key
       FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = ?`,
      [userId]
    );

    const permissions = rows.map((r) => r.permission_key);

    // Cache in Redis for 5 minutes
    await cachePermissions(userId, permissions);

    return permissions;
  }

  /**
   * Login: verify credentials, create session, issue tokens
   */
  async login(email, password, req) {
    // Find user
    const [user] = await db.query(
      'SELECT id, full_name, email, password_hash, role_id, is_active, avatar_url FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      await loggerService.logAction({
        action: 'LOGIN_FAILED',
        category: 'auth',
        status: 'failure',
        severity: 'warning',
        details: { reason: 'User not found', email },
        req,
      });
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
    }

    if (!user.is_active) {
      await loggerService.logAction({
        userId: user.id,
        userEmail: user.email,
        action: 'LOGIN_FAILED',
        category: 'auth',
        status: 'failure',
        severity: 'warning',
        details: { reason: 'Account disabled' },
        req,
      });
      throw Object.assign(new Error('Account has been disabled'), { statusCode: 403 });
    }

    // Verify password
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      await loggerService.logAction({
        userId: user.id,
        userEmail: user.email,
        action: 'LOGIN_FAILED',
        category: 'auth',
        status: 'failure',
        severity: 'warning',
        details: { reason: 'Wrong password' },
        req,
      });
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
    }

    // Get role name
    const [role] = await db.query('SELECT name FROM roles WHERE id = ?', [user.role_id]);

    // Get permissions
    const permissions = await this.getUserPermissions(user.id);

    // Create session
    const sessionId = `sess_${uuidv4()}`;
    const refreshToken = generateRefreshToken();
    const expiresAt = getRefreshTokenExpiry();
    const { browser, os, deviceType } = parseUserAgent(req.headers['user-agent']);
    const ip = getClientIp(req);

    // Generate access token
    const { token: accessToken, jti } = generateAccessToken({
      sub: user.id,
      email: user.email,
      role: role?.name || 'user',
      permissions,
      sessionId,
    });

    // Store session in DB
    await db.insert('user_sessions', {
      id: sessionId,
      user_id: user.id,
      refresh_token: refreshToken,
      access_token_jti: jti,
      device_type: deviceType,
      browser,
      os,
      ip_address: ip,
      location: '', // Can be derived from IP in the future
      expires_at: expiresAt.toISOString().slice(0, 19).replace('T', ' '),
    });

    // Track in Redis
    await trackSession(user.id, sessionId);

    // Update last_login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Audit log
    await loggerService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN_SUCCESS',
      category: 'auth',
      status: 'success',
      details: { browser, os, deviceType, sessionId },
      req,
    });

    return {
      accessToken,
      refreshToken,
      expiresAt,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: role?.name || 'user',
        avatarUrl: user.avatar_url,
        permissions,
      },
    };
  }

  /**
   * Refresh: validate refresh token, rotate tokens, update session
   */
  async refresh(refreshToken, req) {
    if (!refreshToken) {
      throw Object.assign(new Error('Refresh token required'), { statusCode: 401 });
    }

    // Find session by refresh token
    const [session] = await db.query(
      `SELECT s.*, u.full_name, u.email, u.is_active, u.role_id, u.avatar_url, r.name AS role_name
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE s.refresh_token = ? AND s.expires_at > NOW()`,
      [refreshToken]
    );

    if (!session) {
      winstonLogger.security('Invalid refresh token used', { ip: req.ip });
      throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
    }

    if (!session.is_active) {
      throw Object.assign(new Error('Account has been disabled'), { statusCode: 403 });
    }

    // Blacklist old access token if it exists
    if (session.access_token_jti) {
      // Give a generous TTL since we don't know exact expiry
      await blacklistToken(session.access_token_jti, Math.floor(Date.now() / 1000) + 900);
    }

    // Get fresh permissions
    const permissions = await this.getUserPermissions(session.user_id);

    // Generate new tokens
    const newRefreshToken = generateRefreshToken();
    const newExpiresAt = getRefreshTokenExpiry();
    const { token: newAccessToken, jti: newJti } = generateAccessToken({
      sub: session.user_id,
      email: session.email,
      role: session.role_name,
      permissions,
      sessionId: session.id,
    });

    // Rotate refresh token in DB
    const { browser, os, deviceType } = parseUserAgent(req.headers['user-agent']);
    const ip = getClientIp(req);

    await db.query(
      `UPDATE user_sessions SET
        refresh_token = ?, access_token_jti = ?,
        last_active_at = NOW(), expires_at = ?,
        ip_address = ?, browser = ?, os = ?, device_type = ?
       WHERE id = ?`,
      [newRefreshToken, newJti, newExpiresAt.toISOString().slice(0, 19).replace('T', ' '), ip, browser, os, deviceType, session.id]
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt,
      user: {
        id: session.user_id,
        fullName: session.full_name,
        email: session.email,
        role: session.role_name,
        avatarUrl: session.avatar_url,
        permissions,
      },
    };
  }

  /**
   * Logout: blacklist access token, delete session
   */
  async logout(user, req) {
    // Blacklist current access token
    if (user.jti && user.exp) {
      await blacklistToken(user.jti, user.exp);
    }

    // Delete session from DB
    if (user.sessionId) {
      await db.query('DELETE FROM user_sessions WHERE id = ?', [user.sessionId]);
      await removeSession(user.id, user.sessionId);
    }

    await loggerService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGOUT',
      category: 'auth',
      details: { sessionId: user.sessionId },
      req,
    });
  }

  /**
   * Logout all other devices: blacklist their tokens, delete their sessions, keep current session
   */
  async logoutAll(userId, currentSessionId, req) {
    let query = 'SELECT id, access_token_jti FROM user_sessions WHERE user_id = ?';
    const params = [userId];

    if (currentSessionId) {
      query += ' AND id != ?';
      params.push(currentSessionId);
    }

    const sessions = await db.query(query, params);

    // Blacklist access tokens for other sessions
    for (const session of sessions) {
      if (session.access_token_jti) {
        await blacklistToken(session.access_token_jti, Math.floor(Date.now() / 1000) + 900);
      }
      await removeSession(userId, session.id);
    }

    // Delete other sessions from DB
    if (currentSessionId) {
      await db.query('DELETE FROM user_sessions WHERE user_id = ? AND id != ?', [userId, currentSessionId]);
    } else {
      await db.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
      await clearAllSessions(userId);
    }

    await loggerService.logAction({
      userId,
      userEmail: req.user?.email,
      action: 'LOGOUT_OTHER_DEVICES',
      category: 'auth',
      severity: 'warning',
      details: {
        currentSessionId,
        sessionsTerminated: sessions.length,
      },
      req,
    });

    return { terminated: sessions.length };
  }

  /**
   * Get all active sessions for a user
   */
  async getSessions(userId, currentSessionId) {
    const sessions = await db.query(
      `SELECT id, device_type, browser, os, ip_address, location,
              last_active_at, created_at
       FROM user_sessions
       WHERE user_id = ? AND expires_at > NOW()
       ORDER BY last_active_at DESC`,
      [userId]
    );

    return sessions.map((s) => ({
      ...s,
      is_current: s.id === currentSessionId,
    }));
  }

  /**
   * Logout a specific session/device
   */
  async logoutSession(userId, sessionId, req) {
    const [session] = await db.query(
      'SELECT id, access_token_jti, browser, os FROM user_sessions WHERE id = ? AND user_id = ?',
      [sessionId, userId]
    );

    if (!session) {
      throw Object.assign(new Error('Session not found'), { statusCode: 404 });
    }

    // Blacklist its access token
    if (session.access_token_jti) {
      await blacklistToken(session.access_token_jti, Math.floor(Date.now() / 1000) + 900);
    }

    // Delete session
    await db.query('DELETE FROM user_sessions WHERE id = ?', [sessionId]);
    await removeSession(userId, sessionId);

    await loggerService.logAction({
      userId,
      userEmail: req.user?.email,
      action: 'LOGOUT_DEVICE',
      category: 'auth',
      details: { sessionId, browser: session.browser, os: session.os },
      req,
    });
  }

  /**
   * Get current user profile with permissions
   */
  async getMe(userId) {
    const [user] = await db.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.is_active,
              u.last_login, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [userId]
    );

    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    const permissions = await this.getUserPermissions(userId);

    return {
      ...user,
      fullName: user.full_name,
      avatarUrl: user.avatar_url,
      permissions,
    };
  }

  /**
   * Update profile (self-service)
   */
  async updateProfile(userId, { fullName, email, avatarUrl }, req) {
    const [currentUser] = await db.query('SELECT id, full_name, email, avatar_url FROM users WHERE id = ?', [userId]);
    if (!currentUser) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    const updates = {};
    if (fullName !== undefined) {
      const cleanName = (fullName || '').trim();
      if (!cleanName) {
        throw Object.assign(new Error('Full name cannot be empty'), { statusCode: 400 });
      }
      updates.full_name = cleanName;
    }

    if (email !== undefined) {
      const cleanEmail = (email || '').toLowerCase().trim();
      if (!cleanEmail) {
        throw Object.assign(new Error('Email cannot be empty'), { statusCode: 400 });
      }
      const existing = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [cleanEmail, userId]);
      if (existing.length > 0) {
        throw Object.assign(new Error('Email is already in use by another account'), { statusCode: 409 });
      }
      updates.email = cleanEmail;
    }

    if (avatarUrl !== undefined) {
      updates.avatar_url = avatarUrl ? avatarUrl.trim() : null;
    }

    if (Object.keys(updates).length > 0) {
      await db.update('users', userId, updates);

      await loggerService.logAction({
        userId,
        userEmail: updates.email || currentUser.email,
        action: 'UPDATE_PROFILE',
        category: 'user',
        targetType: 'user',
        targetId: userId,
        details: { fieldsUpdated: Object.keys(updates) },
        req,
      });
    }

    return this.getMe(userId);
  }

  /**
   * Change password (self-service)
   */
  async changePassword(userId, currentPassword, newPassword, req) {
    if (!currentPassword || !newPassword) {
      throw Object.assign(new Error('Current password and new password are required'), { statusCode: 400 });
    }

    if (newPassword.length < 8) {
      throw Object.assign(new Error('New password must be at least 8 characters'), { statusCode: 400 });
    }

    const [user] = await db.query('SELECT id, email, password_hash FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    const isValid = await comparePassword(currentPassword, user.password_hash);
    if (!isValid) {
      throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });
    }

    const newHash = await hashPassword(newPassword);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    await loggerService.logAction({
      userId,
      userEmail: user.email,
      action: 'CHANGE_PASSWORD',
      category: 'auth',
      severity: 'warning',
      req,
    });

    return { message: 'Password updated successfully' };
  }
}

module.exports = new AuthService();
