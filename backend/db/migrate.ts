import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS = [
  '001_initial.sql',
  '002_analytics_events.sql',
  '003_participant_snapshots.sql',
  '004_registered_participants.sql',
  '005_domain_type.sql',
  '006_nda_consent.sql',
  '007_participant_id.sql',
  '008_session_history.sql',
  '009_coaching_threads.sql',
  '010_cv_alignment.sql',
  '011_cv_alignment_participant.sql',
  '012_coaching_threads_participant.sql',
  '013_cv_file_uploads.sql',
  '014_cv_file_storage_path.sql',
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
