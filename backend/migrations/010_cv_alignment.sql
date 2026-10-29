-- AscendX — CV/JD Alignment Analysis persistence
--
-- Fixes the actual root cause behind repeated "Talk It Through has no CV information" reports:
-- the analysis (services/questionService.ts's generateJDCVAlignmentQuestions, run once during
-- WelcomeScreen's Phase 2) previously lived ONLY in frontend React context (jdcvAlignmentAnalysis
-- in SettingsContext) — fragile by construction: lost on a page refresh, lost if Talk It Through
-- opens before the async Phase 2 call resolves, lost on a different device/tab. This table gives
-- it a durable home, keyed by email (the one identifier stable across devices in this app — same
-- choice already made for session history and Coaching Threads), so the frontend can fetch it
-- directly as a fallback instead of depending solely on in-memory state.
--
-- Same caveat as the other by-email tables in this app (008_session_history.sql,
-- 009_coaching_threads.sql): email here is self-reported, not verified (no OTP flow yet). The
-- sensitive fields are encrypted at rest, same treatment as cv_text/job_description on `sessions`.
-- Safe to run again (IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS cv_alignment_analyses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT NOT NULL,
  company_name       TEXT,
  target_role        TEXT,
  job_description    TEXT,   -- encrypted
  alignment_summary  TEXT,   -- encrypted
  strength_areas     TEXT,   -- encrypted JSON: {area, cvEvidence, jdRequirement}[]
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_alignment_email_created
  ON cv_alignment_analyses(email, created_at DESC);
