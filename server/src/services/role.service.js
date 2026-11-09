const db = require('../config/db');
const loggerService = require('./logger.service');

class RoleService {
  /**
   * List all roles with permission counts
   */
  async listRoles() {
    return db.query(
      `SELECT r.*, 
              (SELECT COUNT(*) FROM role_permission_presets WHERE role_id = r.id) AS preset_permission_count,
              (SELECT COUNT(*) FROM users WHERE role_id = r.id) AS user_count
       FROM roles r
       ORDER BY r.id`
    );
  }

  /**
   * Get role with full preset permissions
   */
  async getRoleById(roleId) {
    const [role] = await db.query('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (!role) {
      throw Object.assign(new Error('Role not found'), { statusCode: 404 });
    }

    const permissions = await db.query(
      `SELECT p.id, CONCAT(p.module, '.', p.action) AS permission_key,
              p.module, p.action, p.description
       FROM role_permission_presets rpp
       JOIN permissions p ON p.id = rpp.permission_id
       WHERE rpp.role_id = ?
       ORDER BY p.module, p.action`,
      [roleId]
    );

    return { ...role, permissions };
  }

  /**
   * Create a new role preset
   */
  async createRole(data, createdBy, req) {
    const roleId = await db.insert('roles', {
      name: data.name,
      description: data.description || null,
      is_system: false,
    });

    // Add preset permissions
    if (data.permissions && data.permissions.length > 0) {
      const placeholders = data.permissions.map(() => '?').join(', ');
      const perms = await db.query(
        `SELECT id FROM permissions WHERE CONCAT(module, '.', action) IN (${placeholders})`,
        data.permissions
      );

      if (perms.length > 0) {
        const records = perms.map((p) => ({
          role_id: roleId,
          permission_id: p.id,
        }));
        await db.insertBatch('role_permission_presets', records);
      }
    }

    await loggerService.logAction({
      userId: createdBy,
      userEmail: req.user?.email,
      action: 'CREATE_ROLE',
      category: 'permission',
      targetType: 'role',
      targetId: roleId,
      targetLabel: data.name,
      req,
    });

    return this.getRoleById(roleId);
  }

  /**
   * Update role preset
   */
  async updateRole(roleId, data, updatedBy, req) {
    const [role] = await db.query('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (!role) {
      throw Object.assign(new Error('Role not found'), { statusCode: 404 });
    }

    if (data.name) await db.query('UPDATE roles SET name = ? WHERE id = ?', [data.name, roleId]);
    if (data.description !== undefined) await db.query('UPDATE roles SET description = ? WHERE id = ?', [data.description, roleId]);

    // Update preset permissions
    if (data.permissions) {
      await db.query('DELETE FROM role_permission_presets WHERE role_id = ?', [roleId]);

      if (data.permissions.length > 0) {
        const placeholders = data.permissions.map(() => '?').join(', ');
        const perms = await db.query(
          `SELECT id FROM permissions WHERE CONCAT(module, '.', action) IN (${placeholders})`,
          data.permissions
        );

        if (perms.length > 0) {
          const records = perms.map((p) => ({
            role_id: roleId,
            permission_id: p.id,
          }));
          await db.insertBatch('role_permission_presets', records);
        }
      }
    }

    await loggerService.logAction({
      userId: updatedBy,
      userEmail: req.user?.email,
      action: 'UPDATE_ROLE',
      category: 'permission',
      targetType: 'role',
      targetId: roleId,
      targetLabel: role.name,
      req,
    });

    return this.getRoleById(roleId);
  }

  /**
   * Delete role (only if not system and no users assigned)
   */
  async deleteRole(roleId, deletedBy, req) {
    const [role] = await db.query('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (!role) throw Object.assign(new Error('Role not found'), { statusCode: 404 });
    if (role.is_system) throw Object.assign(new Error('Cannot delete system role'), { statusCode: 403 });

    const [userCount] = await db.query('SELECT COUNT(*) AS count FROM users WHERE role_id = ?', [roleId]);
    if (userCount.count > 0) {
      throw Object.assign(new Error(`Cannot delete role: ${userCount.count} users are assigned to it`), { statusCode: 409 });
    }

    await db.query('DELETE FROM roles WHERE id = ?', [roleId]);

    await loggerService.logAction({
      userId: deletedBy,
      userEmail: req.user?.email,
      action: 'DELETE_ROLE',
      category: 'permission',
      targetType: 'role',
      targetId: roleId,
      targetLabel: role.name,
      severity: 'warning',
      req,
    });

    return { id: roleId, deleted: true };
  }

  /**
   * Get all permissions grouped by module
   */
  async getAllPermissions() {
    const perms = await db.query(
      'SELECT id, module, action, description, CONCAT(module, \'.\', action) AS permission_key FROM permissions ORDER BY module, action'
    );

    // Group by module
    const grouped = {};
    for (const p of perms) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }

    return { flat: perms, grouped };
  }
}

module.exports = new RoleService();
