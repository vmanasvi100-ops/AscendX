-- AscendX — NDA consent tracking for registered participants
-- Adds nda_accepted / nda_accepted_at so consent is recorded server-side
-- instead of an unverified client-side checkbox.
-- Safe to run again (IF NOT EXISTS guard on migration, ALTER is idempotent with DO block).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registered_participants' AND column_name = 'nda_accepted'
  ) THEN
    ALTER TABLE registered_participants
      ADD COLUMN nda_accepted BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN nda_accepted_at TIMESTAMPTZ;
  END IF;
END $$;
