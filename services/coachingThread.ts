// ── Coaching Thread client — Talk It Through's cross-session continuity ───────────────────────
// Talks to backend/routes/coachingThreads.ts directly (fetch, not the AI proxy — this is plain
// CRUD, no model call involved). Two keys, by design: participantId (durable, localStorage-backed
// per-device identity — see context/SettingsContext.tsx) is the primary one, no per-session cost;
// email is the secondary/fallback key for the genuine cross-device case (same self-reported,
// unverified-email caveat as the other by-email tables in this app — see backend/FRAMEWORK.md).

export interface CoachingThread {
  id: string;
  questionText: string;
  focus: string | null;
  plan: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
}

export const getLatestCoachingThreadByParticipant = async (participantId: string): Promise<CoachingThread | null> => {
  if (!participantId.trim()) return null;
  try {
    const res = await fetch(`/api/coaching-threads/by-participant/${encodeURIComponent(participantId.trim())}/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.thread ?? null;
  } catch (err) {
    console.error('Failed to fetch coaching thread by participant:', err);
    return null;
  }
};

export const getLatestCoachingThreadByEmail = async (email: string): Promise<CoachingThread | null> => {
  if (!email.trim()) return null;
  try {
    const res = await fetch(`/api/coaching-threads/by-email/${encodeURIComponent(email.trim().toLowerCase())}/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.thread ?? null;
  } catch (err) {
    console.error('Failed to fetch coaching thread by email:', err);
    return null;
  }
};

export const saveCoachingThread = async (params: {
  participantId?: string | null; email?: string | null; questionText: string; focus: string; plan: string;
}): Promise<void> => {
  if (!params.participantId?.trim() && !params.email?.trim()) return; // nothing to key this save by
  try {
    await fetch('/api/coaching-threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.error('Failed to save coaching thread:', err);
  }
};

export const markCoachingThreadReviewed = async (id: string): Promise<void> => {
  try {
    await fetch(`/api/coaching-threads/${encodeURIComponent(id)}/reviewed`, { method: 'PATCH' });
  } catch (err) {
    console.error('Failed to mark coaching thread reviewed:', err);
  }
};
