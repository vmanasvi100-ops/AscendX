import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';

const router = Router();

// ── PII Safety Validation ─────────────────────────────────────────────────────

const FORBIDDEN_KEYS = new Set([
  'cvtext', 'cvcontent', 'fullcv', 'cv_text', 'resume_text',
  'name', 'firstname', 'lastname', 'fullname',
  'email', 'phone', 'address', 'city', 'postcode',
  'company', 'employer', 'university', 'school',
  'supervisor', 'reference', 'manager',
  'salary', 'compensation', 'visa',
]);

function hasForbiddenKeys(obj: Record<string, unknown>, depth = 0): boolean {
  if (depth > 3) return false; // prevent deep recursion on malicious payloads
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) return true;
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (hasForbiddenKeys(val as Record<string, unknown>, depth + 1)) return true;
    }
  }
  return false;
}

function validateCvUploadMetadata(meta: Record<string, unknown>): string | null {
  const { experience_years, degree_discipline, skill_keywords } = meta;
  const validDisciplines = new Set(['STEM', 'Business', 'Humanities', 'Other', null, undefined]);

  if (experience_years !== null && experience_years !== undefined) {
    if (typeof experience_years !== 'number' || experience_years < 0 || experience_years > 50)
      return 'experience_years must be a number 0–50 or null';
  }
  if (!validDisciplines.has(degree_discipline as string))
    return 'degree_discipline must be STEM, Business, Humanities, Other, or null';
  if (skill_keywords !== undefined) {
    if (!Array.isArray(skill_keywords))
      return 'skill_keywords must be an array';
    if ((skill_keywords as unknown[]).length > 10)
      return 'skill_keywords must have at most 10 items';
    for (const kw of skill_keywords as unknown[]) {
      if (typeof kw !== 'string' || (kw as string).length > 50)
        return 'Each skill_keyword must be a string under 50 characters';
    }
  }
  return null;
}

function validateEvent(e: Record<string, unknown>): string | null {
  const meta = (e.metadata ?? {}) as Record<string, unknown>;

  if (hasForbiddenKeys(meta))
    return 'Event metadata contains a forbidden PII field name';

  if (e.type === 'cv_uploaded') {
    const err = validateCvUploadMetadata(meta);
    if (err) return err;
  }

  return null;
}

// ── POST /api/analytics/batch ─────────────────────────────────────────────────
// Batch-insert events synced from the frontend localStorage store.
// Non-destructive: existing rows are kept. Duplicates (same participant+type+time)
// are silently ignored via ON CONFLICT DO NOTHING.

router.post('/batch', async (req: Request, res: Response) => {
  const { events } = req.body;
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'events must be a non-empty array.' });
  }

  try {
    const participantIds: string[] = [];
    const eventTypes: string[] = [];
    const conditions: Array<string | null> = [];
    const occurredAts: string[] = [];
    const metadatas: string[] = [];
    const rejected: number[] = [];

    for (let i = 0; i < events.length; i++) {
      const e = events[i] as Record<string, unknown>;
      const validationError = validateEvent(e);
      if (validationError) {
        console.warn(`[ANALYTICS] ⚠️ Event rejected — ${validationError}`, { type: e.type, index: i });
        rejected.push(i);
        continue;
      }
      participantIds.push(String(e.participantId ?? 'unknown'));
      eventTypes.push(String(e.type ?? 'unknown'));
      conditions.push((e.condition as string) ?? null);
      occurredAts.push(new Date(Number(e.timestamp)).toISOString());
      metadatas.push(JSON.stringify(e.metadata ?? {}));
    }

    if (participantIds.length === 0) {
      return res.status(400).json({ error: 'All events were rejected due to invalid data format.', rejected: rejected.length });
    }

    await query(
      `INSERT INTO analytics_events (participant_id, event_type, condition, occurred_at, metadata)
       SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::timestamptz[], $5::jsonb[])`,
      [participantIds, eventTypes, conditions, occurredAts, metadatas]
    );

    return res.status(201).json({ inserted: participantIds.length, rejected: rejected.length });
  } catch (err) {
    console.error('[ANALYTICS] Batch insert failed:', err);
    return res.status(500).json({ error: 'Failed to insert events.' });
  }
});

// ── GET /api/analytics/events ─────────────────────────────────────────────────
// Returns all events ordered by most recent, capped at 20 000 rows.
// Reshapes rows to match the frontend AnalyticsEvent interface.

router.get('/events', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
         participant_id   AS "participantId",
         event_type       AS type,
         condition,
         FLOOR(EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint AS timestamp,
         metadata
       FROM analytics_events
       ORDER BY occurred_at DESC
       LIMIT 20000`,
      []
    );
    return res.status(200).json({ events: result.rows });
  } catch (err) {
    console.error('[ANALYTICS] Fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch events.' });
  }
});

// ── DELETE /api/analytics/events ─────────────────────────────────────────────
// Clears ALL analytics events. Researcher use only.

router.delete('/events', async (_req: Request, res: Response) => {
  try {
    const result = await query(`DELETE FROM analytics_events RETURNING id`, []);
    return res.status(200).json({ deleted: result.rowCount ?? 0 });
  } catch (err) {
    console.error('[ANALYTICS] Clear all failed:', err);
    return res.status(500).json({ error: 'Failed to clear events.' });
  }
});

// ── DELETE /api/analytics/events/:participantId ───────────────────────────────
// Removes all events for a single participant — supports per-user data hygiene
// and right-to-erasure (GDPR Article 17).

router.delete('/events/:participantId', async (req: Request, res: Response) => {
  const { participantId } = req.params;
  if (!participantId) {
    return res.status(400).json({ error: 'participantId is required.' });
  }
  try {
    const result = await query(
      `DELETE FROM analytics_events WHERE participant_id = $1 RETURNING id`,
      [participantId]
    );
    return res.status(200).json({ deleted: result.rowCount ?? 0 });
  } catch (err) {
    console.error('[ANALYTICS] Clear participant failed:', err);
    return res.status(500).json({ error: 'Failed to clear participant events.' });
  }
});

export default router;
