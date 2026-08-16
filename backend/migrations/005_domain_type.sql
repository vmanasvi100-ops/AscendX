-- AscendX — Domain type classification for registered participants
-- Adds domain_type column (institutional / consumer / other) for researcher visibility.
-- Safe to run again (IF NOT EXISTS guard on migration, ALTER is idempotent with DO block).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registered_participants' AND column_name = 'domain_type'
  ) THEN
    ALTER TABLE registered_participants
      ADD COLUMN domain_type TEXT CHECK (domain_type IN ('institutional', 'consumer', 'other'));
  END IF;
END $$;
