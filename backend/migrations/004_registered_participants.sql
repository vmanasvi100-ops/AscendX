-- AscendX — Registered Participants
-- Log of emails that have used the study, auto-registered on first verified
-- session (see /api/participants/verify). Not an allowlist — any email with
-- a valid mail domain is accepted and tracked here.
-- Safe to run again (IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS registered_participants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note           TEXT,                     -- optional researcher label (e.g. "cohort A")
  session_count  INTEGER NOT NULL DEFAULT 0,
  first_seen_at  TIMESTAMPTZ,             -- first time they verified
  last_seen_at   TIMESTAMPTZ              -- most recent verification
);

CREATE INDEX IF NOT EXISTS idx_registered_participants_email
  ON registered_participants(email);
