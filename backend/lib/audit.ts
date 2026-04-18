import { query } from '../db/client.js';
import { hashForAudit } from './encryption.js';

export type AuditEventType =
  | 'consent_granted'
  | 'consent_withdrawn'
  | 'session_created'
  | 'session_updated'
  | 'session_completed'
  | 'session_abandoned'
  | 'data_accessed'
  | 'data_exported'
  | 'data_deleted'
  | 'cv_purged'
  | 'layer_b_purged'
  | 'session_expired'
  | 'feedback_flagged'
  | 'flag_reviewed';

export type AuditActor = 'participant' | 'system' | 'researcher';

interface LogEventParams {
  eventType: AuditEventType;
  actor: AuditActor;
  participantId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export const logAuditEvent = async (params: LogEventParams): Promise<void> => {
  try {
    await query(
      `INSERT INTO audit_log
         (participant_id_hash, session_id, event_type, actor, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        params.participantId ? hashForAudit(params.participantId) : null,
        params.sessionId ?? null,
        params.eventType,
        params.actor,
        JSON.stringify(params.metadata ?? {}),
      ]
    );
  } catch (err) {
    // Audit log failure should never crash the application
    // but must be surfaced so it can be investigated
    console.error('[AUDIT] Failed to write audit event:', params.eventType, err);
  }
};
