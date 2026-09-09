import { formatDate } from "@/lib/utils";

/** "HH:mm" in Asia/Bangkok (app convention for times). */
export function formatTimeBkk(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" });
}

/** "23 Jun 2026 · 18:30" */
export function formatDateTimeBkk(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return `${formatDate(date)} · ${formatTimeBkk(date)}`;
}

/** Value for <input type="datetime-local"> in Asia/Bangkok. */
export function toBangkokLocalInput(date: string | Date | null | undefined): string {
  const d = date ? (typeof date === "string" ? new Date(date) : date) : new Date(Date.now() + 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** datetime-local (interpreted as Asia/Bangkok, UTC+7) → ISO string. */
export function bangkokLocalInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h) - 7, Number(mi));
  return Number.isNaN(utc) ? null : new Date(utc).toISOString();
}
