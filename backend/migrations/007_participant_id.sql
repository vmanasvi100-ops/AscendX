-- AscendX — Link registered emails to the anonymous analytics participant ID
-- Lets the dashboard join a session's analytics rows (keyed by participant_id)
-- back to the email that registered it, for exports where that's wanted.
-- Safe to run again (IF NOT EXISTS guard on migration, ALTER is idempotent with DO block).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registered_participants' AND column_name = 'participant_id'
  ) THEN
    ALTER TABLE registered_participants
      ADD COLUMN participant_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_registered_participants_participant_id
  ON registered_participants(participant_id);
