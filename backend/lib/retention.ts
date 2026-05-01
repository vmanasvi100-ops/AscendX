import cron from 'node-cron';
import { query } from '../db/client.js';
import { logAuditEvent } from './audit.js';

// ── CV Purge ────────────────────────────────────────────────────────────────
// Runs daily at 02:00. Deletes cv_text from sessions where cv_purge_date has passed.
// The session row remains — only the CV column is nulled out.

const purgeCVs = async (): Promise<void> => {
  try {
    const result = await query<{ id: string }>(
      `UPDATE sessions
       SET cv_text = NULL,
           purged_at = NOW()
       WHERE cv_purge_date <= NOW()
         AND cv_text IS NOT NULL
       RETURNING id`
    );

    if (result.rowCount && result.rowCount > 0) {
      console.log(`[RETENTION] CV purge: ${result.rowCount} session(s) purged.`);
      for (const row of result.rows) {
        await logAuditEvent({
          eventType: 'cv_purged',
          actor: 'system',
          sessionId: row.id,
          metadata: { reason: 'cv_purge_date exceeded (30 days)' },
        });
      }
    }
  } catch (err) {
    console.error('[RETENTION] CV purge failed:', err);
  }
};

// ── Session Expiry ──────────────────────────────────────────────────────────
// Runs daily at 02:30. Hard-deletes sessions past their 12-month retention_expiry.
// Logs each deletion before removing the row.

const expireSessions = async (): Promise<void> => {
  try {
    // Log first, then delete — so the audit trail is always present
    const expired = await query<{ id: string; participant_id: string }>(
      `SELECT id, participant_id FROM sessions
       WHERE retention_expiry <= NOW()
         AND purged_at IS NULL`
    );

    for (const row of expired.rows) {
      await logAuditEvent({
        eventType: 'session_expired',
        actor: 'system',
        participantId: row.participant_id,
        sessionId: row.id,
        metadata: { reason: 'retention_expiry exceeded (12 months)' },
      });
    }

    if (expired.rowCount && expired.rowCount > 0) {
      await query(
        `DELETE FROM sessions
         WHERE retention_expiry <= NOW()
           AND purged_at IS NULL`
      );
      console.log(`[RETENTION] Session expiry: ${expired.rowCount} session(s) deleted.`);
    }
  } catch (err) {
    console.error('[RETENTION] Session expiry failed:', err);
  }
};

// ── Scheduler ───────────────────────────────────────────────────────────────
export const startRetentionScheduler = (): void => {
  // CV purge — daily at 02:00
  cron.schedule('0 2 * * *', async () => {
    console.log('[RETENTION] Running CV purge...');
    await purgeCVs();
  });

  // Session expiry — daily at 02:30
  cron.schedule('30 2 * * *', async () => {
    console.log('[RETENTION] Running session expiry...');
    await expireSessions();
  });

  console.log('[RETENTION] Scheduler started — CV purge at 02:00, session expiry at 02:30 daily.');
};
