import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logAuditEvent } from '../lib/audit.js';

const router = Router();

interface CvAlignmentRow {
  id: string; company_name: string | null; target_role: string | null;
  job_description: string | null; alignment_summary: string | null; strength_areas: string | null;
  cv_text: string | null; created_at: string;
}

const toDto = (row: CvAlignmentRow) => {
  let strengthAreas: { area: string; cvEvidence: string; jdRequirement: string }[] | null = null;
  if (row.strength_areas) {
    try { strengthAreas = JSON.parse(decrypt(row.strength_areas)); } catch { strengthAreas = null; }
  }
  return {
    id: row.id,
    companyName: row.company_name,
    targetRole: row.target_role,
    jobDescription: row.job_description ? decrypt(row.job_description) : null,
    alignmentSummary: row.alignment_summary ? decrypt(row.alignment_summary) : null,
    strengthAreas,
    cvText: row.cv_text ? decrypt(row.cv_text) : null,
    createdAt: row.created_at,
  };
};

const SELECT_FIELDS = 'id, company_name, target_role, job_description, alignment_summary, strength_areas, cv_text, created_at';

// ── GET /api/cv-alignment/by-participant/:participantId/latest ─────────────────
// The primary, reliable lookup: participant_id is generated client-side on page load and stable
// for the browser tab/session, so a row saved under it at upload time (see POST below) is
// available immediately — no race against the candidate's email being typed into a separate
// consent-modal flow on its own timing. This is what Talk It Through checks first.
router.get('/by-participant/:participantId/latest', async (req: Request, res: Response) => {
  const participantId = (req.params as { participantId: string }).participantId.trim();
  if (!participantId) return res.status(400).json({ error: 'participantId is required.' });

  try {
    const result = await query<CvAlignmentRow>(
      `SELECT ${SELECT_FIELDS} FROM cv_alignment_analyses WHERE participant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [participantId]
    );
    await logAuditEvent({
      eventType: 'data_accessed', actor: 'participant',
      metadata: { resource: 'cv_alignment_by_participant', found: result.rowCount > 0 },
    });
    if (result.rowCount === 0) return res.status(200).json({ analysis: null });
    return res.status(200).json({ analysis: toDto(result.rows[0]) });
  } catch (err) {
    console.error('[CV_ALIGNMENT] Participant lookup failed:', err);
    return res.status(500).json({ error: 'Failed to fetch CV alignment analysis.' });
  }
});

// ── GET /api/cv-alignment/by-email/:email/latest ───────────────────────────────
// Secondary lookup, for cross-session/cross-device continuity (a returning candidate on a new
// tab or device, where the old participant_id no longer applies). Same caveat as
// /api/sessions/by-email/:email/history and /api/coaching-threads/by-email/:email/latest: email
// is self-reported and not verified (no OTP flow yet) — accepted, pre-existing limitation of
// this app's by-email lookups, not new here.
router.get('/by-email/:email/latest', async (req: Request, res: Response) => {
  const email = (req.params as { email: string }).email.trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required.' });

  try {
    const result = await query<CvAlignmentRow>(
      `SELECT ${SELECT_FIELDS} FROM cv_alignment_analyses WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    await logAuditEvent({
      eventType: 'data_accessed', actor: 'participant',
      metadata: { resource: 'cv_alignment_by_email', found: result.rowCount > 0 },
    });
    if (result.rowCount === 0) return res.status(200).json({ analysis: null });
    return res.status(200).json({ analysis: toDto(result.rows[0]) });
  } catch (err) {
    console.error('[CV_ALIGNMENT] Lookup failed:', err);
    return res.status(500).json({ error: 'Failed to fetch CV alignment analysis.' });
  }
});

// ── POST /api/cv-alignment ──────────────────────────────────────────────────────
// Called twice, by design, not as a bug: once immediately at upload time from WelcomeScreen
// (participantId + raw cvText/jobDescription, no analysis yet — guarantees SOMETHING is saved
// even if Phase 2 never completes), and again once Phase 2's alignment analysis succeeds AND the
// candidate's email is known (participantId + email + the richer alignmentSummary/strengthAreas).
// Always inserts a new row rather than updating in place, same pattern as coaching_threads —
// simplest, and the "latest" lookups above naturally prefer whichever came last.
router.post('/', async (req: Request, res: Response) => {
  const { participantId, email, companyName, targetRole, jobDescription, alignmentSummary, strengthAreas, cvText } = req.body;
  const hasParticipant = participantId && typeof participantId === 'string';
  const hasEmail = email && typeof email === 'string';
  if (!hasParticipant && !hasEmail) {
    return res.status(400).json({ error: 'participantId or email is required.' });
  }

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO cv_alignment_analyses
         (participant_id, email, company_name, target_role, job_description, alignment_summary, strength_areas, cv_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        hasParticipant ? participantId.trim() : null,
        hasEmail ? email.trim().toLowerCase() : null,
        companyName ?? null,
        targetRole ?? null,
        jobDescription ? encrypt(String(jobDescription)) : null,
        alignmentSummary ? encrypt(String(alignmentSummary)) : null,
        Array.isArray(strengthAreas) ? encrypt(JSON.stringify(strengthAreas)) : null,
        cvText ? encrypt(String(cvText)) : null,
      ]
    );

    await logAuditEvent({
      eventType: 'session_updated',
      actor: 'participant',
      metadata: { resource: 'cv_alignment_created', hasAnalysis: !!alignmentSummary },
    });

    return res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('[CV_ALIGNMENT] Create failed:', err);
    return res.status(500).json({ error: 'Failed to save CV alignment analysis.' });
  }
});

export default router;
