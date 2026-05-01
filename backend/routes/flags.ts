import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';
import { logAuditEvent } from '../lib/audit.js';

const router = Router();

// ── POST /api/sessions/:sessionId/flags ──────────────────────────────────────
// Candidate flags a section of their report as inaccurate.
// Human oversight mechanism — required for GDPR Article 22 and EU AI Act.

router.post('/:sessionId/flags', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { participantId, section, candidateNote } = req.body;

  if (!participantId || !section) {
    return res.status(400).json({ error: 'participantId and section are required.' });
  }

  try {
    // Verify session ownership
    const check = await query(
      `SELECT id FROM sessions WHERE id = $1 AND participant_id = $2`,
      [sessionId, participantId]
    );
    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const result = await query<{ id: string }>(
      `INSERT INTO feedback_flags (session_id, section, candidate_note)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [sessionId, section, candidateNote ?? null]
    );

    await logAuditEvent({
      eventType: 'feedback_flagged',
      actor: 'participant',
      participantId,
      sessionId,
      metadata: { flagId: result.rows[0].id, section },
    });

    return res.status(201).json({
      flagId: result.rows[0].id,
      message: 'Your feedback has been recorded and will be reviewed.',
    });
  } catch (err) {
    console.error('[FLAGS] Create failed:', err);
    return res.status(500).json({ error: 'Failed to submit flag.' });
  }
});

// ── GET /api/sessions/:sessionId/flags ───────────────────────────────────────
// Returns all flags for a session — for researcher/admin review.

router.get('/:sessionId/flags', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  try {
    const result = await query(
      `SELECT * FROM feedback_flags
       WHERE session_id = $1
       ORDER BY flagged_at DESC`,
      [sessionId]
    );

    return res.status(200).json({ flags: result.rows });
  } catch (err) {
    console.error('[FLAGS] List failed:', err);
    return res.status(500).json({ error: 'Failed to fetch flags.' });
  }
});

export default router;
