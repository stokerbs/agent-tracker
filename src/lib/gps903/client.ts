/**
 * Shared GPS903 Web API primitives — constants, the service-client type, and the
 * low-level HTML / cookie / value-parsing helpers used across the GPS903 modules.
 *
 * IMPORTANT — actual GPS903 behavior (confirmed by live probe 2026-06-18):
 *   - Login always returns HTTP 200 (both success and failure)
 *   - Success indicator: .ASPXAUTH cookie present in Set-Cookie response headers
 *   - Failure indicator: only ASP.NET_SessionId is set, no .ASPXAUTH
 *   - GetTracking response: {"d": "{unquoted JS object literal}"} — NOT valid JSON
 *     Must eval with Function(), not JSON.parse()
 *   - Field names: latitude/longitude (not lat/lng), speed is a string, dataContext="ACC,battery%,alarm"
 *   - GetDevicesByUserID returns HTTP 500 for IMEI-scoped sessions (device-level login)
 */

import { createServiceClient } from "@/lib/supabase/server";

export const GPS903_BASE     = "http://www.gps903.net";
export const GPS903_TIMEZONE = "Asia/Bangkok";
export const SESSION_TTL_MS  = 25 * 60 * 1000;
export const FETCH_TIMEOUT   = 10_000;

export type SvcClient = ReturnType<typeof createServiceClient>;

export function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

export function extractHiddenInput(html: string, name: string): string {
  const m =
    html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`, "i")) ??
    html.match(new RegExp(`value="([^"]*)"[^>]*name="${name}"`, "i"));
  return m?.[1] ?? "";
}

/**
 * Parse the GPS903 "d" field.
 * GPS903 ASMX services return {"d": "{unquoted JS object literal}"} —
 * the inner string uses unquoted property names and is NOT valid JSON.
 * We evaluate it in strict mode (trusted internal GPS tracker data).
 */
export function parseGps903Value(str: string): Record<string, unknown> | unknown[] | null {
  try {
    // eslint-disable-next-line no-new-func
    return new Function('"use strict"; return (' + str + ')')() as Record<string, unknown> | unknown[];
  } catch {
    return null;
  }
}

/**
 * Extract all meaningful cookies from a Response, deduplicated by name.
 * Uses getSetCookie() (Node 20+) for correct multi-header handling.
 * Returns "Name=value; Name2=value2" or null if none found.
 */
export function extractAllCookies(response: Response): string | null {
  const seen    = new Set<string>();
  const parts: string[] = [];

  const headers = response.headers as unknown as { getSetCookie?(): string[] };
  const setCookies: string[] = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : (response.headers.get("set-cookie") ?? "").split(/,(?=[^ ])/).map((s) => s.trim());

  for (const h of setCookies) {
    const nameValue  = h.split(";")[0]?.trim() ?? "";
    const cookieName = nameValue.split("=")[0]?.trim() ?? "";
    if (nameValue.includes("=") && cookieName && !seen.has(cookieName)) {
      seen.add(cookieName);
      parts.push(nameValue);
    }
  }

  return parts.length ? parts.join("; ") : null;
}

/** Returns true when a cookie string contains a valid .ASPXAUTH ticket. */
export function hasAuthTicket(cookies: string | null): boolean {
  if (!cookies) return false;
  return cookies.toLowerCase().split(";").some((c) => c.trim().toLowerCase().startsWith(".aspxauth="));
}
