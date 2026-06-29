import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAnomalyAlert,
  detectAnomalies,
  templateAlert,
  type Fix,
} from "./anomaly";

const NOW = new Date("2026-06-30T12:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

// Build a dense baseline of fixes all clustered at one "home" location, spread
// across the baseline window (older than 24h), parked (speed 0) and daytime.
function homeBaseline(n: number, lat = 13.7563, lng = 100.5018): Fix[] {
  const out: Fix[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ lat: lat + (i % 5) * 0.0001, lng: lng + (i % 5) * 0.0001, speed: 0, t: ago(48 + i) });
  }
  return out;
}

describe("detectAnomalies — new-location", () => {
  it("flags a recent dwell far from every known baseline place", () => {
    const r = detectAnomalies({
      baseline: homeBaseline(60),
      recent: [{ lat: 18.7883, lng: 98.9853, speed: 0, t: ago(2) }], // Chiang Mai — far away
      lastSeenAt: ago(0.1),
      now: NOW,
    });
    const nl = r.signals.find((s) => s.kind === "new-location");
    expect(nl).toBeTruthy();
    expect(nl!.maps).toContain("18.78830,98.98530");
    expect(r.signature).toContain("nl:");
  });

  it("ignores a fuzzy LBS dwell so it can't fake a new location", () => {
    const farAway = { lat: 18.7883, lng: 98.9853, speed: 0, t: ago(2) };
    // Same far point: GPS → flagged, LBS → ignored.
    const gps = detectAnomalies({ baseline: homeBaseline(60), recent: [{ ...farAway, mode: "gps" }], lastSeenAt: ago(0.1), now: NOW });
    const lbs = detectAnomalies({ baseline: homeBaseline(60), recent: [{ ...farAway, mode: "lbs" }], lastSeenAt: ago(0.1), now: NOW });
    expect(gps.signals.find((s) => s.kind === "new-location")).toBeTruthy();
    expect(lbs.signals.find((s) => s.kind === "new-location")).toBeUndefined();
  });

  it("honours the ANOMALY_NEW_LOC_KM env override", () => {
    const recent = [{ lat: 18.7883, lng: 98.9853, speed: 0, t: ago(2) }]; // ~580km away
    vi.stubEnv("ANOMALY_NEW_LOC_KM", "9999"); // raise threshold above the real distance
    try {
      const r = detectAnomalies({ baseline: homeBaseline(60), recent, lastSeenAt: ago(0.1), now: NOW });
      expect(r.signals.find((s) => s.kind === "new-location")).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("reflects the baseline window (default 7d, overridable) in the wording", () => {
    const recent = [{ lat: 18.7883, lng: 98.9853, speed: 0, t: ago(2) }];
    const def = detectAnomalies({ baseline: homeBaseline(60), recent, lastSeenAt: ago(0.1), now: NOW });
    expect(def.signals.find((s) => s.kind === "new-location")!.detail).toContain("7 วัน");
    const wk2 = detectAnomalies({ baseline: homeBaseline(60), recent, lastSeenAt: ago(0.1), now: NOW, baselineDays: 14 });
    expect(wk2.signals.find((s) => s.kind === "new-location")!.detail).toContain("14 วัน");
  });

  it("does NOT flag a recent dwell at the usual place", () => {
    const r = detectAnomalies({
      baseline: homeBaseline(60),
      recent: [{ lat: 13.7563, lng: 100.5018, speed: 0, t: ago(2) }],
      lastSeenAt: ago(0.1),
      now: NOW,
    });
    expect(r.signals.find((s) => s.kind === "new-location")).toBeUndefined();
  });

  it("ignores baseline-relative signals when baseline is too thin", () => {
    const r = detectAnomalies({
      baseline: homeBaseline(10), // < BASELINE_MIN_FIXES
      recent: [{ lat: 18.7883, lng: 98.9853, speed: 0, t: ago(2) }],
      lastSeenAt: ago(0.1),
      now: NOW,
    });
    expect(r.signals.find((s) => s.kind === "new-location")).toBeUndefined();
  });
});

describe("detectAnomalies — went-dark", () => {
  it("flags a normally-reporting device silent for >2h", () => {
    const r = detectAnomalies({
      baseline: homeBaseline(60),
      recent: [],
      lastSeenAt: ago(5),
      now: NOW,
    });
    expect(r.signals.find((s) => s.kind === "went-dark")).toBeTruthy();
    expect(r.signature).toContain("dark");
  });

  it("does not flag when the device reported recently", () => {
    const r = detectAnomalies({
      baseline: homeBaseline(60),
      recent: [{ lat: 13.7563, lng: 100.5018, speed: 0, t: ago(0.2) }],
      lastSeenAt: ago(0.2),
      now: NOW,
    });
    expect(r.signals.find((s) => s.kind === "went-dark")).toBeUndefined();
  });
});

describe("detectAnomalies — night-activity", () => {
  // 19:00 UTC = 02:00 Thai (night). 06:00 UTC = 13:00 Thai (day).
  const nightFix: Fix = { lat: 13.8, lng: 100.6, speed: 30, t: "2026-06-30T19:00:00Z" };

  it("flags night movement when baseline has none", () => {
    const r = detectAnomalies({
      baseline: homeBaseline(60), // all parked + daytime
      recent: [nightFix, nightFix, nightFix],
      lastSeenAt: ago(0.1),
      now: NOW,
    });
    expect(r.signals.find((s) => s.kind === "night-activity")).toBeTruthy();
    expect(r.signature).toContain("na:");
  });

  it("does not flag daytime movement", () => {
    const dayFix: Fix = { lat: 13.8, lng: 100.6, speed: 30, t: new Date("2026-06-30T06:00:00Z").toISOString() };
    const r = detectAnomalies({
      baseline: homeBaseline(60),
      recent: [dayFix, dayFix, dayFix],
      lastSeenAt: ago(0.1),
      now: NOW,
    });
    expect(r.signals.find((s) => s.kind === "night-activity")).toBeUndefined();
  });
});

describe("detectAnomalies — signature dedup", () => {
  it("is stable across runs for the same ongoing anomaly", () => {
    const input = {
      baseline: homeBaseline(60),
      recent: [{ lat: 18.7883, lng: 98.9853, speed: 0, t: ago(2) }],
      lastSeenAt: ago(5),
      now: NOW,
    };
    expect(detectAnomalies(input).signature).toBe(detectAnomalies(input).signature);
  });

  it("orders multi-signal signatures deterministically", () => {
    // went-dark + new-location fire together; signature must be order-independent.
    const r = detectAnomalies({
      baseline: homeBaseline(60),
      recent: [{ lat: 18.7883, lng: 98.9853, speed: 0, t: ago(2) }],
      lastSeenAt: ago(5),
      now: NOW,
    });
    expect(r.signals.length).toBeGreaterThanOrEqual(2);
    expect(r.signature).toContain("dark");
    expect(r.signature).toContain("nl:");
    // sorted join → "dark" sorts before "nl:" regardless of detection order
    expect(r.signature).toBe([...r.signature.split("|")].sort().join("|"));
  });

  it("returns an empty signature when nothing is wrong", () => {
    const r = detectAnomalies({
      baseline: homeBaseline(60),
      recent: [{ lat: 13.7563, lng: 100.5018, speed: 0, t: ago(1) }],
      lastSeenAt: ago(0.1),
      now: NOW,
    });
    expect(r.signals).toEqual([]);
    expect(r.signature).toBe("");
  });
});

describe("buildAnomalyAlert", () => {
  const signals = [
    { kind: "new-location" as const, detail: "สถานที่ใหม่", lat: 18.78, lng: 98.98, maps: "https://www.google.com/maps?q=18.78000,98.98000", at: ago(2) },
  ];

  beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", "test-key"));
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("template fallback includes the maps link", () => {
    const out = templateAlert("รถเป้าหมาย", signals);
    expect(out).toContain("รถเป้าหมาย");
    expect(out).toContain("https://www.google.com/maps");
  });

  it("returns ai:false template when no API key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await buildAnomalyAlert("รถเป้าหมาย", signals);
    expect(r.ai).toBe(false);
    expect(r.text).toBe(templateAlert("รถเป้าหมาย", signals));
  });

  it("returns ai:false (no call) when there are no signals", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await buildAnomalyAlert("รถเป้าหมาย", []);
    expect(r.ai).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back and logs on non-OK response", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 }) as Response));
    const r = await buildAnomalyAlert("รถเป้าหมาย", signals);
    expect(r.ai).toBe(false);
    expect(err).toHaveBeenCalled();
  });

  it("returns the AI text on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ content: [{ text: "แจ้งเตือน AI" }] }) }) as Response));
    const r = await buildAnomalyAlert("รถเป้าหมาย", signals);
    expect(r.ai).toBe(true);
    expect(r.text).toBe("แจ้งเตือน AI");
  });
});
