import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Supabase Storage — real, downloadable files, not encrypted blobs in a Postgres column ──────
// Server-side only: uses the service_role key, which bypasses Row Level Security and must never
// reach the frontend (kept in .env, same handling as every other secret in this app). This is
// deliberately separate from db/client.ts's `pg` connection — that's the Postgres wire protocol
// (SQL), this is Supabase's Storage REST API (file objects), a different product entirely even
// though both live under the same Supabase project.

const BUCKET = 'cv-uploads';
let _client: SupabaseClient | null = null;
let _bucketEnsured = false;

const getClient = (): SupabaseClient => {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env — Storage unavailable.');
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
};

// Creates the bucket on first use if it doesn't already exist — private (no public URL access;
// every read goes through a signed URL with a short expiry, generated server-side only).
const ensureBucket = async (): Promise<void> => {
  if (_bucketEnsured) return;
  const client = getClient();
  const { data: buckets, error: listErr } = await client.storage.listBuckets();
  if (listErr) throw listErr;
  if (!buckets?.some(b => b.name === BUCKET)) {
    const { error: createErr } = await client.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB, matches the existing upload cap
    });
    // Ignore "already exists" races (two requests creating it at once) — anything else is real.
    if (createErr && !/already exists/i.test(createErr.message)) throw createErr;
  }
  _bucketEnsured = true;
};

export interface UploadedFile {
  path: string;
}

// path convention: <participantId-or-email>/<timestamp>-<original filename>, so multiple
// uploads from the same candidate don't collide and stay easy to browse by who they belong to.
export const uploadCvFile = async (params: {
  ownerKey: string; // participantId or email, whichever is on file — just used for the folder name
  fileName: string;
  fileMime: string;
  bytes: Buffer;
}): Promise<UploadedFile> => {
  await ensureBucket();
  const client = getClient();
  const safeOwner = params.ownerKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFileName = params.fileName.replace(/[^a-zA-Z0-9_.\-]/g, '_');
  const path = `${safeOwner}/${Date.now()}-${safeFileName}`;

  const { error } = await client.storage.from(BUCKET).upload(path, params.bytes, {
    contentType: params.fileMime,
    upsert: false,
  });
  if (error) throw error;
  return { path };
};

// Signed URL, short-lived (10 minutes) — generated fresh per download request rather than stored,
// so a leaked/cached link stops working quickly. Only ever called from the admin download route.
export const getSignedDownloadUrl = async (path: string, expiresInSeconds = 600): Promise<string> => {
  const client = getClient();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw error ?? new Error('Failed to create signed URL.');
  return data.signedUrl;
};
