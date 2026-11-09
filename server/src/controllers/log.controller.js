const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

const getAuditLogs = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 50, userId, action, category,
    severity, source, startDate, endDate,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE 1=1';
  const params = [];

  if (userId) { where += ' AND a.user_id = ?'; params.push(parseInt(userId)); }
  if (action) { where += ' AND a.action = ?'; params.push(action); }
  if (category) { where += ' AND a.category = ?'; params.push(category); }
  if (severity) { where += ' AND a.severity = ?'; params.push(severity); }
  if (source) { where += ' AND a.source = ?'; params.push(source); }
  if (startDate) { where += ' AND a.created_at >= ?'; params.push(startDate); }
  if (endDate) { where += ' AND a.created_at <= ?'; params.push(endDate); }

  const [countResult] = await db.query(
    `SELECT COUNT(*) AS total FROM audit_logs a ${where}`, params
  );

  const logs = await db.query(
    `SELECT a.*, u.full_name AS user_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  res.json({
    data: logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / parseInt(limit)),
    },
  });
});

const getAuditLogById = asyncHandler(async (req, res) => {
  const [log] = await db.query(
    `SELECT a.*, u.full_name AS user_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.id = ?`,
    [parseInt(req.params.id)]
  );

  if (!log) {
    return res.status(404).json({ error: 'Log entry not found' });
  }

  // Get field changes
  const fieldChanges = await db.query(
    'SELECT * FROM field_change_logs WHERE audit_log_id = ?',
    [log.id]
  );

  res.json({ data: { ...log, fieldChanges } });
});

const getRequestLogs = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 50, method, statusCode,
    source, userId, startDate, endDate,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE 1=1';
  const params = [];

  if (method) { where += ' AND r.method = ?'; params.push(method); }
  if (statusCode) { where += ' AND r.status_code = ?'; params.push(parseInt(statusCode)); }
  if (source) { where += ' AND r.source = ?'; params.push(source); }
  if (userId) { where += ' AND r.user_id = ?'; params.push(parseInt(userId)); }
  if (startDate) { where += ' AND r.created_at >= ?'; params.push(startDate); }
  if (endDate) { where += ' AND r.created_at <= ?'; params.push(endDate); }

  const [countResult] = await db.query(
    `SELECT COUNT(*) AS total FROM api_request_logs r ${where}`, params
  );

  const logs = await db.query(
    `SELECT r.*, u.full_name AS user_name
     FROM api_request_logs r
     LEFT JOIN users u ON u.id = r.user_id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  res.json({
    data: logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / parseInt(limit)),
    },
  });
});

module.exports = { getAuditLogs, getAuditLogById, getRequestLogs };
