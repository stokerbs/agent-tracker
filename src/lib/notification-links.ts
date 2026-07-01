/**
 * Pure, framework-free notification helpers — no DB or `server-only` deps, so
 * they're unit-testable and reusable. The notification *pipeline* (record
 * creation + push fan-out) lives solely in ./notifications, which re-exports
 * these. This is not a parallel notification service; it's just shared data.
 */

/**
 * Centralised deep-link builder — every notification destination is defined here
 * exactly once. Call sites reference these helpers instead of hardcoding paths,
 * so a route change is a one-line edit and links never drift between features.
 */
export const notificationLinks = {
  case: (id: string) => `/cases/${id}`,
  emergency: (id: string) => `/emergency/${id}`,
  portalCase: (id: string) => `/portal/cases/${id}`,
  portal: () => `/portal`,
  expenses: () => `/expenses`,
  payroll: () => `/payroll`,
  map: () => `/map`,
  gpsMonitor: () => `/gps-monitor`,
  leads: () => `/leads`,
} as const;

/**
 * Read `profile_id` from an embedded Supabase relation. The generated types
 * model to-one joins as arrays, while the client returns a single object at
 * runtime — normalise both so callers don't each re-handle the shape.
 */
export function relProfileId(rel: unknown): string | null {
  const obj = Array.isArray(rel) ? rel[0] : rel;
  return (obj as { profile_id?: string | null } | null | undefined)?.profile_id ?? null;
}
