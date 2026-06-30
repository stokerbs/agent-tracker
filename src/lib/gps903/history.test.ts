import { afterEach, describe, expect, it, vi } from "vitest";
import { gps903GetHistory } from "./history";

// GetDevicesHistory `d` is a JS array literal string (not JSON), eval-decoded.
function envelope(rows: Array<Record<string, string | number>>): Response {
  const lit =
    "[" +
    rows
      .map(
        (r) =>
          "{" +
          Object.entries(r)
            .map(([k, v]) => (typeof v === "number" ? `${k}:${v}` : `${k}:"${v}"`))
            .join(",") +
          "}",
      )
      .join(",") +
    "]";
  return { ok: true, status: 200, json: async () => ({ d: lit }) } as unknown as Response;
}

const pt = (date: string, lat = 13.7, lng = 100.5) => ({
  latitude: String(lat), longitude: String(lng), speed: "0", course: 0, deviceUtcDate: date, stopTimeMinute: 0,
});

const call = () => gps903GetHistory("cookie", 1, "2026-06-30 00:00:00", "2026-06-30 23:59:59");

afterEach(() => vi.unstubAllGlobals());

describe("gps903GetHistory", () => {
  it("returns points sorted oldest-first regardless of upstream order", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => envelope([
      pt("2026-06-30 09:00:00"),
      pt("2026-06-30 08:00:00"),
      pt("2026-06-30 10:00:00"),
    ])));
    const out = await call();
    expect(out.map((p) => p.fixTime)).toEqual([
      "2026-06-30 08:00:00",
      "2026-06-30 09:00:00",
      "2026-06-30 10:00:00",
    ]);
  });

  it("maps lat/lng/speed/stopMinutes and drops rows without coordinates", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => envelope([
      { ...pt("2026-06-30 08:00:00", 13.75, 100.5), speed: "42", stopTimeMinute: 12 },
      { speed: "0", course: 0, deviceUtcDate: "2026-06-30 09:00:00", stopTimeMinute: 0 }, // no lat/lng → dropped
    ])));
    const out = await call();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ lat: 13.75, lng: 100.5, speed: 42, stopMinutes: 12 });
  });

  it("returns [] on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 }) as Response));
    expect(await call()).toEqual([]);
  });

  it("returns [] on a fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    expect(await call()).toEqual([]);
  });

  it("returns [] when the d field is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ d: "" }) }) as unknown as Response));
    expect(await call()).toEqual([]);
  });
});
