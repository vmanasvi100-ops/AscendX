import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';
import { hashIP } from '../lib/encryption.js';
import { logAuditEvent } from '../lib/audit.js';

const router = Router();

// ── POST /api/consent ────────────────────────────────────────────────────────
// Records initial consent for a participant.
// Called once before the session begins — from the WelcomeScreen consent gate.

router.post('/', async (req: Request, res: Response) => {
  const {
    participantId,
    productUse,
    audioProcessing,
    thirdParty,
    research,
  } = req.body;

  if (!participantId || productUse === undefined) {
    return res.status(400).json({ error: 'participantId and productUse are required.' });
  }

  if (!productUse || !audioProcessing || !thirdParty) {
    return res.status(400).json({
      error: 'Product use, audio processing, and third-party consent are required to proceed.',
    });
  }

  const now = new Date().toISOString();
  const ipHash = req.ip ? hashIP(req.ip) : null;

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO consent_records
         (participant_id, ip_hash,
          product_use, product_use_at,
          audio_processing, audio_processing_at,
          third_party, third_party_at,
          research, research_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        participantId, ipHash,
        productUse, productUse ? now : null,
        audioProcessing, audioProcessing ? now : null,
        thirdParty, thirdParty ? now : null,
        research ?? false, research ? now : null,
      ]
    );

    const consentId = result.rows[0].id;

    await logAuditEvent({
      eventType: 'consent_granted',
      actor: 'participant',
      participantId,
      metadata: {
        consentId,
        scopes: { productUse, audioProcessing, thirdParty, research: research ?? false },
      },
    });

    return res.status(201).json({ consentId });
  } catch (err) {
    console.error('[CONSENT] Failed to record consent:', err);
    return res.status(500).json({ error: 'Failed to record consent.' });
  }
});

// ── POST /api/consent/:participantId/withdraw ────────────────────────────────
// Appends a withdrawal record for a specific consent scope.
// The original consent row is never modified — withdrawal is append-only.

router.post('/:participantId/withdraw', async (req: Request, res: Response) => {
  const { participantId } = req.params;
  const { scope } = req.body;

  const validScopes = ['product_use', 'audio_processing', 'third_party', 'research'];
  if (!scope || !validScopes.includes(scope)) {
    return res.status(400).json({
      error: `scope must be one of: ${validScopes.join(', ')}`,
    });
  }

  const withdrawal = { scope, withdrawn_at: new Date().toISOString() };

  try {
    const result = await query(
      `UPDATE consent_records
       SET withdrawals = withdrawals || $1::jsonb
       WHERE participant_id = $2
       RETURNING id`,
      [JSON.stringify([withdrawal]), participantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No consent record found for this participant.' });
    }

    // If research consent withdrawn — null out layer_b on all their sessions
    if (scope === 'research') {
      await query(
        `UPDATE sessions SET layer_b = NULL WHERE participant_id = $1`,
        [participantId]
      );
      await logAuditEvent({
        eventType: 'layer_b_purged',
        actor: 'participant',
        participantId,
        metadata: { reason: 'research consent withdrawn' },
      });
    }

    await logAuditEvent({
      eventType: 'consent_withdrawn',
      actor: 'participant',
      participantId,
      metadata: { scope },
    });

    return res.status(200).json({ success: true, withdrawal });
  } catch (err) {
    console.error('[CONSENT] Withdrawal failed:', err);
    return res.status(500).json({ error: 'Failed to record withdrawal.' });
  }
});

// ── GET /api/consent/:participantId ──────────────────────────────────────────
// Returns the most recent consent record for a participant.
// Used by the frontend to know which gates are active on return visits.

router.get('/:participantId', async (req: Request, res: Response) => {
  const { participantId } = req.params;

  try {
    const result = await query(
      `SELECT id, consent_version, created_at,
              product_use, audio_processing, third_party, research,
              withdrawals
       FROM consent_records
       WHERE participant_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [participantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ hasConsent: false });
    }

    await logAuditEvent({
      eventType: 'data_accessed',
      actor: 'participant',
      participantId,
      metadata: { resource: 'consent_record' },
    });

    return res.status(200).json({ hasConsent: true, consent: result.rows[0] });
  } catch (err) {
    console.error('[CONSENT] Fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch consent record.' });
  }
});

export default router;
