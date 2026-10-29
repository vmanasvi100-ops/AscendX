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
    email,
    companyName,
    targetRole,
    jobDescription,
    cvText,
    settings,
    questions,
    // Optional — present when the session has already completed by the time this
    // call fires (the current frontend flow generates feedback before saving).
    // All additive: omitting them behaves exactly as before.
    sessionLog,
    layerA,
    maskedTranscript,
    mesoRecord,
    status,
  } = req.body;

  if (!participantId) {
    return res.status(400).json({ error: 'participantId is required.' });
  }

  const now = new Date();
  const cvPurgeDate = new Date(now);
  cvPurgeDate.setDate(cvPurgeDate.getDate() + 30);     // CV purged after 30 days

  const retentionExpiry = new Date(now);
  retentionExpiry.setFullYear(retentionExpiry.getFullYear() + 1); // Session expires after 12 months

  const isComplete = status === 'complete';

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO sessions
         (participant_id, consent_id, email,
          company_name, target_role, job_description, cv_text,
          cv_purge_date, settings, questions,
          session_log, layer_a, masked_transcript, meso_record,
          status, completed_at,
          retention_expiry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING id`,
      [
        participantId,
        consentId ?? null,
        email ? email.trim().toLowerCase() : null,
        companyName ? encrypt(companyName) : null,
        targetRole ? encrypt(targetRole) : null,
        jobDescription ? encrypt(jobDescription) : null,
        cvText ? encrypt(cvText) : null,
        cvPurgeDate.toISOString(),
        JSON.stringify(settings ?? {}),
        JSON.stringify(questions ?? []),
        JSON.stringify(sessionLog ?? []),
        layerA !== undefined ? JSON.stringify(layerA) : null,
        maskedTranscript ?? null,
        mesoRecord !== undefined ? JSON.stringify(mesoRecord) : null,
        isComplete ? 'complete' : 'in_progress',
        isComplete ? now.toISOString() : null,
        retentionExpiry.toISOString(),
      ]
    );

    const sessionId = result.rows[0].id;

    await logAuditEvent({
      eventType: 'session_created',
      actor: 'participant',
      participantId,
      sessionId,
      metadata: { hasCV: !!cvText, hasJD: !!jobDescription, savedWithContent: !!layerA },
    });

    return res.status(201).json({ sessionId });
  } catch (err) {
    console.error('[SESSIONS] Create failed:', err);
    return res.status(500).json({ error: 'Failed to create session.' });
  }
});

// ── GET /api/sessions/by-email/:email/history ─────────────────────────────────
// Cross-device session history — looked up by email (stable across devices),
// unlike participantId (fresh per browser tab).
//
// Exposure-reduction stopgap: this route has NO authentication — anyone who knows
// or guesses a candidate's email can call it. It used to return layer_a (full
// candidate-facing feedback: performance summary, strengths, weaknesses, coaching)
// plus company_name/target_role, all keyed only by a guessable email. That's a real
// exposure. Until proper email verification exists (OTP or similar — needs SMTP
// credentials, deferred), this route returns ONLY meso_record: the minimum needed
// to reconstruct MesoAccumulator client-side for cross-device coaching continuity
// (growth trends, scaffold reduction, coaching-progression stage). No per-session
// report content, no company/role names. Never returns cv_text/job_description
// either, same as before.
router.get('/by-email/:email/history', async (req: Request, res: Response) => {
  const email = (req.params as { email: string }).email.trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required.' });

  try {
    const result = await query(
      `SELECT id, created_at, completed_at, status,
              meso_record
       FROM sessions
       WHERE email = $1 AND status = 'complete'
       ORDER BY created_at ASC`,
      [email]
    );

    await logAuditEvent({
      eventType: 'data_accessed',
      actor: 'participant',
      metadata: { resource: 'session_history_by_email', count: result.rowCount },
    });

    return res.status(200).json({ sessions: result.rows });
  } catch (err) {
    console.error('[SESSIONS] History lookup failed:', err);
    return res.status(500).json({ error: 'Failed to fetch session history.' });
  }
});

// ── GET /api/sessions/probe-effectiveness ─────────────────────────────────────
// Aggregates probe_successful/depth_delta (already computed per-probe by
// analyzeProbeResponse, never previously aggregated anywhere) by probe_type,
// across every completed session. Answers: "are DEEPENING probes actually
// producing better answers, or just STRATEGIC ones at session end?" — not a new
// measurement, just surfacing data that was already being computed and discarded.
// Researcher-tier only; mounted behind researcherMode on the frontend.
router.get('/probe-effectiveness', async (_req: Request, res: Response) => {
  try {
    const result = await query<{ session_log: any }>(
      `SELECT session_log FROM sessions WHERE status = 'complete' AND session_log IS NOT NULL`,
      []
    );

    type Tally = { count: number; successCount: number; increased: number; same: number; decreased: number };
    const PROBE_TYPES = ['CLARIFYING', 'CONCRETE', 'DEEPENING', 'REDIRECTING', 'STRATEGIC'] as const;
    const byType: Record<string, Tally> = {};
    PROBE_TYPES.forEach(t => { byType[t] = { count: 0, successCount: 0, increased: 0, same: 0, decreased: 0 }; });

    let sessionsWithProbes = 0;
    for (const row of result.rows) {
      const log = Array.isArray(row.session_log) ? row.session_log : [];
      let sessionHadProbe = false;
      for (const entry of log) {
        const probeType = entry?.probe?.probe_type;
        const analysis = entry?.probeAnalysis;
        if (!probeType || !analysis || !byType[probeType]) continue;
        sessionHadProbe = true;
        const t = byType[probeType];
        t.count++;
        if (analysis.probe_successful === true) t.successCount++;
        if (analysis.depth_delta === 'increased') t.increased++;
        else if (analysis.depth_delta === 'same') t.same++;
        else if (analysis.depth_delta === 'decreased') t.decreased++;
      }
      if (sessionHadProbe) sessionsWithProbes++;
    }

    const byProbeType = PROBE_TYPES.map(type => {
      const t = byType[type];
      return {
        probeType: type,
        count: t.count,
        successRate: t.count > 0 ? Math.round((t.successCount / t.count) * 1000) / 10 : null,
        depthDelta: t.count > 0 ? {
          increasedPct: Math.round((t.increased / t.count) * 1000) / 10,
          samePct: Math.round((t.same / t.count) * 1000) / 10,
          decreasedPct: Math.round((t.decreased / t.count) * 1000) / 10,
        } : null,
      };
    });

    return res.status(200).json({
      sessionsAnalyzed: result.rowCount,
      sessionsWithProbes,
      byProbeType,
    });
  } catch (err) {
    console.error('[SESSIONS] Probe effectiveness aggregation failed:', err);
    return res.status(500).json({ error: 'Failed to aggregate probe effectiveness.' });
  }
});

// ── GET /api/sessions/:participantId ─────────────────────────────────────────
// Returns all sessions for a participant — for the "resume" feature on return visits.
// CV and JD text are NOT returned here (minimisation). Only metadata and config labels.

router.get('/:participantId', async (req: Request, res: Response) => {
  const { participantId } = req.params as { participantId: string };

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
  const { participantId, sessionId } = req.params as { participantId: string; sessionId: string };

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
  const { sessionId } = req.params as { sessionId: string };
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
  const { participantId } = req.params as { participantId: string };

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
  const { participantId } = req.params as { participantId: string };

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
