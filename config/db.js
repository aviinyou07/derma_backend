const mysql = require('mysql2/promise');

const {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_DATABASE,
  DB_PORT = 3306,
  DB_CONNECTION_LIMIT = 10,
  DB_QUEUE_LIMIT = 50,
  DB_CONNECT_TIMEOUT_MS = 10000,
  DB_ACQUIRE_TIMEOUT_MS = 10000
} = process.env;

/* =========================
   ENV VALIDATION
========================= */
if (!DB_HOST || !DB_USER || !DB_DATABASE) {
  throw new Error('Missing required DB environment variables');
}

/* =========================
   CREATE POOL
========================= */
const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  port: Number(DB_PORT),
  waitForConnections: true,
  connectionLimit: Number(DB_CONNECTION_LIMIT),
  queueLimit: Number(DB_QUEUE_LIMIT),
  connectTimeout: Number(DB_CONNECT_TIMEOUT_MS),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

/* =========================
   HEALTH STATE
========================= */
const health = {
  dbReady: false,
  lastCheckedAt: null,
  lastError: null
};

/* =========================
   TIMEOUT WRAPPER
========================= */
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

/* =========================
   TEST CONNECTION
========================= */
const testConnection = async ({ timeoutMs = Number(DB_CONNECT_TIMEOUT_MS) } = {}) => {
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
    if (connection) connection.release();
  }
};

/* =========================
   SIMPLE QUERY
========================= */
const query = async (sql, params = []) => {
  const start = Date.now();

  const [rows] = await pool.query(sql, params);

  const duration = Date.now() - start;

  if (duration > 500) {
    console.warn(`[DB] Slow query (${duration}ms): ${sql}`);
  }

  return rows;
};

/* =========================
   TRANSACTION
========================= */
const transaction = async (callback, { acquireTimeoutMs = Number(DB_ACQUIRE_TIMEOUT_MS) } = {}) => {
  let connection;

  try {
    connection = await withTimeout(
      pool.getConnection(),
      acquireTimeoutMs,
      `Timed out acquiring transaction connection after ${acquireTimeoutMs}ms`
    );

    await connection.beginTransaction();

    const result = await Promise.resolve(callback(connection));

    await connection.commit();
    return result;

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('[DB] rollback failed:', rollbackError);
      }
    }
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

/* =========================
   CLOSE POOL
========================= */
const closePool = async () => {
  await pool.end();
  health.dbReady = false;
};

/* =========================
   GRACEFUL SHUTDOWN
========================= */
process.on('SIGINT', async () => {
  console.log('[DB] Closing pool...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[DB] Closing pool...');
  await closePool();
  process.exit(0);
});

/* =========================
   EXPORTS
========================= */
module.exports = {
  query,
  transaction,
  testConnection,
  closePool,
  getPoolHealth: () => ({ ...health })
};