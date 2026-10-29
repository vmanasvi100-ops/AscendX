// ── CV file upload client — saves the raw PDF/Word file to Supabase at upload time ─────────────
// Talks to backend/routes/cvFiles.ts (plain fetch, not the AI proxy). Independent of
// services/cvAlignment.ts on purpose — see backend/migrations/013_cv_file_uploads.sql: this is
// an append-only record of what was actually uploaded, never superseded by a later save.

export const saveCvFile = async (params: {
  participantId?: string | null;
  email?: string | null;
  fileName: string;
  fileMime: string;
  fileBase64: string;
}): Promise<void> => {
  if (!params.participantId?.trim() && !params.email?.trim()) return;
  try {
    const res = await fetch('/api/cv-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Failed to save CV file:', err.error || res.status);
    }
  } catch (err) {
    console.error('Failed to save CV file:', err);
  }
};

// Reads a File as a base64 string (no data: URL prefix), suitable for JSON transport.
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};
