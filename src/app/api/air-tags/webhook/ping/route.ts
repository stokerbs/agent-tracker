import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { parsePosition } from "@/app/(dashboard)/air-tags/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/air-tags/webhook/ping
 *
 * Public, unauthenticated-by-session endpoint for automated AirTag/Hocco
 * position ingestion — designed to be called by an unattended iOS Shortcuts
 * automation on a schedule, so there is no interactive Supabase session and
 * therefore no auth.uid() for RLS to key off. Auth is instead a per-tracker
 * bearer token (see supabase/migrations/0108_air_tag_webhook_tokens.sql and
 * the token-management actions in src/app/(dashboard)/air-tags/actions.ts).
 *
 * Request:
 *   POST /api/air-tags/webhook/ping
 *   Authorization: Bearer <plaintext token, from generateWebhookToken()>
 *   Content-Type: application/json
 *   { "lat": 13.7, "lng": 100.5, "recordedAt"?: "<ISO 8601>", "accuracyM"?: <positive int>, "note"?: "<=500 chars>" }
 *
 *   recordedAt defaults to "now" (server time) when omitted — the common
 *   case for a Shortcuts automation that just fired. Same lat/lng/accuracyM/
 *   note/future-timestamp rules as the manual-entry form (parsePosition()).
 *
 * Response:
 *   200 { "ok": true }                              — position recorded, OR
 *       it was a duplicate of an already-recorded ping (same air_tag_id +
 *       recorded_at + lat + lng — the unique constraint from migration 0107)
 *       and is treated as an idempotent no-op success, not an error. A
 *       Shortcuts automation retrying a timed-out request should never see a
 *       failure for a ping that in fact already landed.
 *   400 { "error": "invalid_json" | "invalid_input" } — malformed body.
 *   401 { "error": "Unauthorized" }                  — missing/malformed
 *       Authorization header, OR the token is unknown/revoked, OR the
 *       token's tracker has been soft-deleted. Deliberately identical in
 *       every one of those cases — the response never hints at *why* a
 *       token didn't work, which would otherwise let a caller distinguish
 *       "wrong token" from "right format, revoked" while brute-forcing.
 *   429 { "error": "rate_limited" }                  — per-token or per-IP
 *       bucket exceeded (see rate-limit section below); Retry-After header set.
 *   500 { "error": "server_error" }                  — DB insert failed (for
 *       a reason other than the duplicate-ping unique-constraint above).
 *
 * air_tag_id / entered_by / source are never taken from the request body —
 * they are entirely determined by which token was presented: air_tag_id and
 * entered_by (= the token's created_by) come from the token row, source is
 * hardcoded to 'shortcuts_webhook'. A caller can never point a token at a
 * different tracker or attribute a ping to a different user.
 *
 * The one deliberate, narrow service-role (RLS-bypassing) usage in this
 * feature: an unauthenticated webhook call has no auth.uid(), so the
 * user-session client can't run at all here. createServiceClient() is used
 * only to (a) hash-look-up the presented token and its parent tracker's
 * deleted_at, (b) insert the resulting position row, and (c) best-effort
 * bump last_used_at. No other table is touched with this client, and no
 * value from the request body is ever written to a column the token itself
 * doesn't already pin (air_tag_id, entered_by, source).
 *
 * Rate limiting is two-layered:
 *   - Per-IP (air_tag_webhook_ip, 300/hour): coarse defense-in-depth against
 *     a caller brute-forcing many different token guesses from one source,
 *     which the per-token bucket alone can't catch (an unknown token has no
 *     token-derived key to rate-limit against). Reuses the same
 *     x-forwarded-for extraction already used by the public marketing routes.
 *     Checked FIRST, before even the Authorization-header-presence check, so
 *     it gates every request regardless of what's in that header.
 *   - Per-token (air_tag_webhook_ping, 120/hour): bounds a single automation,
 *     generous enough for periodic (e.g. every-15-min) Shortcuts runs.
 *     Checked only once the token is known-valid.
 *
 * Note this endpoint is NOT covered by the session-auth check in
 * src/lib/supabase/middleware.ts (see EXEMPT_API_ROUTES there) — it is
 * deliberately, explicitly exempted, since it's designed to be called with a
 * bearer token and no session cookie. Auth is entirely this route handler's
 * responsibility, not the session middleware's.
 *
 * The plaintext bearer token is never logged — every log line below uses the
 * token's row id and/or 8-char prefix (once resolved) instead.
 */

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Generic, identical-for-every-failure-mode response — see doc comment above. */
function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function rateLimited(retryAfterMs: number) {
  return NextResponse.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
  );
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  // Coarse per-IP bucket is the very first gate on every request, regardless
  // of what's in (or missing from) the Authorization header — otherwise a
  // request with no/malformed header would skip this bucket entirely, since
  // it would always short-circuit on the token-presence check below first.
  const ipRl = await checkRateLimit("air_tag_webhook_ip", ip);
  if (!ipRl.allowed) {
    console.warn(`[air-tag-webhook] ip rate-limited ip=${ip}`);
    return rateLimited(ipRl.retryAfterMs);
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    console.warn(`[air-tag-webhook] missing/malformed Authorization header ip=${ip}`);
    return unauthorized();
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tokenPrefix = token.slice(0, 8);

  // Service-role lookup — the one deliberate RLS bypass in this feature (see
  // doc comment above). Never a full-table scan/plaintext compare: token_hash
  // is unique-indexed (migration 0108), so this is a direct index lookup.
  const svc = createServiceClient();
  const { data: tokenRow, error: lookupError } = await svc
    .from("air_tag_webhook_tokens")
    .select("id, air_tag_id, created_by, revoked_at, air_tag_trackers(deleted_at)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (lookupError) {
    console.error(`[air-tag-webhook] token lookup failed ip=${ip}`, lookupError);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const tracker = tokenRow
    ? ((Array.isArray(tokenRow.air_tag_trackers) ? tokenRow.air_tag_trackers[0] : tokenRow.air_tag_trackers) as {
        deleted_at: string | null;
      } | null)
    : null;

  // Unknown token, revoked token, or the parent tracker was soft-deleted —
  // all three collapse to the exact same response (see unauthorized() doc).
  if (!tokenRow || tokenRow.revoked_at !== null || !tracker || tracker.deleted_at !== null) {
    console.warn(`[air-tag-webhook] rejected ip=${ip} tokenPrefix=${tokenPrefix}`);
    return unauthorized();
  }

  // Per-token bucket, now that the token is known-valid.
  const tokenRl = await checkRateLimit("air_tag_webhook_ping", tokenRow.id);
  if (!tokenRl.allowed) {
    console.warn(`[air-tag-webhook] token rate-limited ip=${ip} tokenId=${tokenRow.id}`);
    return rateLimited(tokenRl.retryAfterMs);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // recordedAt defaults to "now" — a Shortcuts ping reports the current
  // position, unlike the manual form / CSV import where a human picks a time.
  const raw = (body && typeof body === "object" ? (body as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const now = new Date();
  const position = parsePosition({ recordedAt: now.toISOString(), ...raw }, now);
  if (!position.ok) {
    console.warn(`[air-tag-webhook] invalid payload ip=${ip} tokenId=${tokenRow.id} reason=${position.reason}`);
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { error: insertError } = await svc.from("air_tag_positions").insert({
    air_tag_id: tokenRow.air_tag_id,
    lat: position.data.lat,
    lng: position.data.lng,
    recorded_at: position.data.recordedAt,
    accuracy_m: position.data.accuracyM,
    note: position.data.note,
    source: "shortcuts_webhook",
    entered_by: tokenRow.created_by,
  });

  if (insertError) {
    // Postgres unique-violation on air_tag_positions_dedupe_unique (air_tag_id,
    // recorded_at, lat, lng — migration 0107) means this exact ping was
    // already recorded, most likely a Shortcuts automation retry after a
    // timeout. Treat that as an idempotent success rather than a failure —
    // matching how importAirTagPingsCsv already treats a dedupe collision as
    // skip-not-fail (src/app/(dashboard)/air-tags/actions.ts) — instead of
    // surfacing a 500 for a ping that in fact already landed.
    if ((insertError as { code?: string }).code === "23505") {
      console.log(
        `[air-tag-webhook] duplicate ping ignored (already recorded) ip=${ip} tokenId=${tokenRow.id} airTagId=${tokenRow.air_tag_id}`,
      );
      return NextResponse.json({ ok: true });
    }
    console.error(`[air-tag-webhook] insert failed ip=${ip} tokenId=${tokenRow.id}`, insertError);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  console.log(`[air-tag-webhook] ping ok ip=${ip} tokenId=${tokenRow.id} airTagId=${tokenRow.air_tag_id}`);

  // Best-effort — never fail the request over this.
  try {
    const { error: touchError } = await svc
      .from("air_tag_webhook_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);
    if (touchError) {
      console.error(`[air-tag-webhook] last_used_at update failed tokenId=${tokenRow.id}`, touchError);
    }
  } catch (err) {
    console.error(`[air-tag-webhook] last_used_at update threw tokenId=${tokenRow.id}`, err);
  }

  return NextResponse.json({ ok: true });
}
