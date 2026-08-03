/**
 * OTP generation/verification helpers for the LINE-bot account-linking flow
 * (see src/lib/line/router.ts). All state lives in a `line_accounts` row
 * (otp_code_hash / otp_expires_at / otp_attempts / otp_requested_at) — these
 * are pure functions with no DB access of their own.
 *
 * The raw OTP is never persisted, only its sha256 hash (matching the hashing
 * convention already used for bearer tokens elsewhere in this repo, e.g.
 * src/app/(dashboard)/air-tags/actions.ts and the air-tag webhook route).
 */
import { randomInt, createHash, timingSafeEqual } from "node:crypto";

/** Digits in a generated OTP. */
export const OTP_LENGTH = 6;

/** How long a generated OTP remains valid. */
export const OTP_TTL_MS = 10 * 60_000; // 10 minutes

/** Verification attempts allowed against a single OTP before lockout. */
export const OTP_MAX_ATTEMPTS = 5;

/** Minimum time between two OTP requests for the same LINE account. */
export const OTP_RESEND_COOLDOWN_MS = 60_000; // 1 minute

/** Generate a random, zero-padded numeric OTP (e.g. "042817"). */
export function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  return randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
}

/** sha256 hash of a raw OTP — this is the only form ever stored. */
export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Constant-time comparison of a candidate raw code against a stored hash.
 * Always hash-then-compare (never compare raw codes) so timing leaks nothing
 * about the stored hash either.
 */
export function verifyOtpHash(candidate: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(candidate));
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** True when `expiresAt` (ISO timestamp, or null/undefined) is in the past. */
export function isOtpExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true;
  const t = new Date(expiresAt).getTime();
  return Number.isNaN(t) || t < Date.now();
}

/**
 * True when enough time has passed since `requestedAt` (ISO timestamp, or
 * null/undefined for "never requested") to allow issuing a fresh OTP.
 */
export function canRequestNewOtp(requestedAt: string | null | undefined): boolean {
  if (!requestedAt) return true;
  const t = new Date(requestedAt).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t >= OTP_RESEND_COOLDOWN_MS;
}
