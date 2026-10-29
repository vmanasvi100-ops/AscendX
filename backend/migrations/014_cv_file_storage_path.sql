-- AscendX — CV files move to real Supabase Storage, not just an encrypted DB column
--
-- Direct user feedback: the uploaded CV wasn't actually visible/downloadable from Supabase's own
-- dashboard, because it was stored as an encrypted base64 string in a Postgres column (not in
-- Supabase's Storage product, which is what actually shows up as browsable files there). This
-- adds storage_path, pointing at the real file in Supabase Storage (see backend/lib/
-- supabaseStorage.ts). file_base64 stays for any rows saved before this change (backward
-- compatible fallback in the download route) but new uploads go to Storage instead. Safe to run
-- again (IF NOT EXISTS guard).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cv_file_uploads' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE cv_file_uploads ADD COLUMN storage_path TEXT;
  END IF;

  -- file_base64 was NOT NULL — new rows (Storage-backed) won't populate it, so relax this.
  ALTER TABLE cv_file_uploads ALTER COLUMN file_base64 DROP NOT NULL;
END $$;
