import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logAuditEvent } from '../lib/audit.js';

const router = Router();

// Encrypted config fields — these are encrypted before insert, decrypted on read
const ENCRYPTED_FIELDS = ['company_name', 'target_role', 'job_description', 'cv_text'] as const;

// ── POST /api/sessions ───────────────────────────────────────────────────────
// Creates a new session. Called when the candidate starts an interview.

router.post('/', async (req: Request, res: Response) => {
  const {
    participantId,
    consentId,
    companyName,
    targetRole,
    jobDescription,
    cvText,
    settings,
    questions,
  } = req.body;

  if (!participantId) {
    return res.status(400).json({ error: 'participantId is required.' });
  }

  const now = new Date();
  const cvPurgeDate = new Date(now);
  cvPurgeDate.setDate(cvPurgeDate.getDate() + 30);     // CV purged after 30 days

  const retentionExpiry = new Date(now);
  retentionExpiry.setFullYear(retentionExpiry.getFullYear() + 1); // Session expires after 12 months

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO sessions
         (participant_id, consent_id,
          company_name, target_role, job_description, cv_text,
          cv_purge_date, settings, questions,
          retention_expiry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        participantId,
        consentId ?? null,
        companyName ? encrypt(companyName) : null,
        targetRole ? encrypt(targetRole) : null,
        jobDescription ? encrypt(jobDescription) : null,
        cvText ? encrypt(cvText) : null,
        cvPurgeDate.toISOString(),
        JSON.stringify(settings ?? {}),
        JSON.stringify(questions ?? []),
        retentionExpiry.toISOString(),
      ]
    );

    const sessionId = result.rows[0].id;

    await logAuditEvent({
      eventType: 'session_created',
      actor: 'participant',
      participantId,
      sessionId,
      metadata: { hasCV: !!cvText, hasJD: !!jobDescription },
    });

    return res.status(201).json({ sessionId });
  } catch (err) {
    console.error('[SESSIONS] Create failed:', err);
    return res.status(500).json({ error: 'Failed to create session.' });
  }
});

// ── GET /api/sessions/:participantId ─────────────────────────────────────────
// Returns all sessions for a participant — for the "resume" feature on return visits.
// CV and JD text are NOT returned here (minimisation). Only metadata and config labels.

router.get('/:participantId', async (req: Request, res: Response) => {
  const { participantId } = req.params;

  try {
    const result = await query(
      `SELECT id, created_at, completed_at, status,
              company_name, target_role,
              current_question_index, questions_completed,
              questions, settings,
              cv_purge_date, retention_expiry, purged_at
       FROM sessions
       WHERE participant_id = $1
       ORDER BY created_at DESC`,
      [participantId]
    );

    // Decrypt only the display labels (company + role) — not CV or JD
    const sessions = result.rows.map((row) => ({
      ...row,
      company_name: row.company_name ? decrypt(row.company_name) : null,
      target_role: row.target_role ? decrypt(row.target_role) : null,
    }));

    await logAuditEvent({
      eventType: 'data_accessed',
      actor: 'participant',
      participantId,
      metadata: { resource: 'sessions_list', count: result.rowCount },
    });

    return res.status(200).json({ sessions });
  } catch (err) {
    console.error('[SESSIONS] List failed:', err);
    return res.status(500).json({ error: 'Failed to fetch sessions.' });
  }
});

// ── GET /api/sessions/:participantId/:sessionId ───────────────────────────────
// Returns a single session with decrypted config — for resuming a session.

router.get('/:participantId/:sessionId', async (req: Request, res: Response) => {
  const { participantId, sessionId } = req.params;

  try {
    const result = await query(
      `SELECT * FROM sessions
       WHERE id = $1 AND participant_id = $2
       LIMIT 1`,
      [sessionId, participantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const row = result.rows[0];

    // Decrypt all sensitive fields
    const session = {
      ...row,
      company_name: row.company_name ? decrypt(row.company_name) : null,
      target_role: row.target_role ? decrypt(row.target_role) : null,
      job_description: row.job_description ? decrypt(row.job_description) : null,
      cv_text: row.cv_text ? decrypt(row.cv_text) : null,
    };

    await logAuditEvent({
      eventType: 'data_accessed',
      actor: 'participant',
      participantId,
      sessionId,
      metadata: { resource: 'session_detail' },
    });

    return res.status(200).json({ session });
  } catch (err) {
    console.error('[SESSIONS] Get failed:', err);
    return res.status(500).json({ error: 'Failed to fetch session.' });
  }
});

// ── PATCH /api/sessions/:sessionId ───────────────────────────────────────────
// Updates session progress incrementally — called after each question completes.

router.patch('/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const {
    participantId,
    currentQuestionIndex,
    questionsCompleted,
    questions,
    sessionLog,
    layerA,
    layerB,
    maskedTranscript,
    status,
  } = req.body;

  if (!participantId) {
    return res.status(400).json({ error: 'participantId is required.' });
  }

  try {
    // Verify the session belongs to this participant
    const check = await query(
      `SELECT id FROM sessions WHERE id = $1 AND participant_id = $2`,
      [sessionId, participantId]
    );
    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (currentQuestionIndex !== undefined) {
      updates.push(`current_question_index = $${idx++}`);
      values.push(currentQuestionIndex);
    }
    if (questionsCompleted !== undefined) {
      updates.push(`questions_completed = $${idx++}`);
      values.push(questionsCompleted);
    }
    if (questions !== undefined) {
      updates.push(`questions = $${idx++}`);
      values.push(JSON.stringify(questions));
    }
    if (sessionLog !== undefined) {
      updates.push(`session_log = $${idx++}`);
      values.push(JSON.stringify(sessionLog));
    }
    if (layerA !== undefined) {
      updates.push(`layer_a = $${idx++}`);
      values.push(JSON.stringify(layerA));
    }
    if (layerB !== undefined) {
      // layer_b is only stored if research consent was granted
      // The route trusts the caller to check this — the consent check
      // happens in the frontend before calling this endpoint
      updates.push(`layer_b = $${idx++}`);
      values.push(JSON.stringify(layerB));
    }
    if (maskedTranscript !== undefined) {
      updates.push(`masked_transcript = $${idx++}`);
      values.push(maskedTranscript);
    }
    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);
    }
    if (status === 'complete') {
      updates.push(`completed_at = $${idx++}`);
      values.push(new Date().toISOString());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(sessionId);
    await query(
      `UPDATE sessions SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    const eventType = status === 'complete' ? 'session_completed'
      : status === 'abandoned' ? 'session_abandoned'
      : 'session_updated';

    await logAuditEvent({
      eventType,
      actor: 'participant',
      participantId,
      sessionId,
      metadata: { fieldsUpdated: updates.length, status },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[SESSIONS] Update failed:', err);
    return res.status(500).json({ error: 'Failed to update session.' });
  }
});

// ── DELETE /api/sessions/:participantId ───────────────────────────────────────
// Hard-deletes all sessions for a participant — GDPR Article 17 (right to erasure).
// Audit log entries remain (they are permanent by design).

router.delete('/:participantId', async (req: Request, res: Response) => {
  const { participantId } = req.params;

  try {
    const result = await query<{ id: string }>(
      `DELETE FROM sessions WHERE participant_id = $1 RETURNING id`,
      [participantId]
    );

    await logAuditEvent({
      eventType: 'data_deleted',
      actor: 'participant',
      participantId,
      metadata: {
        reason: 'right_to_erasure_request',
        sessionsDeleted: result.rowCount,
      },
    });

    return res.status(200).json({
      success: true,
      sessionsDeleted: result.rowCount,
      message: 'All session data deleted. Audit log entries are retained as required by law.',
    });
  } catch (err) {
    console.error('[SESSIONS] Delete failed:', err);
    return res.status(500).json({ error: 'Failed to delete sessions.' });
  }
});

// ── GET /api/sessions/:participantId/export ───────────────────────────────────
// Returns a full data export for a participant — GDPR Article 20 (data portability).

router.get('/:participantId/export', async (req: Request, res: Response) => {
  const { participantId } = req.params;

  try {
    const [sessionsResult, consentResult] = await Promise.all([
      query(
        `SELECT * FROM sessions WHERE participant_id = $1 ORDER BY created_at DESC`,
        [participantId]
      ),
      query(
        `SELECT id, consent_version, created_at, product_use, audio_processing,
                third_party, research, withdrawals
         FROM consent_records WHERE participant_id = $1 ORDER BY created_at DESC`,
        [participantId]
      ),
    ]);

    const sessions = sessionsResult.rows.map((row) => ({
      ...row,
      company_name: row.company_name ? decrypt(row.company_name) : null,
      target_role: row.target_role ? decrypt(row.target_role) : null,
      job_description: row.job_description ? decrypt(row.job_description) : null,
      cv_text: row.cv_text ? decrypt(row.cv_text) : null,
    }));

    await logAuditEvent({
      eventType: 'data_exported',
      actor: 'participant',
      participantId,
      metadata: { sessionsExported: sessionsResult.rowCount },
    });

    res.setHeader('Content-Disposition', `attachment; filename="ascendx-data-${participantId}.json"`);
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json({
      exportedAt: new Date().toISOString(),
      participantId,
      consentRecords: consentResult.rows,
      sessions,
    });
  } catch (err) {
    console.error('[SESSIONS] Export failed:', err);
    return res.status(500).json({ error: 'Failed to export data.' });
  }
});

export default router;
