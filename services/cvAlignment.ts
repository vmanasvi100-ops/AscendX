// ── CV Alignment client — durable backend home for the uploaded CV/JD and its alignment ────────
// Talks to backend/routes/cvAlignment.ts directly (fetch, not the AI proxy — plain CRUD, no
// model call involved). Two keys, by design: participantId is available immediately on page load
// and has no timing race, so it's the reliable save-at-upload-time / fetch-first key within a
// session; email is the cross-session/cross-device fallback (same self-reported, unverified-email
// caveat as the other by-email tables in this app — see backend/FRAMEWORK.md).

export interface StoredCvAlignment {
  id: string;
  companyName: string | null;
  targetRole: string | null;
  jobDescription: string | null;
  alignmentSummary: string | null;
  strengthAreas: { area: string; cvEvidence: string; jdRequirement: string }[] | null;
  cvText: string | null;
  createdAt: string;
}

export const getLatestCvAlignmentByParticipant = async (participantId: string): Promise<StoredCvAlignment | null> => {
  if (!participantId.trim()) return null;
  try {
    const res = await fetch(`/api/cv-alignment/by-participant/${encodeURIComponent(participantId.trim())}/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.analysis ?? null;
  } catch (err) {
    console.error('Failed to fetch CV alignment analysis by participant:', err);
    return null;
  }
};

export const getLatestCvAlignmentByEmail = async (email: string): Promise<StoredCvAlignment | null> => {
  if (!email.trim()) return null;
  try {
    const res = await fetch(`/api/cv-alignment/by-email/${encodeURIComponent(email.trim().toLowerCase())}/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.analysis ?? null;
  } catch (err) {
    console.error('Failed to fetch CV alignment analysis by email:', err);
    return null;
  }
};

export const saveCvAlignment = async (params: {
  participantId?: string | null;
  email?: string | null;
  companyName: string | null;
  targetRole: string | null;
  jobDescription: string | null;
  alignmentSummary?: string | null;
  strengthAreas?: { area: string; cvEvidence: string; jdRequirement: string }[] | null;
  cvText?: string | null;
}): Promise<void> => {
  if (!params.participantId?.trim() && !params.email?.trim()) return; // nothing to key this save by
  try {
    await fetch('/api/cv-alignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.error('Failed to save CV alignment analysis:', err);
  }
};
