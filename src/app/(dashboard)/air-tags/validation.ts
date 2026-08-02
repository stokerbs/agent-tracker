/**
 * Pure validation/parsing helpers for the AirTag manual-location-history
 * feature, kept out of actions.ts because a "use server" file may only
 * export async functions — parsePosition/parseCsv are synchronous and are
 * also unit-tested directly (bypassing the server-action boundary).
 */

import { z } from "zod";

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

export const MAX_CSV_ROWS = 5000; // data rows, excluding header

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
