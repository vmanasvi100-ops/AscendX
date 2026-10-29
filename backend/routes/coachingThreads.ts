import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logAuditEvent } from '../lib/audit.js';

const router = Router();

interface ThreadRow {
  id: string; question_text: string; focus: string | null; plan: string | null;
  status: string; created_at: string; reviewed_at: string | null;
}

const toDto = (row: ThreadRow) => ({
  id: row.id,
  questionText: row.question_text,
  focus: row.focus ? decrypt(row.focus) : null,
  plan: row.plan ? decrypt(row.plan) : null,
  status: row.status,
  createdAt: row.created_at,
  reviewedAt: row.reviewed_at,
});

const SELECT_FIELDS = 'id, question_text, focus, plan, status, created_at, reviewed_at';

// ── GET /api/coaching-threads/by-participant/:participantId/latest ─────────────
// Primary lookup: participant_id is a durable, localStorage-backed per-device identity with no
// per-session cost (no email-verification call, nothing to type) — available the moment the page
// loads, unlike email which depends on the candidate reaching the consent modal on its own timing.
router.get('/by-participant/:participantId/latest', async (req: Request, res: Response) => {
  const participantId = (req.params as { participantId: string }).participantId.trim();
  if (!participantId) return res.status(400).json({ error: 'participantId is required.' });

  try {
    const result = await query<ThreadRow>(
      `SELECT ${SELECT_FIELDS} FROM coaching_threads WHERE participant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [participantId]
    );
    await logAuditEvent({
      eventType: 'data_accessed', actor: 'participant',
      metadata: { resource: 'coaching_thread_by_participant', found: result.rowCount > 0 },
    });
    if (result.rowCount === 0) return res.status(200).json({ thread: null });
    return res.status(200).json({ thread: toDto(result.rows[0]) });
  } catch (err) {
    console.error('[COACHING_THREADS] Participant lookup failed:', err);
    return res.status(500).json({ error: 'Failed to fetch coaching thread.' });
  }
});

// ── GET /api/coaching-threads/by-email/:email/latest ──────────────────────────
// Secondary/fallback lookup, for a genuine cross-device case (candidate kept their email but not
// their old device's localStorage). Same caveat as before: email here is self-reported and NOT
// verified (no OTP flow yet) — accepted, pre-existing limitation of this app's by-email lookups.
router.get('/by-email/:email/latest', async (req: Request, res: Response) => {
  const email = (req.params as { email: string }).email.trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required.' });

  try {
    const result = await query<ThreadRow>(
      `SELECT ${SELECT_FIELDS} FROM coaching_threads WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    await logAuditEvent({
      eventType: 'data_accessed', actor: 'participant',
      metadata: { resource: 'coaching_thread_by_email', found: result.rowCount > 0 },
    });
    if (result.rowCount === 0) return res.status(200).json({ thread: null });
    return res.status(200).json({ thread: toDto(result.rows[0]) });
  } catch (err) {
    console.error('[COACHING_THREADS] Lookup failed:', err);
    return res.status(500).json({ error: 'Failed to fetch coaching thread.' });
  }
});

// ── POST /api/coaching-threads ─────────────────────────────────────────────────
// Saves a new thread at the end of a Talk It Through conversation (its Clear Picture becomes
// the focus/plan to review next time). Always inserts a new row rather than updating in place —
// the full history stays available server-side even though only the latest is surfaced to the
// candidate right now, simplest to extend later (e.g. a thread list) without a migration.
router.post('/', async (req: Request, res: Response) => {
  const { participantId, email, questionText, focus, plan } = req.body;
  const hasParticipant = participantId && typeof participantId === 'string';
  const hasEmail = email && typeof email === 'string';
  if (!hasParticipant && !hasEmail) {
    return res.status(400).json({ error: 'participantId or email is required.' });
  }
  if (!questionText || typeof questionText !== 'string') return res.status(400).json({ error: 'questionText is required.' });

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO coaching_threads (participant_id, email, question_text, focus, plan, status)
       VALUES ($1, $2, $3, $4, $5, 'open')
       RETURNING id`,
      [
        hasParticipant ? participantId.trim() : null,
        hasEmail ? email.trim().toLowerCase() : null,
        questionText,
        focus ? encrypt(String(focus)) : null,
        plan ? encrypt(String(plan)) : null,
      ]
    );

    await logAuditEvent({
      eventType: 'session_updated',
      actor: 'participant',
      metadata: { resource: 'coaching_thread_created' },
    });

    return res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('[COACHING_THREADS] Create failed:', err);
    return res.status(500).json({ error: 'Failed to save coaching thread.' });
  }
});

// ── PATCH /api/coaching-threads/:id/reviewed ───────────────────────────────────
// Marks a thread as reviewed once its opening "how did that go" question has been asked, so it
// isn't re-surfaced as "last time" again in a future conversation once a newer thread exists —
// mainly a safety net since a newer POST already supersedes it by created_at, but keeps
// reviewed_at meaningful if that ordering is ever relied on elsewhere.
router.patch('/:id/reviewed', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await query(`UPDATE coaching_threads SET reviewed_at = NOW() WHERE id = $1`, [id]);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[COACHING_THREADS] Mark-reviewed failed:', err);
    return res.status(500).json({ error: 'Failed to update coaching thread.' });
  }
});

export default router;
