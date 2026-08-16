-- AscendX — Participant Snapshots
-- Lightweight cross-device session memory keyed by normalised email.
-- Stores only the minimal fields needed for the welcome-back card and
-- STAR delta — not the full session log or feedback report.
-- Safe to run again (IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS participant_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_key   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot    JSONB NOT NULL
  -- snapshot shape: { date, starScores, priority, strength, weakness }
);

CREATE INDEX IF NOT EXISTS idx_snapshots_email_key
  ON participant_snapshots(email_key, created_at DESC);
