-- AscendX — Coaching Threads (Talk It Through, cross-session continuity)
--
-- Lets Talk It Through remember a candidate's plan across sessions and open the next
-- conversation with a review of it ("Last time you planned to try X — how did that go?"),
-- instead of starting from zero every time. Keyed by email, the one identifier stable across
-- devices in this app (participant_id resets per browser session) — same tradeoff already made
-- for session history (see 008_session_history.sql): email here is NOT verified (no OTP flow
-- yet), so this carries the same pending-auth caveat as the existing by-email session-history
-- endpoint. The sensitive fields (the candidate's own reflective words) are encrypted at rest,
-- same as cv_text/job_description on `sessions`.
--
-- Simplified relative to the full coaching-thread spec: one row per conversation, most recent
-- row per email is "the" thread to review next time — not a full multi-thread-per-focus-area
-- system, and no separate keep/adjust/done/pause selector UI (see backend/FRAMEWORK.md).
-- Safe to run again (IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS coaching_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL,
  question_text   TEXT NOT NULL,
  focus           TEXT,   -- encrypted — candidate's own words, what this conversation was about
  plan            TEXT,   -- encrypted — the "what we could try" suggestions from the Clear Picture
  status          TEXT NOT NULL DEFAULT 'open',   -- open | done | paused
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_coaching_threads_email_created
  ON coaching_threads(email, created_at DESC);
