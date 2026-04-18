import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Lazy initialisation — pool is only created when DATABASE_URL is present.
// If missing, the server still starts and serves the frontend; API routes
// return 503 until a database is configured.

let _pool: pg.Pool | null = null;

const getPool = (): pg.Pool => {
  if (_pool) return _pool;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in .env — backend API unavailable.');
  }
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  _pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err);
  });
  return _pool;
};

export const pool = new Proxy({} as pg.Pool, {
  get: (_, prop) => (getPool() as any)[prop],
});

export const query = <T = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> => getPool().query<T>(text, params);
