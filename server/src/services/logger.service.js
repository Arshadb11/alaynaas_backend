const db = require('../config/db');
const winstonLogger = require('../config/winston');

class LoggerService {
  /**
   * Log a user action to audit_logs table + Winston
   */
  async logAction({
    source = 'admin_panel',
    userId,
    userEmail,
    action,
    category,
    targetType,
    targetId,
    targetLabel,
    status = 'success',
    severity = 'info',
    details = {},
    req,
  }) {
    try {
      const auditId = await db.insert('audit_logs', {
        source,
        user_id: userId || null,
        user_email: userEmail || null,
        action,
        category,
        target_type: targetType || null,
        target_id: targetId ? String(targetId) : null,
        target_label: targetLabel || null,
        status,
        severity,
        details: JSON.stringify(details),
        ip_address: req?.ip || null,
        user_agent: req?.headers?.['user-agent']?.substring(0, 500) || null,
        session_id: req?.user?.sessionId || null,
      });

      // Also log to Winston
      const logFn = severity === 'critical' ? 'error' : severity === 'warning' ? 'warn' : 'info';
      winstonLogger[logFn](`AUDIT: ${action}`, {
        auditId,
        source,
        userId,
        userEmail,
        action,
        category,
        targetType,
        targetId,
        status,
      });

      return auditId;
    } catch (err) {
      winstonLogger.error('Failed to write audit log', { error: err.message, action });
      return null;
    }
  }

  /**
   * Log field-level changes (before/after diffs)
   */
  async logFieldChanges(auditLogId, oldRecord, newRecord, trackedFields) {
    if (!auditLogId) return [];

    try {
      const changes = [];
      for (const field of trackedFields) {
        const oldVal = oldRecord?.[field];
        const newVal = newRecord?.[field];
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          changes.push({
            audit_log_id: auditLogId,
            field_name: field,
            old_value: oldVal != null ? String(oldVal) : null,
            new_value: newVal != null ? String(newVal) : null,
          });
        }
      }

      if (changes.length > 0) {
        await db.insertBatch('field_change_logs', changes);
      }

      return changes;
    } catch (err) {
      winstonLogger.error('Failed to log field changes', { error: err.message, auditLogId });
      return [];
    }
  }

  /**
   * Log a denied access attempt
   */
  async logDenied({ userId, userEmail, action, targetType, targetId, reason, req }) {
    return this.logAction({
      userId,
      userEmail,
      action,
      category: 'auth',
      targetType,
      targetId,
      status: 'denied',
      severity: 'warning',
      details: { reason, strippedFields: req?._strippedFields },
      req,
    });
  }
}

module.exports = new LoggerService();
