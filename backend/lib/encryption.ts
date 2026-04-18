import crypto from 'crypto';

// AES-256-GCM — authenticated encryption
// Key must be 32 bytes — set ENCRYPTION_KEY in .env as a 64-char hex string
// Generate one with: node -e "console.log(crypto.randomBytes(32).toString('hex'))"

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const getKey = (): Buffer => {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(raw, 'hex');
};

// Returns: iv:authTag:ciphertext (all hex-encoded, colon-separated)
export const encrypt = (plaintext: string): string => {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
};

export const decrypt = (ciphertext: string): string => {
  if (!ciphertext || !ciphertext.includes(':')) return ciphertext;
  const key = getKey();
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

// Hash participant IP before storing — one-way, cannot be reversed
export const hashIP = (ip: string): string =>
  crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'ascendx')).digest('hex');

// Double-hash participant ID for audit log — audit trail without identity linkage
export const hashForAudit = (participantId: string): string =>
  crypto.createHash('sha256')
    .update(participantId + (process.env.AUDIT_SALT || 'ascendx-audit'))
    .digest('hex');
