/**
 * Calendar date helpers — pure, dependency-free, unit-tested.
 *
 * Convention: the calendar thinks in Asia/Bangkok "day keys" (YYYY-MM-DD) and
 * "HH:mm" wall-clock times. Instants stored in Postgres are UTC ISO strings.
 * Every conversion between the two goes through this module so the +07:00
 * offset lives in exactly one place. Thai month names use the Gregorian
 * calendar (never Buddhist-era years).
 */

export const BANGKOK_TZ = "Asia/Bangkok";
export const BANGKOK_OFFSET = "+07:00";
export const DEFAULT_SCHEDULE_TIME = "19:00";

/** Monday-first weekday labels, matching the grid column order. */
export const THAI_WEEKDAYS_SHORT = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."] as const;
export const THAI_WEEKDAYS_LONG = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"] as const;

export type DayKey = string; // YYYY-MM-DD
export type CalendarView = "month" | "week";

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== "string" || !DAY_KEY_RE.test(value)) return false;
  const { y, m, d } = parseDayKey(value);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

export function isTimeString(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

export function parseDayKey(key: DayKey): { y: number; m: number; d: number } {
  const [, y, m, d] = DAY_KEY_RE.exec(key) ?? [];
  return { y: Number(y), m: Number(m), d: Number(d) };
}

export function toDayKey(y: number, m: number, d: number): DayKey {
  // Date.UTC normalises overflow (month 13 → next year, day 0 → prev month).
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Bangkok calendar day of an instant. */
export function dayKeyInBangkok(instant: Date | string): DayKey {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return d.toLocaleDateString("en-CA", { timeZone: BANGKOK_TZ });
}

/** Bangkok wall-clock "HH:mm" of an instant. */
export function timeInBangkok(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

/**
 * Bangkok day + "HH:mm" → UTC ISO string. Throws on malformed input so server
 * actions fail loudly instead of writing a bad timestamp.
 */
export function buildBangkokISO(day: DayKey, time: string = DEFAULT_SCHEDULE_TIME): string {
  if (!isDayKey(day)) throw new Error(`Invalid day key: ${day}`);
  if (!isTimeString(time)) throw new Error(`Invalid time: ${time}`);
  return new Date(`${day}T${time}:00${BANGKOK_OFFSET}`).toISOString();
}

/** Move an instant to another Bangkok day, keeping its Bangkok time-of-day. */
export function shiftToDay(instant: string, newDay: DayKey): string {
  return buildBangkokISO(newDay, timeInBangkok(instant));
}

export function addDays(key: DayKey, n: number): DayKey {
  const { y, m, d } = parseDayKey(key);
  return toDayKey(y, m, d + n);
}

/** First day of the month `n` months away (used for month navigation). */
export function addMonths(key: DayKey, n: number): DayKey {
  const { y, m } = parseDayKey(key);
  return toDayKey(y, m + n, 1);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key: DayKey): number {
  const { y, m, d } = parseDayKey(key);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function startOfWeek(key: DayKey): DayKey {
  return addDays(key, -weekdayIndex(key));
}

export function weekDays(key: DayKey): DayKey[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * Full-week grid covering the month that contains `key`, Monday-first.
 * Returns 28–42 day keys (4–6 rows) — only the rows the month actually needs.
 */
export function monthGrid(key: DayKey): DayKey[] {
  const { y, m } = parseDayKey(key);
  const first = toDayKey(y, m, 1);
  const lead = weekdayIndex(first);
  const total = lead + daysInMonth(y, m);
  const rows = Math.ceil(total / 7);
  const start = addDays(first, -lead);
  return Array.from({ length: rows * 7 }, (_, i) => addDays(start, i));
}

export function isSameMonth(a: DayKey, b: DayKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Days rendered for a view plus the half-open UTC range [start, end) to query. */
export function rangeForView(view: CalendarView, key: DayKey): { days: DayKey[]; start: string; end: string } {
  const days = view === "week" ? weekDays(key) : monthGrid(key);
  return {
    days,
    start: buildBangkokISO(days[0], "00:00"),
    end: buildBangkokISO(addDays(days[days.length - 1], 1), "00:00"),
  };
}

// ─── Thai (Gregorian) formatting ─────────────────────────────────────────────
const thMonthLong = new Intl.DateTimeFormat("th-TH-u-ca-gregory", { month: "long", timeZone: "UTC" });
const thMonthShort = new Intl.DateTimeFormat("th-TH-u-ca-gregory", { month: "short", timeZone: "UTC" });

function utcDate(key: DayKey): Date {
  const { y, m, d } = parseDayKey(key);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "กันยายน 2026" — Thai month, Gregorian year. */
export function formatThaiMonth(key: DayKey): string {
  const { y } = parseDayKey(key);
  return `${thMonthLong.format(utcDate(key))} ${y}`;
}

/** "9 ก.ย." */
export function formatThaiDayShort(key: DayKey): string {
  const { d } = parseDayKey(key);
  return `${d} ${thMonthShort.format(utcDate(key))}`;
}

/** "พฤหัสบดี 9 ก.ย. 2026" */
export function formatThaiDayLong(key: DayKey): string {
  const { y } = parseDayKey(key);
  return `${THAI_WEEKDAYS_LONG[weekdayIndex(key)]} ${formatThaiDayShort(key)} ${y}`;
}

/** "7 – 13 ก.ย. 2026" or "28 ก.ย. – 4 ต.ค. 2026" across a month boundary. */
export function formatThaiWeekRange(key: DayKey): string {
  const days = weekDays(key);
  const a = days[0];
  const b = days[6];
  const { y } = parseDayKey(b);
  if (isSameMonth(a, b)) return `${parseDayKey(a).d} – ${formatThaiDayShort(b)} ${y}`;
  return `${formatThaiDayShort(a)} – ${formatThaiDayShort(b)} ${y}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
