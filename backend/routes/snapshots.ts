import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';

const router = Router();

// GET /api/snapshots/:emailKey
// Returns the most recent snapshot for this email — used on return visits
// to populate the welcome-back card across devices.
router.get('/:emailKey', async (req: Request, res: Response) => {
  const emailKey = (req.params as { emailKey: string }).emailKey.trim().toLowerCase();
  if (!emailKey) return res.status(400).json({ error: 'emailKey is required.' });

  try {
    const result = await query(
      `SELECT snapshot FROM participant_snapshots
       WHERE email_key = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [emailKey]
    );
    if (result.rowCount === 0) return res.status(404).json({ snapshot: null });
    return res.status(200).json({ snapshot: result.rows[0].snapshot });
  } catch (err) {
    console.error('[SNAPSHOTS] Get failed:', err);
    return res.status(500).json({ error: 'Failed to fetch snapshot.' });
  }
});

// POST /api/snapshots
// Saves a session snapshot. Called when the report loads.
// Body: { emailKey: string, snapshot: SessionSnapshot }
router.post('/', async (req: Request, res: Response) => {
  const { emailKey, snapshot } = req.body as { emailKey?: string; snapshot?: unknown };
  if (!emailKey || !snapshot) {
    return res.status(400).json({ error: 'emailKey and snapshot are required.' });
  }

  try {
    await query(
      `INSERT INTO participant_snapshots (email_key, snapshot)
       VALUES ($1, $2)`,
      [emailKey.trim().toLowerCase(), JSON.stringify(snapshot)]
    );
    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('[SNAPSHOTS] Save failed:', err);
    return res.status(500).json({ error: 'Failed to save snapshot.' });
  }
});

export default router;
