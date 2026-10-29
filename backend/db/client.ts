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
  // SSL based on the target host, not NODE_ENV — a hosted database (Supabase or otherwise)
  // expects/requires TLS regardless of whether this is a local dev run or a deployed one; only a
  // genuinely local Postgres (localhost/127.0.0.1) has no real use for it. Previously this was
  // gated on NODE_ENV === 'production' alone, which would have left a remote DATABASE_URL
  // unencrypted during local development.
  const dbHost = (() => {
    try { return new URL(process.env.DATABASE_URL!).hostname; } catch { return ''; }
  })();
  const isLocalHost = dbHost === 'localhost' || dbHost === '127.0.0.1' || dbHost === '';

  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocalHost ? false : { rejectUnauthorized: false },
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
