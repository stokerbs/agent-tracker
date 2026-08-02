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
    listResult: { data: [] as unknown[], error: null, count: 0 } as unknown,
    tokenResult: { data: { id: "tok-1" }, error: null } as unknown,
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
      if (table === "air_tag_webhook_tokens") {
        // Shared by generateWebhookToken (insert().select().single()),
        // revokeWebhookToken (update().eq().is().select().maybeSingle()), and
        // listWebhookTokens (select().eq().order(), awaited directly via the
        // thenable) — each test sets h.tokenResult to the shape it needs.
        const b = h.makeBuilder(h.tokenResult) as Record<string, unknown>;
        b.insert = (vals: unknown) => {
          h.insertedWith = vals;
          return b;
        };
        b.update = (vals: unknown) => {
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
      // listAirTagPositions: select(...).eq().order().range() — range() is the
      // final, directly-awaited call (mirrors how the real supabase-js builder
      // is thenable at any point in the chain).
      b.range = async () => h.listResult;
      return b;
    },
  }),
}));

import { createHash } from "node:crypto";
import {
  addManualPing,
  importAirTagPingsCsv,
  createAirTagTracker,
  deleteAirTagTracker,
  listAirTagPositions,
  generateWebhookToken,
  revokeWebhookToken,
  listWebhookTokens,
} from "./actions";
import { parsePosition, parseCsv, MAX_CSV_ROWS } from "./validation";

const AIR_TAG_ID = "11111111-1111-1111-1111-111111111111";
const CASE_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  h.insertedWith = undefined;
  h.insertResult = { data: { id: "pos-1" }, error: null };
  h.upsertResult = { data: [], error: null };
  h.updateResult = { data: { id: "tag-1" }, error: null };
  h.tokenResult = { data: { id: "tok-1" }, error: null };
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

describe("listAirTagPositions", () => {
  it("rejects an invalid airTagId before touching the DB", async () => {
    const res = await listAirTagPositions({ airTagId: "not-a-uuid" });
    expect(res.ok).toBe(false);
  });

  it("returns a rate-limit error without querying when limited", async () => {
    h.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 1000 });
    const res = await listAirTagPositions({ airTagId: AIR_TAG_ID });
    expect(res.ok).toBe(false);
  });

  it("defaults to page 1 / pageSize 25 and maps rows, flattening the joined profile name", async () => {
    h.listResult = {
      data: [
        {
          id: "p1",
          lat: 13.7,
          lng: 100.5,
          recorded_at: "2026-06-08T03:00:00.000Z",
          accuracy_m: 5,
          note: "seen at market",
          source: "manual",
          entered_by: "u1",
          profiles: { full_name: "Jane Agent" },
        },
        {
          id: "p2",
          lat: 13.71,
          lng: 100.51,
          recorded_at: "2026-06-08T04:00:00.000Z",
          accuracy_m: null,
          note: null,
          source: "csv_import",
          entered_by: "u2",
          profiles: null,
        },
      ],
      error: null,
      count: 2,
    };

    const res = await listAirTagPositions({ airTagId: AIR_TAG_ID });
    expect(res).toEqual({
      ok: true,
      page: 1,
      pageSize: 25,
      totalCount: 2,
      positions: [
        {
          id: "p1",
          lat: 13.7,
          lng: 100.5,
          recorded_at: "2026-06-08T03:00:00.000Z",
          accuracy_m: 5,
          note: "seen at market",
          source: "manual",
          entered_by: "u1",
          entered_by_name: "Jane Agent",
        },
        {
          id: "p2",
          lat: 13.71,
          lng: 100.51,
          recorded_at: "2026-06-08T04:00:00.000Z",
          accuracy_m: null,
          note: null,
          source: "csv_import",
          entered_by: "u2",
          entered_by_name: null,
        },
      ],
    });
  });

  it("honors an explicit page/pageSize and caps totalCount from the DB, not the page length", async () => {
    h.listResult = { data: [], error: null, count: 130 };
    const res = await listAirTagPositions({ airTagId: AIR_TAG_ID, page: 3, pageSize: 50 });
    expect(res).toEqual({ ok: true, page: 3, pageSize: 50, totalCount: 130, positions: [] });
  });

  it("rejects a pageSize over the max without querying", async () => {
    const res = await listAirTagPositions({ airTagId: AIR_TAG_ID, pageSize: 1000 });
    expect(res.ok).toBe(false);
  });

  it("surfaces a friendly DB error", async () => {
    h.listResult = { data: null, error: { message: "boom" }, count: null };
    const res = await listAirTagPositions({ airTagId: AIR_TAG_ID });
    expect(res).toEqual({ ok: false, error: "boom" });
  });
});

describe("generateWebhookToken", () => {
  it("rejects an invalid airTagId before touching the DB", async () => {
    const res = await generateWebhookToken({ airTagId: "not-a-uuid" });
    expect(res.ok).toBe(false);
    expect(h.insertedWith).toBeUndefined();
  });

  it("returns a rate-limit error without touching the DB when limited", async () => {
    h.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 1000 });
    const res = await generateWebhookToken({ airTagId: AIR_TAG_ID });
    expect(res.ok).toBe(false);
    expect(h.insertedWith).toBeUndefined();
  });

  it("generates a cryptographically random token, stores only its SHA-256 hash + 8-char prefix, and returns the plaintext exactly once", async () => {
    const res = await generateWebhookToken({ airTagId: AIR_TAG_ID, label: "Keys AirTag" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.tokenId).toBe("tok-1");
    expect(res.token).toEqual(expect.any(String));
    expect(res.token.length).toBeGreaterThan(32); // 32 random bytes, base64url-encoded
    expect(res.tokenPrefix).toBe(res.token.slice(0, 8));

    const expectedHash = createHash("sha256").update(res.token).digest("hex");
    expect(h.insertedWith).toMatchObject({
      air_tag_id: AIR_TAG_ID,
      token_hash: expectedHash,
      token_prefix: res.tokenPrefix,
      created_by: "u1", // server-derived from the session, never client input
      label: "Keys AirTag",
    });
    // The hash is a one-way digest of the returned plaintext, never the
    // plaintext itself.
    expect((h.insertedWith as Record<string, unknown>).token_hash).not.toBe(res.token);
  });

  it("generates a different token (and hash) on every call — never reused/predictable", async () => {
    const a = await generateWebhookToken({ airTagId: AIR_TAG_ID });
    const b = await generateWebhookToken({ airTagId: AIR_TAG_ID });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.token).not.toBe(b.token);
    }
  });

  it("ignores a client-supplied created_by/tokenId — created_by is always the session user", async () => {
    const res = await generateWebhookToken({
      airTagId: AIR_TAG_ID,
      createdBy: "someone-else",
    });
    expect(res.ok).toBe(true);
    expect(h.insertedWith).toMatchObject({ created_by: "u1" });
  });

  it("never logs the plaintext token, in success or failure logs", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await generateWebhookToken({ airTagId: AIR_TAG_ID });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const allLoggedArgs = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)));
    for (const line of allLoggedArgs) {
      expect(line).not.toContain(res.token);
    }

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("surfaces a friendly DB error", async () => {
    h.tokenResult = { data: null, error: { message: "boom" } };
    const res = await generateWebhookToken({ airTagId: AIR_TAG_ID });
    expect(res).toEqual({ ok: false, error: "boom" });
  });
});

describe("revokeWebhookToken", () => {
  const TOKEN_ID = "33333333-3333-3333-3333-333333333333";

  it("rejects an invalid tokenId before touching the DB", async () => {
    const res = await revokeWebhookToken({ tokenId: "not-a-uuid" });
    expect(res.ok).toBe(false);
    expect(h.insertedWith).toBeUndefined();
  });

  it("returns a clean not-found error when RLS blocks the update (0 rows affected) or the token is already revoked", async () => {
    h.tokenResult = { data: null, error: null };
    const res = await revokeWebhookToken({ tokenId: TOKEN_ID });
    expect(res).toEqual({ ok: false, error: "Token not found or not accessible" });
  });

  it("revokes on success", async () => {
    h.tokenResult = { data: { id: TOKEN_ID }, error: null };
    const res = await revokeWebhookToken({ tokenId: TOKEN_ID });
    expect(res).toEqual({ ok: true });
    expect(h.insertedWith).toMatchObject({ revoked_at: expect.any(String) });
  });

  it("surfaces a friendly DB error", async () => {
    h.tokenResult = { data: null, error: { message: "boom" } };
    const res = await revokeWebhookToken({ tokenId: TOKEN_ID });
    expect(res).toEqual({ ok: false, error: "boom" });
  });
});

describe("listWebhookTokens", () => {
  it("rejects an invalid airTagId before touching the DB", async () => {
    const res = await listWebhookTokens({ airTagId: "not-a-uuid" });
    expect(res.ok).toBe(false);
  });

  it("lists tokens without ever including token_hash", async () => {
    h.tokenResult = {
      data: [
        {
          id: "tok-1",
          label: "Keys AirTag",
          token_prefix: "abcd1234",
          created_at: "2026-08-01T00:00:00.000Z",
          last_used_at: null,
          revoked_at: null,
        },
      ],
      error: null,
    };
    const res = await listWebhookTokens({ airTagId: AIR_TAG_ID });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.tokens).toHaveLength(1);
      expect(res.tokens[0]).not.toHaveProperty("token_hash");
      expect(res.tokens[0]).toMatchObject({ id: "tok-1", token_prefix: "abcd1234" });
    }
  });

  it("surfaces a friendly DB error", async () => {
    h.tokenResult = { data: null, error: { message: "boom" } };
    const res = await listWebhookTokens({ airTagId: AIR_TAG_ID });
    expect(res).toEqual({ ok: false, error: "boom" });
  });
});
