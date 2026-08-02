/**
 * Zod validation + dedupe-as-skip-not-fail contract for the AirTag server
 * actions: lat/lng bounds, future-timestamp rejection, CSV row validation,
 * and the CSV import's insertedCount/skippedRows shape.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const makeBuilder = (result: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "insert", "update", "upsert", "eq", "is", "order"]) b[m] = () => b;
    (b as { then: unknown }).then = (res: (v: unknown) => unknown) => res(result);
    b.single = async () => result;
    b.maybeSingle = async () => result;
    return b;
  };
  return {
    makeBuilder,
    insertedWith: undefined as unknown,
    insertResult: { data: { id: "pos-1" }, error: null } as unknown,
    upsertResult: { data: [] as unknown[], error: null } as unknown,
    updateResult: { data: { id: "tag-1" }, error: null } as unknown,
    getCurrentProfile: vi.fn(),
    requireStaff: vi.fn(),
    checkRateLimit: vi.fn(),
    logAudit: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  getCurrentProfile: h.getCurrentProfile,
  requireStaff: h.requireStaff,
  isStaff: (r: string) => r === "admin" || r === "supervisor",
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: h.checkRateLimit }));
vi.mock("@/lib/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/errors", () => ({ handleDbError: (e: { message?: string }) => e?.message ?? "db error" }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "air_tag_trackers") {
        const b = h.makeBuilder(h.updateResult) as Record<string, unknown>;
        b.insert = (vals: unknown) => {
          h.insertedWith = vals;
          return b;
        };
        return b;
      }
      // air_tag_positions
      const b = h.makeBuilder(h.insertResult) as Record<string, unknown>;
      b.insert = (vals: unknown) => {
        h.insertedWith = vals;
        return b;
      };
      b.upsert = (vals: unknown) => {
        h.insertedWith = vals;
        return { ...b, select: async () => h.upsertResult };
      };
      return b;
    },
  }),
}));

import {
  parsePosition,
  parseCsv,
  addManualPing,
  importAirTagPingsCsv,
  createAirTagTracker,
  deleteAirTagTracker,
  MAX_CSV_ROWS,
} from "./actions";

const AIR_TAG_ID = "11111111-1111-1111-1111-111111111111";
const CASE_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  h.insertedWith = undefined;
  h.insertResult = { data: { id: "pos-1" }, error: null };
  h.upsertResult = { data: [], error: null };
  h.updateResult = { data: { id: "tag-1" }, error: null };
  h.getCurrentProfile.mockResolvedValue({ id: "u1", role: "agent" });
  h.requireStaff.mockResolvedValue({ id: "admin-1", role: "admin" });
  h.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 10, retryAfterMs: 0 });
});

const NOW = new Date("2026-08-02T12:00:00.000Z");

describe("parsePosition — bounds", () => {
  it("accepts a valid position", () => {
    const r = parsePosition({ lat: 13.7, lng: 100.5, recordedAt: "2026-08-01T00:00:00.000Z" }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toMatchObject({ lat: 13.7, lng: 100.5, accuracyM: null, note: null });
    }
  });

  it("rejects lat > 90", () => {
    const r = parsePosition({ lat: 91, lng: 0, recordedAt: "2026-08-01T00:00:00.000Z" }, NOW);
    expect(r.ok).toBe(false);
  });

  it("rejects lat < -90", () => {
    const r = parsePosition({ lat: -91, lng: 0, recordedAt: "2026-08-01T00:00:00.000Z" }, NOW);
    expect(r.ok).toBe(false);
  });

  it("rejects lng > 180", () => {
    const r = parsePosition({ lat: 0, lng: 181, recordedAt: "2026-08-01T00:00:00.000Z" }, NOW);
    expect(r.ok).toBe(false);
  });

  it("rejects lng < -180", () => {
    const r = parsePosition({ lat: 0, lng: -181, recordedAt: "2026-08-01T00:00:00.000Z" }, NOW);
    expect(r.ok).toBe(false);
  });

  it("accepts boundary values -90/-180 and 90/180", () => {
    expect(parsePosition({ lat: -90, lng: -180, recordedAt: "2026-08-01T00:00:00.000Z" }, NOW).ok).toBe(true);
    expect(parsePosition({ lat: 90, lng: 180, recordedAt: "2026-08-01T00:00:00.000Z" }, NOW).ok).toBe(true);
  });

  it("rejects a note longer than 500 characters", () => {
    const r = parsePosition(
      { lat: 0, lng: 0, recordedAt: "2026-08-01T00:00:00.000Z", note: "x".repeat(501) },
      NOW,
    );
    expect(r.ok).toBe(false);
  });

  it("accepts a note at exactly 500 characters", () => {
    const r = parsePosition(
      { lat: 0, lng: 0, recordedAt: "2026-08-01T00:00:00.000Z", note: "x".repeat(500) },
      NOW,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects a non-positive accuracyM", () => {
    expect(parsePosition({ lat: 0, lng: 0, recordedAt: "2026-08-01T00:00:00.000Z", accuracyM: 0 }, NOW).ok).toBe(
      false,
    );
    expect(parsePosition({ lat: 0, lng: 0, recordedAt: "2026-08-01T00:00:00.000Z", accuracyM: -5 }, NOW).ok).toBe(
      false,
    );
  });
});

describe("parsePosition — future-timestamp rejection", () => {
  it("rejects a recordedAt in the future relative to `now`", () => {
    const r = parsePosition({ lat: 0, lng: 0, recordedAt: "2026-08-03T00:00:00.000Z" }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/future/i);
  });

  it("accepts a recordedAt exactly equal to `now`", () => {
    const r = parsePosition({ lat: 0, lng: 0, recordedAt: NOW.toISOString() }, NOW);
    expect(r.ok).toBe(true);
  });

  it("accepts a recordedAt in the past", () => {
    const r = parsePosition({ lat: 0, lng: 0, recordedAt: "2020-01-01T00:00:00.000Z" }, NOW);
    expect(r.ok).toBe(true);
  });

  it("rejects an unparseable recordedAt", () => {
    const r = parsePosition({ lat: 0, lng: 0, recordedAt: "not-a-date" }, NOW);
    expect(r.ok).toBe(false);
  });
});

describe("parseCsv", () => {
  it("parses a simple CSV into rows of fields", () => {
    const rows = parseCsv("lat,lng,recorded_at\n13.7,100.5,2026-08-01T00:00:00.000Z\n");
    expect(rows).toEqual([
      ["lat", "lng", "recorded_at"],
      ["13.7", "100.5", "2026-08-01T00:00:00.000Z"],
    ]);
  });

  it("handles quoted fields with embedded commas and escaped quotes", () => {
    const rows = parseCsv('lat,lng,note\n1,2,"hello, ""world"""\n');
    expect(rows[1]).toEqual(["1", "2", 'hello, "world"']);
  });

  it("drops blank lines", () => {
    const rows = parseCsv("lat,lng\n1,2\n\n3,4\n");
    expect(rows).toEqual([
      ["lat", "lng"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });
});

describe("addManualPing", () => {
  it("rejects out-of-bounds lat before touching the DB", async () => {
    const res = await addManualPing({ airTagId: AIR_TAG_ID, lat: 999, lng: 0, recordedAt: "2020-01-01T00:00:00Z" });
    expect(res).toEqual({ ok: false, error: expect.any(String) });
    expect(h.insertedWith).toBeUndefined();
  });

  it("rejects a future recordedAt before touching the DB", async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const res = await addManualPing({ airTagId: AIR_TAG_ID, lat: 0, lng: 0, recordedAt: future });
    expect(res.ok).toBe(false);
    expect(h.insertedWith).toBeUndefined();
  });

  it("sets entered_by/source server-side and ignores any client-supplied values for them", async () => {
    const res = await addManualPing({
      airTagId: AIR_TAG_ID,
      lat: 13.7,
      lng: 100.5,
      recordedAt: "2020-01-01T00:00:00Z",
      // Attempted spoofing — must be ignored; server always derives these.
      entered_by: "someone-else",
      source: "csv_import",
    });
    expect(res).toEqual({ ok: true, id: "pos-1" });
    expect(h.insertedWith).toMatchObject({ entered_by: "u1", source: "manual", air_tag_id: AIR_TAG_ID });
  });

  it("returns a rate-limit error without touching the DB when limited", async () => {
    h.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 1000 });
    const res = await addManualPing({ airTagId: AIR_TAG_ID, lat: 0, lng: 0, recordedAt: "2020-01-01T00:00:00Z" });
    expect(res.ok).toBe(false);
    expect(h.insertedWith).toBeUndefined();
  });
});

describe("createAirTagTracker", () => {
  it("rejects an empty label", async () => {
    const res = await createAirTagTracker({ caseId: CASE_ID, label: "" });
    expect(res.ok).toBe(false);
  });

  it("rejects a label over 120 characters", async () => {
    const res = await createAirTagTracker({ caseId: CASE_ID, label: "x".repeat(121) });
    expect(res.ok).toBe(false);
  });

  it("sets created_by server-side, ignoring a client-supplied value", async () => {
    const res = await createAirTagTracker({ caseId: CASE_ID, label: "Bag tag", created_by: "someone-else" });
    expect(res).toEqual({ ok: true, id: "tag-1" });
    expect(h.insertedWith).toMatchObject({ created_by: "u1", case_id: CASE_ID, label: "Bag tag" });
  });
});

describe("deleteAirTagTracker", () => {
  it("requires staff (admin/supervisor) before attempting the update", async () => {
    h.requireStaff.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(deleteAirTagTracker({ airTagId: AIR_TAG_ID })).rejects.toThrow();
  });

  it("returns a clean not-found error when RLS blocks the update (0 rows affected)", async () => {
    h.updateResult = { data: null, error: null };
    const res = await deleteAirTagTracker({ airTagId: AIR_TAG_ID });
    expect(res).toEqual({ ok: false, error: "Tracker not found or not accessible" });
  });

  it("soft-deletes on success", async () => {
    const res = await deleteAirTagTracker({ airTagId: AIR_TAG_ID });
    expect(res).toEqual({ ok: true });
  });
});

describe("importAirTagPingsCsv — CSV row validation + dedupe-as-skip-not-fail", () => {
  const header = "lat,lng,recorded_at,accuracy_m,note";

  it("rejects a payload over the 2MB cap without parsing", async () => {
    const huge = "x".repeat(2 * 1024 * 1024 + 1);
    const res = await importAirTagPingsCsv({ airTagId: AIR_TAG_ID, csvText: huge });
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/2MB/) });
  });

  it("rejects a CSV missing a required header column", async () => {
    const res = await importAirTagPingsCsv({ airTagId: AIR_TAG_ID, csvText: "lat,lng\n1,2\n" });
    expect(res.ok).toBe(false);
  });

  it("rejects a CSV with more than MAX_CSV_ROWS data rows", async () => {
    const rows = Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => `1,1,2020-01-01T00:00:0${i % 10}Z`).join("\n");
    const res = await importAirTagPingsCsv({ airTagId: AIR_TAG_ID, csvText: `${header}\n${rows}` });
    expect(res.ok).toBe(false);
  });

  it("validates every row (bounds + future timestamp) and reports skipped rows with reasons", async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const csvText = [
      header,
      "13.7,100.5,2020-01-01T00:00:00.000Z,5,ok row",
      "999,100.5,2020-01-01T00:00:01.000Z,,out of range lat",
      `1,1,${future},,future timestamp`,
    ].join("\n");

    h.upsertResult = {
      data: [{ recorded_at: "2020-01-01T00:00:00.000Z", lat: 13.7, lng: 100.5 }],
      error: null,
    };

    const res = await importAirTagPingsCsv({ airTagId: AIR_TAG_ID, csvText });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.insertedCount).toBe(1);
      expect(res.skippedRows).toEqual([
        { row: 3, reason: expect.any(String) },
        { row: 4, reason: expect.stringMatching(/future/i) },
      ]);
    }
    // source is always csv_import server-side, never trusted from the row data.
    expect(h.insertedWith).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "csv_import", entered_by: "u1" })]),
    );
  });

  it("treats a unique-constraint dedupe (row valid but already present) as skipped, not failed", async () => {
    const csvText = [header, "13.7,100.5,2020-01-01T00:00:00.000Z,,dup"].join("\n");
    // Simulate the DB skipping this row via ignoreDuplicates (returns no rows).
    h.upsertResult = { data: [], error: null };

    const res = await importAirTagPingsCsv({ airTagId: AIR_TAG_ID, csvText });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.insertedCount).toBe(0);
      expect(res.skippedRows).toEqual([{ row: 2, reason: expect.stringMatching(/duplicate/i) }]);
    }
  });

  it("parses quoted note fields containing commas", async () => {
    const csvText = [header, '13.7,100.5,2020-01-01T00:00:00.000Z,,"seen near, the pier"'].join("\n");
    h.upsertResult = {
      data: [{ recorded_at: "2020-01-01T00:00:00.000Z", lat: 13.7, lng: 100.5 }],
      error: null,
    };
    const res = await importAirTagPingsCsv({ airTagId: AIR_TAG_ID, csvText });
    expect(res.ok).toBe(true);
    expect(h.insertedWith).toEqual(
      expect.arrayContaining([expect.objectContaining({ note: "seen near, the pier" })]),
    );
  });
});
