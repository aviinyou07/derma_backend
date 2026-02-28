const mysql = require('mysql2/promise');

const DEFAULT_DB_CONNECT_TIMEOUT_MS = Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000);
const DEFAULT_DB_ACQUIRE_TIMEOUT_MS = Number(process.env.DB_ACQUIRE_TIMEOUT_MS || 10000);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: Number(process.env.DB_QUEUE_LIMIT || 50),
  connectTimeout: DEFAULT_DB_CONNECT_TIMEOUT_MS,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

const health = {
  dbReady: false,
  lastCheckedAt: null,
  lastError: null
};

const withTimeout = async (promise, timeoutMs, message) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const testConnection = async ({ timeoutMs = DEFAULT_DB_CONNECT_TIMEOUT_MS } = {}) => {
  let connection;
  try {
    connection = await withTimeout(
      pool.getConnection(),
      timeoutMs,
      `Timed out acquiring DB connection after ${timeoutMs}ms`
    );
    await connection.ping();

    health.dbReady = true;
    health.lastCheckedAt = new Date().toISOString();
    health.lastError = null;
    return true;
  } catch (error) {
    health.dbReady = false;
    health.lastCheckedAt = new Date().toISOString();
    health.lastError = error?.message || 'Unknown DB connectivity error';
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const initializeDatabase = async () => {
  await testConnection();
};

const query = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};

const transaction = async (callback, { acquireTimeoutMs = DEFAULT_DB_ACQUIRE_TIMEOUT_MS } = {}) => {
  let connection;
  try {
    connection = await withTimeout(
      pool.getConnection(),
      acquireTimeoutMs,
      `Timed out acquiring transaction connection after ${acquireTimeoutMs}ms`
    );
    await connection.beginTransaction();

    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('[DB] rollback failed', rollbackError);
      }
    }
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const closePool = async () => {
  await pool.end();
  health.dbReady = false;
};

const getPoolHealth = () => ({ ...health });

module.exports = {
  query,
  transaction,
  testConnection,
  initializeDatabase,
  closePool,
  getPoolHealth
};
