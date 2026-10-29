-- AscendX — raw CV file storage (PDF/Word), saved to Supabase at upload time
--
-- Separate from cv_alignment_analyses on purpose: that table's rows are superseded by later,
-- richer saves in the same flow (raw text -> full analysis), and a "latest row wins" read would
-- lose the file entirely once a later, file-less save happened. The actual uploaded file is an
-- append-only record of what the candidate gave us, saved once, immediately, at upload time —
-- never meant to be "replaced" by a later step. Keyed by participant_id (durable, localStorage-
-- backed per-device identity, no per-session cost) with email as an optional supplementary field,
-- same pattern as the other tables in this app. File bytes are stored base64-encoded, then
-- encrypted (lib/encryption.ts), same treatment as every other CV-derived field. Safe to run
-- again (IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS cv_file_uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  TEXT,
  email           TEXT,
  file_name       TEXT NOT NULL,
  file_mime       TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  file_base64     TEXT NOT NULL,   -- encrypted
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_file_uploads_participant_created
  ON cv_file_uploads(participant_id, created_at DESC)
  WHERE participant_id IS NOT NULL;
