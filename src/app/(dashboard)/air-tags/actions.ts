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
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireStaff } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { handleDbError } from "@/lib/errors";
import type { Profile } from "@/lib/types";

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
// Shared position validation (used by addManualPing and every CSV row)
// ═══════════════════════════════════════════════════════════════════════════

const positionInputSchema = z.object({
  lat: z.coerce.number().min(-90, "lat must be between -90 and 90").max(90, "lat must be between -90 and 90"),
  lng: z.coerce.number().min(-180, "lng must be between -180 and 180").max(180, "lng must be between -180 and 180"),
  recordedAt: z.string().min(1, "recordedAt is required"),
  accuracyM: z.coerce.number().int().positive("accuracyM must be a positive integer").optional(),
  note: z.string().max(500, "note must be 500 characters or fewer").optional(),
});

export type ParsedPosition = {
  lat: number;
  lng: number;
  /** ISO 8601 UTC. */
  recordedAt: string;
  accuracyM: number | null;
  note: string | null;
};

export type ParsePositionResult =
  | { ok: true; data: ParsedPosition }
  | { ok: false; reason: string };

/**
 * Validate a single raw position payload (bounds, required fields, note
 * length) and reject future timestamps. `now` is passed in explicitly so a
 * whole CSV import compares every row against one consistent instant.
 */
export function parsePosition(raw: unknown, now: Date): ParsePositionResult {
  const parsed = positionInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid row" };
  }

  const recordedAtDate = new Date(parsed.data.recordedAt);
  if (Number.isNaN(recordedAtDate.getTime())) {
    return { ok: false, reason: "Invalid recordedAt timestamp" };
  }
  if (recordedAtDate.getTime() > now.getTime()) {
    return { ok: false, reason: "recordedAt cannot be in the future" };
  }

  const note = parsed.data.note?.trim();
  return {
    ok: true,
    data: {
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      recordedAt: recordedAtDate.toISOString(),
      accuracyM: parsed.data.accuracyM ?? null,
      note: note ? note : null,
    },
  };
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
export const MAX_CSV_ROWS = 5000; // data rows, excluding header
const CSV_INSERT_CHUNK_SIZE = 500;

const importCsvSchema = z.object({
  airTagId: z.string().uuid(),
  csvText: z.string().min(1, "csvText is required"),
});

const REQUIRED_CSV_COLUMNS = ["lat", "lng", "recorded_at"] as const;

/**
 * Minimal RFC-4180-ish CSV tokenizer: handles quoted fields (with "" escaping
 * and embedded commas/newlines) and both \n and \r\n line endings. Rows that
 * are a single empty field (blank lines) are dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const len = text.length;
  let i = 0;
  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

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
