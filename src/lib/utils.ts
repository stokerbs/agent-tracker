import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human-friendly "x minutes ago" relative time. */
export function timeAgo(date: string | Date | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function initials(name: string | null | undefined): string {
  if (!name) return "??";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Battery color token by percentage. */
export function batteryColor(pct: number | null): string {
  if (pct === null) return "text-slate-400";
  if (pct <= 15) return "text-red-500";
  if (pct <= 35) return "text-amber-500";
  return "text-emerald-500";
}

/**
 * Returns the en-CA (YYYY-MM-DD) date key for a given instant in the
 * Asia/Bangkok timezone. Defaults to "now".
 *
 * This is a machine date KEY for form defaults, date grouping/comparison
 * and "today in Bangkok" logic — it is NOT a display string. Do not route
 * user-facing date rendering through this helper.
 */
export function bangkokDateKey(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

