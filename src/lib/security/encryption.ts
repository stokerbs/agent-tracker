import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

// Wire format: version(1) || nonce(12) || ciphertext(var) || auth_tag(16)
const VERSION    = 0x01;
const NONCE_LEN  = 12;
const TAG_LEN    = 16;
const MIN_BLOB   = 1 + NONCE_LEN + TAG_LEN; // 29 bytes — empty plaintext minimum

// Keys are validated once on first use and cached for the process lifetime.
let _keys: { enc: Buffer; bidx: Buffer } | null = null;

function getKeys(): { enc: Buffer; bidx: Buffer } {
  if (_keys) return _keys;

  const encHex  = process.env.ENCRYPTION_KEY ?? "";
  const bidxHex = process.env.BIDX_KEY ?? "";
  const hexRe   = /^[\da-f]{64}$/i;

  if (!hexRe.test(encHex)) {
    throw new Error(
      "ENCRYPTION_KEY is not set or invalid — must be a 64-character hex string (32 bytes). " +
      "Generate with: openssl rand -hex 32",
    );
  }
  if (!hexRe.test(bidxHex)) {
    throw new Error(
      "BIDX_KEY is not set or invalid — must be a 64-character hex string (32 bytes). " +
      "Generate with: openssl rand -hex 32",
    );
  }

  _keys = {
    enc:  Buffer.from(encHex,  "hex"),
    bidx: Buffer.from(bidxHex, "hex"),
  };
  return _keys;
}

// ─── normalizers (exported for search-query reuse) ────────────────────────────

export const normalizeName = (v: string): string =>
  v.toLowerCase().trim().replace(/\s+/g, " ");

export const normalizePhone = (v: string): string =>
  v.replace(/\D/g, "");

export const normalizeLicensePlate = (v: string): string =>
  v.toUpperCase().replace(/[\s-]/g, "");

// ─── private HMAC core ────────────────────────────────────────────────────────

function hmacHex(normalised: string): string {
  const { bidx } = getKeys();
  return createHmac("sha256", bidx).update(normalised, "utf8").digest("hex");
}

// ─── encryption ───────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string with AES-256-GCM.
 *
 * Each call generates a fresh 12-byte nonce so identical plaintexts produce
 * different ciphertexts, preventing frequency analysis.
 *
 * Returns base64( version || nonce || ciphertext || auth_tag ).
 */
export function encryptField(value: string): string {
  const { enc } = getKeys();
  const nonce   = randomBytes(NONCE_LEN);
  const cipher  = createCipheriv("aes-256-gcm", enc, nonce);
  const body    = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag     = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), nonce, body, tag]).toString("base64");
}

/**
 * Decrypts a value produced by encryptField.
 *
 * Throws if the blob is malformed, uses an unknown version, or the GCM auth
 * tag does not match (indicating tampering or key mismatch).
 */
export function decryptField(encrypted: string): string {
  const { enc } = getKeys();
  const blob    = Buffer.from(encrypted, "base64");

  if (blob.length < MIN_BLOB) {
    throw new Error(
      `Ciphertext is too short to be valid (got ${blob.length} bytes, minimum ${MIN_BLOB})`,
    );
  }

  const ver = blob[0];
  if (ver !== VERSION) {
    throw new Error(
      `Unknown encryption version 0x${ver.toString(16).padStart(2, "0")}`,
    );
  }

  const nonce    = blob.subarray(1, 1 + NONCE_LEN);
  const tag      = blob.subarray(blob.length - TAG_LEN);
  const body     = blob.subarray(1 + NONCE_LEN, blob.length - TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", enc, nonce);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

// ─── blind indexes ────────────────────────────────────────────────────────────

/**
 * Blind index for target_name / agent names.
 * Normalises to: lowercase, trimmed, single-space-collapsed.
 */
export function createNameBlindIndex(value: string): string {
  return hmacHex(normalizeName(value));
}

/**
 * Blind index for phone numbers.
 * Normalises to: digits only (strips spaces, dashes, parentheses, country codes).
 */
export function createPhoneBlindIndex(value: string): string {
  return hmacHex(normalizePhone(value));
}

/**
 * Blind index for license plates.
 * Normalises to: uppercase, no spaces, no dashes.
 */
export function createLicensePlateBlindIndex(value: string): string {
  return hmacHex(normalizeLicensePlate(value));
}

// ─── startup ──────────────────────────────────────────────────────────────────

/** Called by the instrumentation hook to fail fast on startup if keys are missing/invalid. */
export function validateEncryptionKeys(): void {
  getKeys();
}
