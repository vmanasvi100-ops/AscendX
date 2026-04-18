import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runMigrations = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    const sql = readFileSync(
      path.join(__dirname, '../migrations/001_initial.sql'),
      'utf-8'
    );
    await client.query(sql);
    console.log('[DB] Migrations applied successfully.');
  } catch (err) {
    console.error('[DB] Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
};
