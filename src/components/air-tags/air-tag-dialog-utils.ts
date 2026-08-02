/**
 * Pure client-side helpers for the AirTag dialogs (create tracker, manual
 * ping, CSV import). Every value produced here is UX feedback ONLY — the
 * authoritative validation lives server-side in
 * src/app/(dashboard)/air-tags/actions.ts (Golden Rule 1: never trust
 * client-side validation as a security boundary). Kept in a plain .ts module
 * (no JSX) so it's directly unit-testable — vitest.config.ts only collects
 * `src/**\/*.test.ts`.
 */

// Mirrors the CHECK constraints in supabase/migrations/0107_air_tag_trackers.sql
// and the zod schemas in air-tags/actions.ts — kept here as UI-only hints
// (character counters, disabled states) so the server is always re-validating
// independently.
export const AIR_TAG_LABEL_MAX = 120;
export const AIR_TAG_SERIAL_MAX = 64;
export const AIR_TAG_TRACKER_NOTES_MAX = 2000;
export const AIR_TAG_PING_NOTE_MAX = 500;

/** Format a Date as a `datetime-local` input value (YYYY-MM-DDTHH:mm) in the browser's local time zone. */
export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse a `datetime-local` input value back into a Date, or null if empty/unparseable. */
export function fromDatetimeLocalValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** UX-only hint: true when a candidate lat string is a number within [-90, 90]. */
export function isLatInRange(value: string): boolean {
  if (value.trim() === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

/** UX-only hint: true when a candidate lng string is a number within [-180, 180]. */
export function isLngInRange(value: string): boolean {
  if (value.trim() === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

/** UX-only hint: true when a candidate accuracy string is a positive integer. */
export function isPositiveIntString(value: string): boolean {
  if (value.trim() === "") return true; // optional field
  return /^\d+$/.test(value.trim()) && Number(value) > 0;
}

export const AIR_TAG_CSV_TEMPLATE_HEADER = "lat,lng,recorded_at,accuracy_m,note";
export const AIR_TAG_CSV_TEMPLATE_EXAMPLE_ROW =
  "13.736717,100.523186,2026-01-15T08:30:00.000Z,5,Seen leaving the parking garage";

/** Downloadable CSV template text matching importAirTagPingsCsv's expected columns. */
export function buildAirTagCsvTemplate(): string {
  return `${AIR_TAG_CSV_TEMPLATE_HEADER}\n${AIR_TAG_CSV_TEMPLATE_EXAMPLE_ROW}\n`;
}

/** True when a File's name has a `.csv` extension (case-insensitive) — UX filter only, server re-validates content. */
export function isCsvFileName(name: string): boolean {
  return /\.csv$/i.test(name.trim());
}
