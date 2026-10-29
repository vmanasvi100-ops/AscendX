import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logAuditEvent } from '../lib/audit.js';
import { uploadCvFile, getSignedDownloadUrl } from '../lib/supabaseStorage.js';

const router = Router();

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // legacy .doc
]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, matches the existing frontend cap

// ── POST /api/cv-files ───────────────────────────────────────────────────────
// Saves the raw uploaded CV file (PDF or Word) to the backend the moment it's uploaded — an
// append-only record, independent of cv_alignment_analyses (see 013_cv_file_uploads.sql for why
// it's a separate table). participantId or email required to key it to someone; participantId is
// the reliable one (durable, no per-session cost — see context/SettingsContext.tsx).
//
// Uploads to real Supabase Storage (backend/lib/supabaseStorage.ts) so the file is an actual,
// browsable, downloadable object in Supabase's own dashboard — not just encrypted text in a
// database column, which was the original version of this table and left no way to see the file
// from Supabase's own UI. Falls back to the original encrypted-DB-column approach if
// SUPABASE_SERVICE_ROLE_KEY isn't configured yet, so uploads keep working either way rather than
// breaking while that's being set up.
router.post('/', async (req: Request, res: Response) => {
  const { participantId, email, fileName, fileMime, fileBase64 } = req.body;
  const hasParticipant = participantId && typeof participantId === 'string';
  const hasEmail = email && typeof email === 'string';
  if (!hasParticipant && !hasEmail) {
    return res.status(400).json({ error: 'participantId or email is required.' });
  }
  if (!fileName || typeof fileName !== 'string') return res.status(400).json({ error: 'fileName is required.' });
  if (!fileMime || typeof fileMime !== 'string' || !ALLOWED_MIME_TYPES.has(fileMime)) {
    return res.status(400).json({ error: 'Unsupported file type. Only PDF and Word documents are accepted.' });
  }
  if (!fileBase64 || typeof fileBase64 !== 'string') return res.status(400).json({ error: 'fileBase64 is required.' });

  // Rough size check on the base64 payload itself (base64 is ~4/3 the size of the raw bytes) —
  // the frontend already caps at 5MB before encoding, this is a defensive backend-side check.
  const approxBytes = Math.floor(fileBase64.length * 0.75);
  if (approxBytes > MAX_FILE_SIZE_BYTES) {
    return res.status(413).json({ error: 'File too large. Please upload a file under 5MB.' });
  }

  const ownerKey = hasParticipant ? participantId.trim() : email.trim().toLowerCase();
  let storagePath: string | null = null;
  let encryptedBase64: string | null = null;

  try {
    const uploaded = await uploadCvFile({
      ownerKey, fileName, fileMime, bytes: Buffer.from(fileBase64, 'base64'),
    });
    storagePath = uploaded.path;
  } catch (storageErr) {
    console.warn('[CV_FILES] Supabase Storage upload failed, falling back to encrypted DB column:', storageErr);
    encryptedBase64 = encrypt(fileBase64);
  }

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO cv_file_uploads (participant_id, email, file_name, file_mime, file_size_bytes, file_base64, storage_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        hasParticipant ? participantId.trim() : null,
        hasEmail ? email.trim().toLowerCase() : null,
        fileName,
        fileMime,
        approxBytes,
        encryptedBase64,
        storagePath,
      ]
    );

    await logAuditEvent({
      eventType: 'session_updated',
      actor: 'participant',
      metadata: { resource: 'cv_file_uploaded', fileMime, approxBytes, storage: storagePath ? 'supabase_storage' : 'db_fallback' },
    });

    return res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('[CV_FILES] Save failed:', err);
    return res.status(500).json({ error: 'Failed to save the uploaded file.' });
  }
});

// ── GET /api/cv-files/by-participant/:participantId/latest ─────────────────────
// Mainly for verification/debugging and any future feature that needs the raw file back —
// Talk It Through itself never reads this (it only ever uses the derived alignment data, never
// raw file bytes, per the existing "thin slice, not the raw CV" design — see §10i).
router.get('/by-participant/:participantId/latest', async (req: Request, res: Response) => {
  const participantId = (req.params as { participantId: string }).participantId.trim();
  if (!participantId) return res.status(400).json({ error: 'participantId is required.' });

  try {
    const result = await query<{
      id: string; file_name: string; file_mime: string; file_size_bytes: number; created_at: string;
    }>(
      `SELECT id, file_name, file_mime, file_size_bytes, created_at
       FROM cv_file_uploads WHERE participant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [participantId]
    );
    await logAuditEvent({
      eventType: 'data_accessed', actor: 'participant',
      metadata: { resource: 'cv_file_by_participant', found: result.rowCount > 0 },
    });
    if (result.rowCount === 0) return res.status(200).json({ file: null });
    const row = result.rows[0];
    return res.status(200).json({
      file: { id: row.id, fileName: row.file_name, fileMime: row.file_mime, fileSizeBytes: row.file_size_bytes, createdAt: row.created_at },
    });
  } catch (err) {
    console.error('[CV_FILES] Lookup failed:', err);
    return res.status(500).json({ error: 'Failed to fetch uploaded file metadata.' });
  }
});

// ── GET /api/cv-files ────────────────────────────────────────────────────────
// Lists uploaded CVs, most recent first, for the admin dashboard (ProductDashboard.tsx, opened
// with Ctrl/Cmd+Shift+A). Metadata only — same no-separate-auth posture as every other admin
// route in this app (/api/participants, /api/sessions/probe-effectiveness, etc.); not a new gap,
// just not better than what's already there.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query<{
      id: string; participant_id: string | null; email: string | null;
      file_name: string; file_mime: string; file_size_bytes: number; created_at: string;
    }>(
      `SELECT id, participant_id, email, file_name, file_mime, file_size_bytes, created_at
       FROM cv_file_uploads ORDER BY created_at DESC LIMIT 200`
    );
    return res.status(200).json({
      files: result.rows.map(row => ({
        id: row.id,
        participantId: row.participant_id,
        email: row.email,
        fileName: row.file_name,
        fileMime: row.file_mime,
        fileSizeBytes: row.file_size_bytes,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('[CV_FILES] List failed:', err);
    return res.status(500).json({ error: 'Failed to list uploaded files.' });
  }
});

// ── GET /api/cv-files/:id/download ──────────────────────────────────────────────
// The actual file back, for the admin dashboard's "Download" button. Talk It Through and every
// other candidate-facing feature never calls this; only the admin view does. Prefers the real
// Supabase Storage object (redirects to a short-lived signed URL) when storage_path is set;
// falls back to decrypting the old DB-column copy for rows saved before this change.
router.get('/:id/download', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query<{ file_name: string; file_mime: string; file_base64: string | null; storage_path: string | null }>(
      `SELECT file_name, file_mime, file_base64, storage_path FROM cv_file_uploads WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'File not found.' });

    const row = result.rows[0];

    await logAuditEvent({
      eventType: 'data_accessed', actor: 'researcher',
      metadata: { resource: 'cv_file_downloaded', source: row.storage_path ? 'supabase_storage' : 'db_fallback' },
    });

    if (row.storage_path) {
      const signedUrl = await getSignedDownloadUrl(row.storage_path);
      return res.redirect(302, signedUrl);
    }

    if (!row.file_base64) return res.status(404).json({ error: 'File content unavailable.' });
    const buffer = Buffer.from(decrypt(row.file_base64), 'base64');
    res.setHeader('Content-Type', row.file_mime);
    res.setHeader('Content-Disposition', `attachment; filename="${row.file_name.replace(/"/g, '')}"`);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[CV_FILES] Download failed:', err);
    return res.status(500).json({ error: 'Failed to download file.' });
  }
});

export default router;
