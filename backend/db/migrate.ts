import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS = [
  '001_initial.sql',
  '002_analytics_events.sql',
];

export const runMigrations = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    for (const file of MIGRATIONS) {
      const sql = readFileSync(path.join(__dirname, '../migrations', file), 'utf-8');
      await client.query(sql);
      console.log(`[DB] Applied ${file}`);
    }
    console.log('[DB] All migrations applied.');
  } catch (err) {
    console.error('[DB] Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
};
