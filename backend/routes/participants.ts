import { Router, Request, Response } from 'express';
import { promises as dns } from 'dns';
import { query } from '../db/client.js';

const router = Router();

// ── Domain helpers ─────────────────────────────────────────────────────────

const CONSUMER_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.in', 'yahoo.com.au',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.es',
  'outlook.com', 'outlook.co.uk', 'outlook.fr', 'outlook.de', 'outlook.es',
  'live.com', 'live.co.uk', 'live.fr',
  'icloud.com', 'me.com', 'mac.com',
  'msn.com', 'aol.com', 'protonmail.com', 'proton.me', 'pm.me',
]);

const ACADEMIC_TLDS = [
  '.edu', '.ac.uk', '.ac.in', '.ac.nz', '.ac.za', '.ac.au',
  '.edu.au', '.edu.sg', '.edu.hk', '.edu.cn', '.edu.pk',
  '.ac.jp', '.edu.tw', '.edu.my', '.edu.br',
];

type DomainType = 'institutional' | 'consumer' | 'other';

function classifyDomain(domain: string): DomainType {
  if (CONSUMER_DOMAINS.has(domain)) return 'consumer';
  if (ACADEMIC_TLDS.some(tld => domain.endsWith(tld))) return 'institutional';
  return 'other';
}

async function hasMXRecords(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────

// POST /api/participants/verify
// Validates the email domain via MX record lookup, then auto-registers the
// participant (upsert). Blocks emails whose domain has no mail servers.
// Also requires ndaAccepted=true — this is the sole place NDA consent is recorded.
router.post('/verify', async (req: Request, res: Response) => {
  const { email, ndaAccepted, participantId } = req.body as { email?: string; ndaAccepted?: boolean; participantId?: string };
  if (!email?.trim()) return res.status(400).json({ valid: false, reason: 'email_required' });
  if (!ndaAccepted) return res.status(400).json({ valid: false, reason: 'nda_required' });

  const normalized = email.trim().toLowerCase();
  const atIdx = normalized.lastIndexOf('@');
  if (atIdx === -1) return res.status(400).json({ valid: false, reason: 'invalid_format' });

  const domain = normalized.slice(atIdx + 1);
  if (!domain) return res.status(400).json({ valid: false, reason: 'invalid_format' });

  // MX check — real email domains have mail servers; throwaway/fake domains don't.
  const mxOk = await hasMXRecords(domain);
  if (!mxOk) {
    return res.status(422).json({ valid: false, reason: 'invalid_domain' });
  }

  const domainType = classifyDomain(domain);

  try {
    await query(
      `INSERT INTO registered_participants (email, domain_type, first_seen_at, last_seen_at, session_count, nda_accepted, nda_accepted_at, participant_id)
       VALUES ($1, $2, NOW(), NOW(), 1, TRUE, NOW(), $3)
       ON CONFLICT (email) DO UPDATE
         SET session_count    = registered_participants.session_count + 1,
             last_seen_at     = NOW(),
             domain_type      = EXCLUDED.domain_type,
             nda_accepted     = TRUE,
             nda_accepted_at  = COALESCE(registered_participants.nda_accepted_at, NOW()),
             participant_id   = COALESCE(EXCLUDED.participant_id, registered_participants.participant_id)`,
      [normalized, domainType, participantId ?? null]
    );
    return res.status(200).json({ valid: true, registered: true, domainType });
  } catch (err) {
    console.error('[PARTICIPANTS] Verify failed:', err);
    // DB failure: don't block the participant — frontend can retry silently.
    return res.status(200).json({ valid: true, registered: false });
  }
});

// GET /api/participants
// Returns all registered participants — researcher use only.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT email, domain_type, registered_at, note, session_count, first_seen_at, last_seen_at, participant_id
       FROM registered_participants
       ORDER BY registered_at DESC`,
      []
    );
    return res.status(200).json({ participants: result.rows });
  } catch (err) {
    console.error('[PARTICIPANTS] List failed:', err);
    return res.status(500).json({ error: 'Failed to fetch participants.' });
  }
});

// POST /api/participants
// Register one or more email addresses manually (researcher entry — no MX check).
// Body: { emails: string[], note?: string }
router.post('/', async (req: Request, res: Response) => {
  const { emails, note } = req.body as { emails?: string[]; note?: string };
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'emails must be a non-empty array.' });
  }

  const normalized = emails
    .map(e => e.trim().toLowerCase())
    .filter(e => e.includes('@') && e.length <= 254);

  if (normalized.length === 0) {
    return res.status(400).json({ error: 'No valid email addresses found.' });
  }

  try {
    const result = await query(
      `INSERT INTO registered_participants (email, note)
       SELECT unnest($1::text[]), $2
       ON CONFLICT (email) DO NOTHING`,
      [normalized, note ?? null]
    );
    return res.status(201).json({ added: result.rowCount ?? 0, total: normalized.length });
  } catch (err) {
    console.error('[PARTICIPANTS] Add failed:', err);
    return res.status(500).json({ error: 'Failed to register participants.' });
  }
});

// DELETE /api/participants/:email
// Remove a participant.
router.delete('/:email', async (req: Request, res: Response) => {
  const email = decodeURIComponent((req.params as { email: string }).email).trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required.' });

  try {
    await query(`DELETE FROM registered_participants WHERE email = $1`, [email]);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[PARTICIPANTS] Delete failed:', err);
    return res.status(500).json({ error: 'Failed to remove participant.' });
  }
});

export default router;
