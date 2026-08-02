"use server";

/**
 * Server actions for the Apple AirTag manual-location-history feature.
 *
 * air_tag_trackers / air_tag_positions are new, fully separate from the
 * GPS903 (`gps_devices` / `gps_device_positions`) polling system — see
 * supabase/migrations/0107_air_tag_trackers.sql. Every position row is
 * human-entered (manual form or CSV import) and, per that migration,
 * immutable once written (no UPDATE/DELETE policy for non-admins).
 *
 * Every write here goes through the user-session Supabase client (RLS
 * enforced), never the service-role client — RLS is the source of truth for
 * case-scoped access, and `created_by`/`entered_by` are always derived from
 * the authenticated session server-side, never accepted from client input
 * (Golden Rule 1/2: never trust client validation, never bypass RLS).
 */

import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireStaff } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { handleDbError } from "@/lib/errors";
import type { Profile } from "@/lib/types";
import { parsePosition, parseCsv, MAX_CSV_ROWS, type ParsedPosition } from "./validation";

export type ActionResult<T extends Record<string, unknown> = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

/** Any authenticated user (agent/supervisor/admin). Case-level authorization
 *  for these actions is enforced by RLS (can_access_case()), not here — this
 *  only rejects anonymous callers. Throws (rather than redirecting) so
 *  fetch/`useTransition`-style client callers can catch it, mirroring the
 *  existing `requireStaff()` convention in src/lib/auth.ts. */
async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Unauthorized");
  return profile;
}

// ═══════════════════════════════════════════════════════════════════════════
// createAirTagTracker
// ═══════════════════════════════════════════════════════════════════════════

const createTrackerSchema = z.object({
  caseId: z.string().uuid(),
  label: z.string().trim().min(1, "label is required").max(120, "label must be 120 characters or fewer"),
  appleSerial: z.string().trim().max(64, "appleSerial must be 64 characters or fewer").optional(),
  notes: z.string().trim().max(2000, "notes must be 2000 characters or fewer").optional(),
});

/** Create an AirTag tracker on a case. `created_by` is always the server session's user id. */
export async function createAirTagTracker(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requireUser();

  const parsed = createTrackerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("air_tag_trackers")
    .insert({
      case_id: parsed.data.caseId,
      label: parsed.data.label,
      apple_serial: parsed.data.appleSerial || null,
      notes: parsed.data.notes || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[air-tag] createAirTagTracker failed actor=${profile.id} caseId=${parsed.data.caseId}`, error);
    return { ok: false, error: handleDbError(error, "air_tag_trackers") };
  }

  console.log(`[air-tag] createAirTagTracker ok actor=${profile.id} caseId=${parsed.data.caseId} trackerId=${data.id}`);
  await logAudit({
    actorId: profile.id,
    action: "AIR_TAG_TRACKER_CREATED",
    entity: "air_tag_trackers",
    entityId: data.id,
    metadata: { case_id: parsed.data.caseId },
  });

  return { ok: true, id: data.id };
}

// ═══════════════════════════════════════════════════════════════════════════
// addManualPing
// ═══════════════════════════════════════════════════════════════════════════

const manualPingSchema = z.object({ airTagId: z.string().uuid() });

/** Record a single manually-entered AirTag position. `entered_by`/`source` are always server-derived. */
export async function addManualPing(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requireUser();

  const rl = await checkRateLimit("air_tag_ping", profile.id);
  if (!rl.allowed) {
    console.warn(`[air-tag] addManualPing rate-limited actor=${profile.id}`);
    return { ok: false, error: "Rate limit exceeded. Please try again later." };
  }

  const parsedTop = manualPingSchema.safeParse(input);
  if (!parsedTop.success) return { ok: false, error: "Invalid request" };

  const position = parsePosition(input, new Date());
  if (!position.ok) return { ok: false, error: position.reason };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("air_tag_positions")
    .insert({
      air_tag_id: parsedTop.data.airTagId,
      lat: position.data.lat,
      lng: position.data.lng,
      recorded_at: position.data.recordedAt,
      accuracy_m: position.data.accuracyM,
      note: position.data.note,
      source: "manual",
      entered_by: profile.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error(
      `[air-tag] addManualPing failed actor=${profile.id} airTagId=${parsedTop.data.airTagId}`,
      error,
    );
    return { ok: false, error: handleDbError(error, "air_tag_positions") };
  }

  console.log(
    `[air-tag] addManualPing ok actor=${profile.id} airTagId=${parsedTop.data.airTagId} positionId=${data.id}`,
  );
  await logAudit({
    actorId: profile.id,
    action: "AIR_TAG_PING_ADDED",
    entity: "air_tag_positions",
    entityId: data.id,
    metadata: { air_tag_id: parsedTop.data.airTagId, source: "manual" },
  });

  return { ok: true, id: data.id };
}

// ═══════════════════════════════════════════════════════════════════════════
// importAirTagPingsCsv
// ═══════════════════════════════════════════════════════════════════════════

const MAX_CSV_BYTES = 2 * 1024 * 1024; // 2MB
const CSV_INSERT_CHUNK_SIZE = 500;

const importCsvSchema = z.object({
  airTagId: z.string().uuid(),
  csvText: z.string().min(1, "csvText is required"),
});

const REQUIRED_CSV_COLUMNS = ["lat", "lng", "recorded_at"] as const;

/** Round to 6dp (matches numeric(10,6)) and stringify, for stable dedupe-key comparison. */
function fixed6(n: number): string {
  return n.toFixed(6);
}

export type CsvImportResult =
  | { ok: false; error: string }
  | { ok: true; insertedCount: number; skippedRows: { row: number; reason: string }[] };

/**
 * Re-parses the raw CSV text server-side (never trusts a client-parsed row
 * array — that would be a client-side-validation-bypass per Golden Rule 2).
 * Every row is validated with the same schema/rules as addManualPing
 * (including per-row future-timestamp rejection). Unique-constraint
 * collisions (air_tag_id, recorded_at, lat, lng — see migration 0107) are
 * treated as skipped-not-failed via `ignoreDuplicates` upsert, so a re-import
 * of the same file is a safe no-op rather than an error.
 */
export async function importAirTagPingsCsv(input: unknown): Promise<CsvImportResult> {
  const profile = await requireUser();

  const rl = await checkRateLimit("air_tag_csv_import", profile.id);
  if (!rl.allowed) {
    console.warn(`[air-tag] importAirTagPingsCsv rate-limited actor=${profile.id}`);
    return { ok: false, error: "Rate limit exceeded. Please try again later." };
  }

  const parsedTop = importCsvSchema.safeParse(input);
  if (!parsedTop.success) return { ok: false, error: "Invalid request" };
  const { airTagId, csvText } = parsedTop.data;

  if (Buffer.byteLength(csvText, "utf8") > MAX_CSV_BYTES) {
    return { ok: false, error: "CSV exceeds the maximum allowed size of 2MB" };
  }

  const rows = parseCsv(csvText);
  if (rows.length === 0) return { ok: false, error: "CSV is empty" };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex = (name: string) => header.indexOf(name);
  const idx = {
    lat: colIndex("lat"),
    lng: colIndex("lng"),
    recordedAt: colIndex("recorded_at"),
    accuracyM: colIndex("accuracy_m"),
    note: colIndex("note"),
  };
  const missing = REQUIRED_CSV_COLUMNS.filter((c) => header.indexOf(c) === -1);
  if (missing.length > 0) {
    return { ok: false, error: `CSV header is missing required column(s): ${missing.join(", ")}` };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_CSV_ROWS) {
    return { ok: false, error: `CSV exceeds the maximum of ${MAX_CSV_ROWS} rows` };
  }

  const now = new Date();
  const skippedRows: { row: number; reason: string }[] = [];
  const valid: { rowNumber: number; data: ParsedPosition }[] = [];

  dataRows.forEach((r, i) => {
    const rowNumber = i + 2; // header = row 1, first data row = row 2 (spreadsheet-style)
    const raw = {
      lat: r[idx.lat]?.trim() ?? "",
      lng: r[idx.lng]?.trim() ?? "",
      recordedAt: r[idx.recordedAt]?.trim() ?? "",
      accuracyM: idx.accuracyM >= 0 ? r[idx.accuracyM]?.trim() || undefined : undefined,
      note: idx.note >= 0 ? r[idx.note]?.trim() || undefined : undefined,
    };
    const result = parsePosition(raw, now);
    if (!result.ok) {
      skippedRows.push({ row: rowNumber, reason: result.reason });
      return;
    }
    valid.push({ rowNumber, data: result.data });
  });

  let insertedCount = 0;

  if (valid.length > 0) {
    const supabase = await createClient();

    for (let start = 0; start < valid.length; start += CSV_INSERT_CHUNK_SIZE) {
      const chunk = valid.slice(start, start + CSV_INSERT_CHUNK_SIZE);
      const payload = chunk.map((v) => ({
        air_tag_id: airTagId,
        lat: v.data.lat,
        lng: v.data.lng,
        recorded_at: v.data.recordedAt,
        accuracy_m: v.data.accuracyM,
        note: v.data.note,
        source: "csv_import",
        entered_by: profile.id,
      }));

      const { data: inserted, error } = await supabase
        .from("air_tag_positions")
        .upsert(payload, { onConflict: "air_tag_id,recorded_at,lat,lng", ignoreDuplicates: true })
        .select("recorded_at, lat, lng");

      if (error) {
        console.error(
          `[air-tag] importAirTagPingsCsv chunk insert failed actor=${profile.id} airTagId=${airTagId}`,
          error,
        );
        const reason = handleDbError(error, "air_tag_positions");
        for (const v of chunk) skippedRows.push({ row: v.rowNumber, reason });
        continue;
      }

      const returnedKeys = new Set(
        (inserted ?? []).map((r) => {
          const ms = new Date(r.recorded_at as string).getTime();
          return `${ms}|${fixed6(r.lat as number)}|${fixed6(r.lng as number)}`;
        }),
      );
      insertedCount += returnedKeys.size;

      for (const v of chunk) {
        const key = `${new Date(v.data.recordedAt).getTime()}|${fixed6(v.data.lat)}|${fixed6(v.data.lng)}`;
        if (!returnedKeys.has(key)) {
          skippedRows.push({ row: v.rowNumber, reason: "Duplicate ping (already recorded for this AirTag)" });
        }
      }
    }
  }

  console.log(
    `[air-tag] importAirTagPingsCsv done actor=${profile.id} airTagId=${airTagId} ` +
      `insertedCount=${insertedCount} skippedCount=${skippedRows.length}`,
  );
  await logAudit({
    actorId: profile.id,
    action: "AIR_TAG_CSV_IMPORTED",
    entity: "air_tag_positions",
    entityId: airTagId,
    metadata: { air_tag_id: airTagId, insertedCount, skippedCount: skippedRows.length },
  });

  return { ok: true, insertedCount, skippedRows };
}

// ═══════════════════════════════════════════════════════════════════════════
// deleteAirTagTracker
// ═══════════════════════════════════════════════════════════════════════════

const deleteTrackerSchema = z.object({ airTagId: z.string().uuid() });

/**
 * Soft-delete an AirTag tracker (deleted_at = now()). RLS restricts UPDATE on
 * air_tag_trackers to admin/supervisor (see migration 0107); requireStaff()
 * here is defense-in-depth (Golden Rule 2) so an unauthorized caller gets a
 * clean, immediate rejection rather than a silent RLS no-op. If RLS still
 * blocks the update (e.g. a supervisor not assigned to the case), the row
 * update affects 0 rows and we surface a generic not-found — never leaking
 * whether the tracker exists.
 */
export async function deleteAirTagTracker(input: unknown): Promise<ActionResult> {
  const profile = await requireStaff();

  const parsed = deleteTrackerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("air_tag_trackers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.airTagId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[air-tag] deleteAirTagTracker failed actor=${profile.id} airTagId=${parsed.data.airTagId}`, error);
    return { ok: false, error: handleDbError(error, "air_tag_trackers") };
  }
  if (!data) {
    return { ok: false, error: "Tracker not found or not accessible" };
  }

  console.log(`[air-tag] deleteAirTagTracker ok actor=${profile.id} airTagId=${parsed.data.airTagId}`);
  await logAudit({
    actorId: profile.id,
    action: "AIR_TAG_TRACKER_DELETED",
    entity: "air_tag_trackers",
    entityId: parsed.data.airTagId,
  });

  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// listAirTagsForCase
// ═══════════════════════════════════════════════════════════════════════════

const listTrackersSchema = z.object({ caseId: z.string().uuid() });

export type AirTagTrackerSummary = {
  id: string;
  case_id: string;
  label: string;
  apple_serial: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** List non-deleted AirTag trackers for a case. RLS scopes to cases the caller can access. */
export async function listAirTagsForCase(
  input: unknown,
): Promise<ActionResult<{ trackers: AirTagTrackerSummary[] }>> {
  const profile = await requireUser();

  const parsed = listTrackersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("air_tag_trackers")
    .select("id, case_id, label, apple_serial, notes, created_by, created_at, updated_at")
    .eq("case_id", parsed.data.caseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`[air-tag] listAirTagsForCase failed actor=${profile.id} caseId=${parsed.data.caseId}`, error);
    return { ok: false, error: handleDbError(error, "air_tag_trackers") };
  }

  return { ok: true, trackers: (data ?? []) as AirTagTrackerSummary[] };
}

// ═══════════════════════════════════════════════════════════════════════════
// listAirTagPositions
// ═══════════════════════════════════════════════════════════════════════════

const MAX_POSITIONS_PAGE_SIZE = 100;
const DEFAULT_POSITIONS_PAGE_SIZE = 25;

const listPositionsSchema = z.object({
  airTagId: z.string().uuid(),
  page: z.coerce.number().int().min(1).max(100_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(MAX_POSITIONS_PAGE_SIZE).optional(),
});

export type AirTagPositionRow = {
  id: string;
  lat: number;
  lng: number;
  /** ISO 8601 UTC. */
  recorded_at: string;
  accuracy_m: number | null;
  note: string | null;
  source: string;
  entered_by: string | null;
  entered_by_name: string | null;
};

/**
 * Paginated, newest-first listing of every position row for one AirTag
 * tracker — powers the Position History table (unlike /api/air-tags/history,
 * which is scoped to a single Bangkok day for the map replay and
 * deliberately omits `source`/`entered_by`). AirTag data is never
 * auto-pruned (migration 0107), so unlike the GPS903 Position History tab's
 * unpaginated 100-row cap, this is paginated to stay bounded regardless of
 * how much manual/CSV history has accumulated.
 *
 * RLS (user-session client) scopes visibility to the caller's assigned
 * cases via the parent tracker — an inaccessible/soft-deleted tracker simply
 * yields an empty page rather than an error, matching listAirTagsForCase's
 * read-only convention.
 */
export async function listAirTagPositions(
  input: unknown,
): Promise<ActionResult<{ positions: AirTagPositionRow[]; totalCount: number; page: number; pageSize: number }>> {
  const profile = await requireUser();

  const rl = await checkRateLimit("air_tag_positions_list", profile.id);
  if (!rl.allowed) {
    console.warn(`[air-tag] listAirTagPositions rate-limited actor=${profile.id}`);
    return { ok: false, error: "Rate limit exceeded. Please try again later." };
  }

  const parsed = listPositionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.pageSize ?? DEFAULT_POSITIONS_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("air_tag_positions")
    .select(
      "id, lat, lng, recorded_at, accuracy_m, note, source, entered_by, profiles!air_tag_positions_entered_by_fkey(full_name)",
      { count: "exact" },
    )
    .eq("air_tag_id", parsed.data.airTagId)
    .order("recorded_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error(
      `[air-tag] listAirTagPositions failed actor=${profile.id} airTagId=${parsed.data.airTagId}`,
      error,
    );
    return { ok: false, error: handleDbError(error, "air_tag_positions") };
  }

  const positions: AirTagPositionRow[] = (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      lat: number;
      lng: number;
      recorded_at: string;
      accuracy_m: number | null;
      note: string | null;
      source: string;
      entered_by: string | null;
      profiles: { full_name: string | null } | { full_name: string | null }[] | null;
    };
    const profileRel = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      lat: r.lat,
      lng: r.lng,
      recorded_at: r.recorded_at,
      accuracy_m: r.accuracy_m,
      note: r.note,
      source: r.source,
      entered_by: r.entered_by,
      entered_by_name: profileRel?.full_name ?? null,
    };
  });

  return { ok: true, positions, totalCount: count ?? positions.length, page, pageSize };
}

// ═══════════════════════════════════════════════════════════════════════════
// generateWebhookToken / revokeWebhookToken / listWebhookTokens
//
// Token management for the automated (iOS Shortcuts) ingestion webhook — see
// supabase/migrations/0108_air_tag_webhook_tokens.sql and
// src/app/api/air-tags/webhook/ping/route.ts (the public endpoint these
// tokens authenticate against). Everything below runs through the
// user-session client, so RLS still governs who may mint/revoke/list tokens
// for a given tracker (agent/supervisor/admin per that migration) — these
// actions never touch the service-role client, unlike the webhook endpoint
// itself.
// ═══════════════════════════════════════════════════════════════════════════

const TOKEN_PREFIX_LEN = 8;

const generateTokenSchema = z.object({
  airTagId: z.string().uuid(),
  label: z.string().trim().max(120, "label must be 120 characters or fewer").optional(),
});

/**
 * Mint a new webhook bearer token for a tracker. The plaintext token is
 * generated with `crypto.randomBytes` (never `Math.random`, which is not
 * cryptographically secure) and is returned to the caller exactly once —
 * only its SHA-256 hash and an 8-char display prefix are ever persisted.
 * There is no way to recover the plaintext after this call returns; losing
 * it means revoking and minting a new one.
 */
export async function generateWebhookToken(
  input: unknown,
): Promise<ActionResult<{ token: string; tokenId: string; tokenPrefix: string }>> {
  const profile = await requireUser();

  const rl = await checkRateLimit("air_tag_webhook_token_create", profile.id);
  if (!rl.allowed) {
    console.warn(`[air-tag] generateWebhookToken rate-limited actor=${profile.id}`);
    return { ok: false, error: "Rate limit exceeded. Please try again later." };
  }

  const parsed = generateTokenSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }

  // base64url so the plaintext is URL/header-safe with no padding characters.
  const plaintext = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(plaintext).digest("hex");
  const tokenPrefix = plaintext.slice(0, TOKEN_PREFIX_LEN);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("air_tag_webhook_tokens")
    .insert({
      air_tag_id: parsed.data.airTagId,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      created_by: profile.id,
      label: parsed.data.label || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error(
      `[air-tag] generateWebhookToken failed actor=${profile.id} airTagId=${parsed.data.airTagId}`,
      error,
    );
    return { ok: false, error: handleDbError(error, "air_tag_webhook_tokens") };
  }

  // Never log the plaintext token — id/prefix only, even at debug level.
  console.log(
    `[air-tag] generateWebhookToken ok actor=${profile.id} airTagId=${parsed.data.airTagId} tokenId=${data.id} tokenPrefix=${tokenPrefix}`,
  );
  await logAudit({
    actorId: profile.id,
    action: "AIR_TAG_WEBHOOK_TOKEN_CREATED",
    entity: "air_tag_webhook_tokens",
    entityId: data.id,
    metadata: { air_tag_id: parsed.data.airTagId, token_prefix: tokenPrefix },
  });

  return { ok: true, token: plaintext, tokenId: data.id, tokenPrefix };
}

const revokeTokenSchema = z.object({ tokenId: z.string().uuid() });

/**
 * Revoke a webhook token (sets revoked_at). RLS scopes which tokens the
 * caller may update to trackers on their assigned cases; a 0-row update
 * (already revoked, not found, or not accessible) surfaces as a generic
 * not-found rather than distinguishing the cause.
 */
export async function revokeWebhookToken(input: unknown): Promise<ActionResult> {
  const profile = await requireUser();

  const parsed = revokeTokenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("air_tag_webhook_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.tokenId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[air-tag] revokeWebhookToken failed actor=${profile.id} tokenId=${parsed.data.tokenId}`, error);
    return { ok: false, error: handleDbError(error, "air_tag_webhook_tokens") };
  }
  if (!data) {
    return { ok: false, error: "Token not found or not accessible" };
  }

  console.log(`[air-tag] revokeWebhookToken ok actor=${profile.id} tokenId=${parsed.data.tokenId}`);
  await logAudit({
    actorId: profile.id,
    action: "AIR_TAG_WEBHOOK_TOKEN_REVOKED",
    entity: "air_tag_webhook_tokens",
    entityId: parsed.data.tokenId,
  });

  return { ok: true };
}

const listTokensSchema = z.object({ airTagId: z.string().uuid() });

export type AirTagWebhookTokenSummary = {
  id: string;
  label: string | null;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

/**
 * List webhook tokens for a tracker's management UI. `token_hash` is never
 * selected — the UI only ever needs the display prefix, not the lookup
 * secret.
 */
export async function listWebhookTokens(
  input: unknown,
): Promise<ActionResult<{ tokens: AirTagWebhookTokenSummary[] }>> {
  const profile = await requireUser();

  const parsed = listTokensSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("air_tag_webhook_tokens")
    .select("id, label, token_prefix, created_at, last_used_at, revoked_at")
    .eq("air_tag_id", parsed.data.airTagId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`[air-tag] listWebhookTokens failed actor=${profile.id} airTagId=${parsed.data.airTagId}`, error);
    return { ok: false, error: handleDbError(error, "air_tag_webhook_tokens") };
  }

  return { ok: true, tokens: (data ?? []) as AirTagWebhookTokenSummary[] };
}
