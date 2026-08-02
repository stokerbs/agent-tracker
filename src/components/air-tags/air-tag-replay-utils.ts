/**
 * Pure helpers shared by air-tag-route-replay.tsx and air-tag-position-table.tsx.
 * Kept in a plain .ts module (no JSX) so they're directly unit-testable —
 * vitest.config.ts only collects `src/**\/*.test.ts`, and neither
 * route-replay.tsx nor any other map component in this codebase has a test
 * file, so there's no existing convention for testing the .tsx map surface
 * itself; the testable surface area is this pure logic.
 *
 * Date-navigation helpers mirror src/components/gps903/route-replay.tsx's
 * bangkokToday()/shiftDay()/bangkokDateOf(), but AirTag history has no
 * HISTORY_MAX_DAYS cap — see airTagMinDate().
 */

export const AIR_TAG_BKK_DAY = {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
} as const;

/** Today's date (YYYY-MM-DD) in Asia/Bangkok. */
export function airTagBangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", AIR_TAG_BKK_DAY).format(new Date());
}

/** Shift a YYYY-MM-DD date by `delta` calendar days in Asia/Bangkok. */
export function shiftAirTagDay(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00+07:00`); // noon avoids day-boundary rounding
  d.setDate(d.getDate() + delta);
  return new Intl.DateTimeFormat("en-CA", AIR_TAG_BKK_DAY).format(d);
}

/** Bangkok calendar day of an ISO timestamp (or null if absent/invalid). */
export function airTagBangkokDateOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", AIR_TAG_BKK_DAY).format(d);
}

/**
 * Earliest selectable replay date. Unlike GPS903's route-replay (capped to
 * HISTORY_MAX_DAYS = 30 because that data is pruned), AirTag positions are
 * never auto-pruned (migration 0107), so the picker may go back to whenever
 * the tracker was created. Falls back to a generous fixed floor if the
 * tracker's created_at is missing/unparseable, rather than leaving the date
 * picker unbounded (a broken `min` attribute would let the input accept any
 * string).
 */
export function airTagMinDate(createdAt: string | null | undefined): string {
  return airTagBangkokDateOf(createdAt) ?? "2000-01-01";
}

/** Human label for the `source` column ("manual" | "csv_import" | anything future/unknown). */
export function formatSourceLabel(source: string): string {
  if (source === "csv_import") return "CSV import";
  if (source === "manual") return "Manual";
  return source;
}

/** Total pages for a page-size'd list; always at least 1. */
export function pageCountFor(totalCount: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

/** Clamp a requested page number into [1, pageCount]. */
export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), Math.max(1, pageCount));
}
