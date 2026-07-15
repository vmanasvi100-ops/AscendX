-- AscendX — Analytics Events Table
-- Persistent backend store for per-participant analytics events.
-- Frontend localStorage remains the primary real-time source.
-- This table provides durable research-grade storage and researcher-level querying.

CREATE TABLE IF NOT EXISTS analytics_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  condition       TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ae_participant
  ON analytics_events(participant_id);

CREATE INDEX IF NOT EXISTS idx_ae_type
  ON analytics_events(event_type);

CREATE INDEX IF NOT EXISTS idx_ae_occurred
  ON analytics_events(occurred_at DESC);
