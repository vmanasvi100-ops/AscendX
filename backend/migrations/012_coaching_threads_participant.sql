-- AscendX — Coaching Threads: add participant_id as the primary, no-email-needed key
--
-- Same reasoning as 011_cv_alignment_participant.sql: email required an extra per-session cost
-- (the MX-verification call, typing it in) and depended on the candidate reaching the consent
-- modal. participant_id is now a durable, localStorage-backed identity per device (see
-- context/SettingsContext.tsx) with no such cost — available the moment the page loads. Email
-- stays as a secondary/fallback key for the genuine cross-device case (a candidate who kept their
-- email but not their old device). Safe to run again (IF NOT EXISTS / conditional guards).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coaching_threads' AND column_name = 'participant_id'
  ) THEN
    ALTER TABLE coaching_threads ADD COLUMN participant_id TEXT;
  END IF;

  ALTER TABLE coaching_threads ALTER COLUMN email DROP NOT NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_coaching_threads_participant_created
  ON coaching_threads(participant_id, created_at DESC)
  WHERE participant_id IS NOT NULL;
