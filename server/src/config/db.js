const mysql = require('mysql2/promise');
const config = require('./env');
const winstonLogger = require('./winston');

const useSsl = /^(true|1|yes)$/i.test(String(process.env.DB_SSL || '').trim().replace(/^["']|["']$/g, ''))
  || /\.tidbcloud\.com$/i.test(String(config.db.host).trim());

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  // Serverless runs many small instances, each with its own pool: keep it small there
  connectionLimit: parseInt(process.env.DB_POOL_LIMIT, 10) || (process.env.VERCEL ? 3 : 20),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Hosted MySQL (e.g. TiDB Cloud) requires an encrypted connection: DB_SSL=true (always on for TiDB Cloud hosts)
  ...(useSsl && { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } }),
});

// Test connection on startup
pool.getConnection()
  .then((conn) => {
    winstonLogger.info('MySQL connected', { host: config.db.host, database: config.db.database });
    conn.release();
  })
  .catch((err) => {
    winstonLogger.error('MySQL connection failed', { error: err.message });
  });

/**
 * Execute a parameterized query
 */
async function query(sql, params = []) {
  // Prepared statements reject "LIMIT ? OFFSET ?" on TiDB / MySQL 8.0.22+ ("Incorrect arguments to LIMIT").
  // For those, let mysql2 escape the values client-side instead (still injection-safe).
  const limitSlots = (sql.match(LIMIT_PLACEHOLDER) || []).length;
  if (!limitSlots) {
    const [rows] = await pool.execute(sql, params);
    return rows;
  }
  // LIMIT/OFFSET placeholders are the trailing params: force them to integers so they aren't quoted
  const fixed = params.map((p, i) => (i >= params.length - limitSlots ? parseInt(p, 10) || 0 : p));
  const [rows] = await pool.query(sql, fixed);
  return rows;
}
const LIMIT_PLACEHOLDER = /\b(?:LIMIT|OFFSET)\s+\?/gi;

/**
 * Insert a record and return insertId
 */
async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  const [result] = await pool.execute(sql, values);
  return result.insertId;
}

/**
 * Insert multiple records
 */
async function insertBatch(table, records) {
  if (!records.length) return;
  const keys = Object.keys(records[0]);
  const placeholders = records.map(() => `(${keys.map(() => '?').join(', ')})`).join(', ');
  const values = records.flatMap((r) => keys.map((k) => r[k]));
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES ${placeholders}`;
  const [result] = await pool.execute(sql, values);
  return result;
}

/**
 * Update a record by ID
 */
async function update(table, idOrData, dataOrWhere) {
  let id;
  let data;

  if (typeof idOrData === 'object' && idOrData !== null && typeof dataOrWhere === 'object' && dataOrWhere !== null && dataOrWhere.id !== undefined) {
    // Called as update(table, data, { id })
    data = idOrData;
    id = dataOrWhere.id;
  } else if (typeof idOrData === 'object' && idOrData !== null && (typeof dataOrWhere === 'number' || typeof dataOrWhere === 'string')) {
    // Called as update(table, data, id)
    data = idOrData;
    id = dataOrWhere;
  } else {
    // Canonical call: update(table, id, data)
    id = idOrData;
    data = dataOrWhere;
  }

  if (!data || typeof data !== 'object') return;
  const keys = Object.keys(data);
  if (!keys.length) return;
  const setClause = keys.map((k) => `\`${k}\` = ?`).join(', ');
  const values = [...Object.values(data), id];
  const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
  const [result] = await pool.execute(sql, values);
  return result;
}

/**
 * Get a single connection for transactions
 */
async function getConnection() {
  return pool.getConnection();
}

module.exports = { pool, query, insert, insertBatch, update, getConnection };
