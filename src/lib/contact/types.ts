/**
 * Contact Intelligence — shared types + input validation.
 *
 * Phase 1 resolves a target PHONE in-process. Email-breach and username-discovery
 * are Phase 2 (env-gated adapter seam) — their stages report `skipped` until wired.
 *
 * The input is a target's personal identifier (PII): the route encrypts it before
 * persisting and never stores the raw value.
 */

import { z } from "zod";

export const CONTACT_INPUT_TYPES = ["phone", "email", "username"] as const;
export type ContactInputType = (typeof CONTACT_INPUT_TYPES)[number];

/** Analyze request. Exactly one identifier, tagged by type. */
export const contactRequestSchema = z.object({
  type: z.enum(CONTACT_INPUT_TYPES),
  value: z.string().trim().min(1).max(256),
  /** Optional default region for local phone numbers (ISO-3166, e.g. "TH"). */
  region: z.string().length(2).optional(),
  case_id: z.string().uuid().optional(),
});
export type ContactRequest = z.infer<typeof contactRequestSchema>;

// ── Stages ────────────────────────────────────────────────────────────────────
export const CONTACT_STAGE_NAMES = ["input", "phone", "breach", "accounts"] as const;
export type ContactStageName = (typeof CONTACT_STAGE_NAMES)[number];
export type StageState = "pending" | "processing" | "complete" | "failed" | "skipped";
export type ContactStageStatus = Partial<Record<ContactStageName, StageState>>;

// ── Result shapes ─────────────────────────────────────────────────────────────

export interface PhoneInfo {
  valid: boolean;
  possible: boolean;
  /** E.164, e.g. +66812345678 — PII, redacted server-side unless authorized. */
  e164: string | null;
  national: string | null;
  international: string | null;
  country: string | null; // ISO country
  countryCallingCode: string | null;
  lineType: string | null; // mobile | fixed_line | voip | ...
}

export interface ContactReverseLink {
  engine: string;
  label: string;
  url: string;
}

export interface ContactResult {
  id: string;
  status: "complete" | "failed" | "processing";
  stageStatus: ContactStageStatus;
  caseId: string | null;
  inputType: ContactInputType;
  /** The normalized identifier, echoed back for display (not re-stored raw). */
  inputDisplay: string;
  phone: PhoneInfo | null;
  reverseSearch: ContactReverseLink[];
  error: string | null;
}
