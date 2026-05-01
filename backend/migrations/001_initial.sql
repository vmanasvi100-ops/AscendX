-- AscendX Backend — Initial Schema
-- GDPR-compliant session logging with consent management
-- Run once on first startup. Safe to run again (IF NOT EXISTS guards).

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 1. Consent Records ───────────────────────────────────────────────────────
-- One row per consent event. Append-only — rows are never updated or deleted.
-- Withdrawals are recorded in the JSONB array, not by deleting the row.

CREATE TABLE IF NOT EXISTS consent_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id      TEXT NOT NULL,
  consent_version     TEXT NOT NULL DEFAULT 'v1.0',
  ip_hash             TEXT,                          -- SHA-256 of IP, not raw IP
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Granular consent gates (each separately recorded)
  product_use         BOOLEAN NOT NULL DEFAULT FALSE,
  product_use_at      TIMESTAMPTZ,

  audio_processing    BOOLEAN NOT NULL DEFAULT FALSE,
  audio_processing_at TIMESTAMPTZ,

  third_party         BOOLEAN NOT NULL DEFAULT FALSE,
  third_party_at      TIMESTAMPTZ,

  research            BOOLEAN NOT NULL DEFAULT FALSE,
  research_at         TIMESTAMPTZ,

  -- Withdrawal log — append-only JSONB array
  -- [{ "scope": "research", "withdrawn_at": "2026-04-11T14:32:00Z" }]
  withdrawals         JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_consent_participant
  ON consent_records(participant_id);

-- ─── 2. Sessions ──────────────────────────────────────────────────────────────
-- One row per interview session. Config fields are encrypted at application layer.
-- Raw transcript is NEVER stored. Only masked_transcript (pseudonymised).

CREATE TABLE IF NOT EXISTS sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id          TEXT NOT NULL,
  consent_id              UUID REFERENCES consent_records(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at            TIMESTAMPTZ,
  status                  TEXT NOT NULL DEFAULT 'in_progress'
                          CHECK (status IN ('in_progress', 'complete', 'abandoned')),

  -- Config — encrypted at application layer before insert
  company_name            TEXT,                      -- encrypted
  target_role             TEXT,                      -- encrypted
  job_description         TEXT,                      -- encrypted, purged at retention_expiry
  cv_text                 TEXT,                      -- encrypted, purged at cv_purge_date
  cv_purge_date           TIMESTAMPTZ,               -- created_at + 30 days
  settings                JSONB DEFAULT '{}',        -- timer, tools, accessibility (not sensitive)

  -- Progress
  current_question_index  INTEGER NOT NULL DEFAULT 0,
  questions_completed     INTEGER NOT NULL DEFAULT 0,
  questions               JSONB DEFAULT '[]',        -- generated Question[] array

  -- Per-question session log (no raw transcript)
  -- SessionEntry[]: STAR phase reached, probe data, question summary reports
  session_log             JSONB DEFAULT '[]',

  -- Feedback
  layer_a                 JSONB,                     -- candidate-facing report, always stored
  layer_b                 JSONB,                     -- researcher signals, NULL unless research consent
  masked_transcript       TEXT,                      -- pseudonymised by AI, not raw

  -- Retention
  retention_expiry        TIMESTAMPTZ,               -- created_at + 12 months
  purged_at               TIMESTAMPTZ                -- set when CV/JD are hard-deleted
);

CREATE INDEX IF NOT EXISTS idx_sessions_participant
  ON sessions(participant_id);

CREATE INDEX IF NOT EXISTS idx_sessions_status
  ON sessions(status);

CREATE INDEX IF NOT EXISTS idx_sessions_retention
  ON sessions(retention_expiry)
  WHERE purged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_cv_purge
  ON sessions(cv_purge_date)
  WHERE cv_text IS NOT NULL;

-- ─── 3. Audit Log ─────────────────────────────────────────────────────────────
-- Immutable record of every data access and processing event.
-- Required for GDPR accountability (Article 5(2)).
-- Rows are NEVER deleted — the audit log is permanent.

CREATE TABLE IF NOT EXISTS audit_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  participant_id_hash   TEXT,                        -- double-hashed — identity not needed for audit
  session_id            UUID,                        -- nullable — some events are session-independent
  event_type            TEXT NOT NULL,
  -- consent_granted | consent_withdrawn
  -- session_created | session_updated | session_completed | session_abandoned
  -- data_accessed | data_exported | data_deleted
  -- cv_purged | layer_b_purged | session_expired
  -- feedback_flagged | flag_reviewed
  actor                 TEXT NOT NULL DEFAULT 'system',
  -- 'participant' | 'system' | 'researcher'
  metadata              JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_audit_participant
  ON audit_log(participant_id_hash);

CREATE INDEX IF NOT EXISTS idx_audit_session
  ON audit_log(session_id);

CREATE INDEX IF NOT EXISTS idx_audit_event_type
  ON audit_log(event_type);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp
  ON audit_log(timestamp);

-- ─── 4. Feedback Flags ────────────────────────────────────────────────────────
-- Human oversight mechanism — candidates can flag inaccurate report sections.
-- Required for GDPR Article 22 (automated decision-making safeguards).

CREATE TABLE IF NOT EXISTS feedback_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  flagged_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  section           TEXT NOT NULL,                  -- which report section was flagged
  candidate_note    TEXT,                           -- what they said was wrong
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'reviewed', 'resolved')),
  reviewer_note     TEXT,
  reviewed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_flags_session
  ON feedback_flags(session_id);

CREATE INDEX IF NOT EXISTS idx_flags_status
  ON feedback_flags(status);
