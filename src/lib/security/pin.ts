import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * One-way hashing for the app-lock PIN (scrypt + per-PIN salt). Stored as
 * `salt:hash` hex. Never store or log the raw PIN. Verification is
 * constant-time.
 */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPinHash(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(pin, salt, 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
