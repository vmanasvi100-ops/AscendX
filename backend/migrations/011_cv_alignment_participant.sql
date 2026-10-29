-- AscendX — CV alignment: save at upload time, keyed by participant, not just email
--
-- Closes a real gap found after 010_cv_alignment.sql shipped: that table only ever got written
-- once Phase 2's alignment AI call succeeded AND the candidate's email was known (typed into the
-- consent modal, which opens over WelcomeScreen on a separate, loosely-timed path). If Phase 2
-- failed, was still running, or the candidate was slow to reach the consent modal, nothing was
-- saved at all — not even the raw CV/JD text, which (ironically) was essentially never reaching
-- `sessions.cv_text` either, since that only gets written at session-COMPLETION time, by which
-- point WelcomeScreen has already wiped cvText from memory for privacy.
--
-- Fix: participant_id (generated client-side on page load, stable for the browser tab/session,
-- available immediately — no timing race) becomes a second, independent key. The raw CV/JD text
-- gets saved under it the moment the candidate clicks through from WelcomeScreen, before any wipe
-- and before Phase 2 has even started, let alone resolved. The richer alignment-analysis row
-- (saved by email, once Phase 2 succeeds) still happens separately and is still preferred when
-- present. Safe to run again (IF NOT EXISTS / conditional guards).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cv_alignment_analyses' AND column_name = 'participant_id'
  ) THEN
    ALTER TABLE cv_alignment_analyses ADD COLUMN participant_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cv_alignment_analyses' AND column_name = 'cv_text'
  ) THEN
    ALTER TABLE cv_alignment_analyses ADD COLUMN cv_text TEXT; -- encrypted, same as sessions.cv_text
  END IF;

  -- email was NOT NULL in 010 — relax it, since a participant-keyed row saved at upload time may
  -- not have an email yet (the candidate hasn't reached the consent modal).
  ALTER TABLE cv_alignment_analyses ALTER COLUMN email DROP NOT NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_cv_alignment_participant_created
  ON cv_alignment_analyses(participant_id, created_at DESC)
  WHERE participant_id IS NOT NULL;
