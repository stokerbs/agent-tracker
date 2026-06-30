import { afterEach, describe, expect, it, vi } from "vitest";
import { gps903DateToIso, gps903GetTracking } from "@/lib/gps903/tracking";

// Build a GetTracking envelope: `d` is a JS object literal string (not JSON),
// matching the real payload the parser eval-decodes.
function envelope(fields: Record<string, string | number>): Response {
  const lit =
    "{" +
    Object.entries(fields)
      .map(([k, v]) => (typeof v === "number" ? `${k}:${v}` : `${k}:"${v}"`))
      .join(",") +
    "}";
  return { ok: true, json: async () => ({ d: lit }) } as unknown as Response;
}
const base = { latitude: "13.6", longitude: "100.6", speed: "0.00", course: 0, deviceUtcDate: "2026-06-30 07:26:09" };
const track = (extra: Record<string, string | number>) => {
  vi.stubGlobal("fetch", vi.fn(async () => envelope({ ...base, ...extra })));
  return gps903GetTracking("cookie", 123);
};

describe("gps903GetTracking — isStop / status parsing", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("numeric isStop=1 → true", async () => expect((await track({ isStop: 1 }))?.isStop).toBe(true));
  it("numeric isStop=0 → false", async () => expect((await track({ isStop: 0 }))?.isStop).toBe(false));
  it("falls back to status='Stop' → true when isStop absent", async () =>
    expect((await track({ status: "Stop" }))?.isStop).toBe(true));
  it("falls back to status='Move' → false when isStop absent", async () =>
    expect((await track({ status: "Move" }))?.isStop).toBe(false));
  it("absent isStop and status → null", async () => expect((await track({}))?.isStop).toBeNull());
  it("explicit isStop wins over status", async () =>
    expect((await track({ isStop: 0, status: "Stop" }))?.isStop).toBe(false));
});

describe("gps903DateToIso", () => {
  it("returns null for empty input", () => {
    expect(gps903DateToIso("")).toBeNull();
  });

  it("returns null for an unparseable string", () => {
    expect(gps903DateToIso("not a date")).toBeNull();
  });

  it("passes through an explicit-UTC (Z) timestamp", () => {
    expect(gps903DateToIso("2026-06-25T10:00:00Z")).toBe("2026-06-25T10:00:00.000Z");
  });

  it("honors an explicit timezone offset", () => {
    // +07:00 means 03:00 UTC.
    expect(gps903DateToIso("2026-06-25T10:00:00+07:00")).toBe("2026-06-25T03:00:00.000Z");
  });

  it("treats a bare space-separated GPS903 date as UTC", () => {
    // "deviceUtcDate" has no zone; the function appends Z and reads it as UTC.
    expect(gps903DateToIso("2026-06-25 10:00:00")).toBe("2026-06-25T10:00:00.000Z");
  });

  it("normalizes slash-separated dates", () => {
    expect(gps903DateToIso("2026/06/25 10:00:00")).toBe("2026-06-25T10:00:00.000Z");
  });
});
