
// Local-only Reflection Library storage — IndexedDB, never uploaded. A candidate opts in via
// Support settings ("Save clips" → "On this device only"); with it off, none of this is ever
// called. Clips are never analysed beyond the transcript already produced for live coaching
// (no face, gaze, tone, or accent analysis — that's a hard rule, not a setting), and are never
// used to train any model. This file has no network calls; everything stays in the browser's
// own IndexedDB for that one device.

export interface ReflectionCard {
  id: string;
  questionText: string;
  transcript: string;
  mimeType: string; // 'video/webm' or 'audio/webm'
  blob: Blob;
  createdAt: number;
}

export type ReflectionCardMeta = Omit<ReflectionCard, 'blob'>;

const DB_NAME = 'ascendx_reflection_library';
const DB_VERSION = 1;
const STORE_NAME = 'clips';

// Clip cap — 3 minutes, matching the Reflection Library's own stated limit (keeps local storage
// bounded; nothing here represents an interview-structure rule).
export const MAX_CLIP_SECONDS = 180;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveClip(entry: Omit<ReflectionCard, 'id' | 'createdAt'>): Promise<string> {
  const db = await openDB();
  const id = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const card: ReflectionCard = { ...entry, id, createdAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(card);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listClips(): Promise<ReflectionCardMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const cards: ReflectionCard[] = req.result || [];
      const meta = cards
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(({ blob, ...rest }) => rest);
      resolve(meta);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getClipBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ? (req.result as ReflectionCard).blob : null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteClip(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAllClips(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
