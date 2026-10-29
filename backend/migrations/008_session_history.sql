-- AscendX — Session history persistence
-- Closes two gaps: (1) sessions were only ever saved with their initial config
-- (CV/JD/settings) — the actual session content (transcript, feedback, per-question
-- log) was never persisted; (2) cross-session tracking (MesoAccumulator) lived only
-- in browser localStorage, so it was lost on a different device or a cleared cache.
--
-- `email` lets sessions be looked up by the one identifier that's stable across
-- devices (participant_id is a fresh per-tab/per-device value, email is not).
-- `meso_record` stores the exact SessionRecord object already computed client-side,
-- so cross-device MesoAccumulator reconstruction needs no server-side re-derivation.
-- Safe to run again (IF NOT EXISTS guards).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'email'
  ) THEN
    ALTER TABLE sessions ADD COLUMN email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'meso_record'
  ) THEN
    ALTER TABLE sessions ADD COLUMN meso_record JSONB;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email) WHERE email IS NOT NULL;
