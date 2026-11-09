const db = require('../config/db');
const { hashPassword } = require('../utils/password');
const { invalidatePermissions } = require('../config/redis');
const loggerService = require('./logger.service');

class UserService {
  /**
   * List all users (paginated, searchable)
   */
  async listUsers({ page = 1, limit = 20, search = '', roleId = null }) {
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ' AND (u.full_name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (roleId) {
      where += ' AND u.role_id = ?';
      params.push(roleId);
    }

    const [countResult] = await db.query(
      `SELECT COUNT(*) AS total FROM users u ${where}`,
      params
    );

    const users = await db.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.is_active,
              u.last_login, u.created_at, r.name AS role,
              (SELECT COUNT(*) FROM user_permissions WHERE user_id = u.id) AS permission_count
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      data: users,
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit),
      },
    };
  }

  /**
   * Get a single user with their permissions
   */
  async getUserById(userId) {
    const [user] = await db.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.is_active,
              u.role_id, u.last_login, u.created_at, u.updated_at, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [userId]
    );

    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    // Get permissions
    const permissions = await db.query(
      `SELECT p.id, CONCAT(p.module, '.', p.action) AS permission_key,
              p.module, p.action, p.description,
              up.granted_by, up.granted_at,
              g.full_name AS granted_by_name
       FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
       LEFT JOIN users g ON g.id = up.granted_by
       WHERE up.user_id = ?
       ORDER BY p.module, p.action`,
      [userId]
    );

    return { ...user, permissions };
  }

  /**
   * Create a new user
   */
  async createUser(data, grantedBy, req) {
    // Check if email already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [data.email]);
    if (existing) {
      throw Object.assign(new Error('Email already in use'), { statusCode: 409 });
    }

    const passwordHash = await hashPassword(data.password);

    const userId = await db.insert('users', {
      full_name: data.fullName,
      email: data.email,
      password_hash: passwordHash,
      role_id: data.roleId,
      avatar_url: data.avatarUrl || null,
      is_active: data.isActive !== undefined ? data.isActive : true,
    });

    // Assign permissions if provided
    if (data.permissions && data.permissions.length > 0) {
      await this.setUserPermissions(userId, data.permissions, grantedBy, req);
    }

    await loggerService.logAction({
      userId: grantedBy,
      userEmail: req.user?.email,
      action: 'CREATE_USER',
      category: 'user_mgmt',
      targetType: 'user',
      targetId: userId,
      targetLabel: data.fullName,
      details: { email: data.email, roleId: data.roleId, permissionCount: data.permissions?.length || 0 },
      req,
    });

    return this.getUserById(userId);
  }

  /**
   * Update user info
   */
  async updateUser(userId, data, updatedBy, req) {
    const oldUser = await this.getUserById(userId);

    const updates = {};
    if (data.fullName !== undefined) updates.full_name = data.fullName;
    if (data.email !== undefined) updates.email = data.email;
    if (data.roleId !== undefined) updates.role_id = data.roleId;
    if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl;
    if (data.password) updates.password_hash = await hashPassword(data.password);

    if (Object.keys(updates).length === 0) {
      throw Object.assign(new Error('No fields to update'), { statusCode: 400 });
    }

    const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    await db.query(
      `UPDATE users SET ${setClauses} WHERE id = ?`,
      [...Object.values(updates), userId]
    );

    const auditId = await loggerService.logAction({
      userId: updatedBy,
      userEmail: req.user?.email,
      action: 'UPDATE_USER',
      category: 'user_mgmt',
      targetType: 'user',
      targetId: userId,
      targetLabel: oldUser.full_name,
      req,
    });

    // Log field changes
    const newUser = await this.getUserById(userId);
    await loggerService.logFieldChanges(auditId, oldUser, {
      full_name: newUser.full_name,
      email: newUser.email,
      role: newUser.role,
      avatar_url: newUser.avatar_url,
    }, ['full_name', 'email', 'role', 'avatar_url']);

    return newUser;
  }

  /**
   * Toggle user active status
   */
  async toggleActive(userId, updatedBy, req) {
    const [user] = await db.query('SELECT id, full_name, is_active FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    const newStatus = !user.is_active;
    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);

    await loggerService.logAction({
      userId: updatedBy,
      userEmail: req.user?.email,
      action: newStatus ? 'ENABLE_USER' : 'DISABLE_USER',
      category: 'user_mgmt',
      targetType: 'user',
      targetId: userId,
      targetLabel: user.full_name,
      severity: newStatus ? 'info' : 'warning',
      req,
    });

    return { id: userId, is_active: newStatus };
  }

  /**
   * Delete user (soft — set inactive)
   */
  async deleteUser(userId, deletedBy, req) {
    const [user] = await db.query('SELECT id, full_name, email FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    await db.query('UPDATE users SET is_active = FALSE WHERE id = ?', [userId]);

    await loggerService.logAction({
      userId: deletedBy,
      userEmail: req.user?.email,
      action: 'DELETE_USER',
      category: 'user_mgmt',
      targetType: 'user',
      targetId: userId,
      targetLabel: user.full_name,
      severity: 'warning',
      req,
    });

    return { id: userId, deleted: true };
  }

  /**
   * Get user's permissions
   */
  async getUserPermissions(userId) {
    return db.query(
      `SELECT p.id, CONCAT(p.module, '.', p.action) AS permission_key,
              p.module, p.action, p.description,
              up.granted_by, up.granted_at,
              g.full_name AS granted_by_name
       FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
       LEFT JOIN users g ON g.id = up.granted_by
       WHERE up.user_id = ?
       ORDER BY p.module, p.action`,
      [userId]
    );
  }

  /**
   * Set user permissions (replaces all existing)
   */
  async setUserPermissions(userId, permissionKeys, grantedBy, req) {
    // Validate permission keys exist
    if (permissionKeys.length === 0) {
      await db.query('DELETE FROM user_permissions WHERE user_id = ?', [userId]);
      await invalidatePermissions(userId);
      return [];
    }

    // Get permission IDs
    const placeholders = permissionKeys.map(() => '?').join(', ');
    const permRows = await db.query(
      `SELECT id, CONCAT(module, '.', action) AS permission_key
       FROM permissions
       WHERE CONCAT(module, '.', action) IN (${placeholders})`,
      permissionKeys
    );

    const permMap = new Map(permRows.map((r) => [r.permission_key, r.id]));

    // Get old permissions for diff logging
    const oldPerms = await db.query(
      `SELECT CONCAT(p.module, '.', p.action) AS permission_key
       FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = ?`,
      [userId]
    );
    const oldPermKeys = oldPerms.map((p) => p.permission_key);

    // Replace all permissions
    await db.query('DELETE FROM user_permissions WHERE user_id = ?', [userId]);

    const records = [];
    for (const key of permissionKeys) {
      const permId = permMap.get(key);
      if (permId) {
        records.push({
          user_id: userId,
          permission_id: permId,
          granted_by: grantedBy,
        });
      }
    }

    if (records.length > 0) {
      await db.insertBatch('user_permissions', records);
    }

    // Invalidate Redis cache
    await invalidatePermissions(userId);

    // Log changes
    const added = permissionKeys.filter((k) => !oldPermKeys.includes(k));
    const removed = oldPermKeys.filter((k) => !permissionKeys.includes(k));

    if (added.length > 0 || removed.length > 0) {
      await loggerService.logAction({
        userId: grantedBy,
        userEmail: req?.user?.email,
        action: 'UPDATE_PERMISSIONS',
        category: 'permission',
        targetType: 'user',
        targetId: userId,
        details: { added, removed, total: permissionKeys.length },
        req,
      });
    }

    return records;
  }

  /**
   * Apply a role preset to a user
   */
  async applyPreset(userId, roleId, grantedBy, req) {
    // Get preset permissions
    const presetPerms = await db.query(
      `SELECT CONCAT(p.module, '.', p.action) AS permission_key
       FROM role_permission_presets rpp
       JOIN permissions p ON p.id = rpp.permission_id
       WHERE rpp.role_id = ?`,
      [roleId]
    );

    const permKeys = presetPerms.map((p) => p.permission_key);

    // Also update role label
    await db.query('UPDATE users SET role_id = ? WHERE id = ?', [roleId, userId]);

    // Set permissions
    await this.setUserPermissions(userId, permKeys, grantedBy, req);

    await loggerService.logAction({
      userId: grantedBy,
      userEmail: req.user?.email,
      action: 'APPLY_PRESET',
      category: 'permission',
      targetType: 'user',
      targetId: userId,
      details: { roleId, permissionCount: permKeys.length },
      req,
    });

    return this.getUserById(userId);
  }
}

module.exports = new UserService();
