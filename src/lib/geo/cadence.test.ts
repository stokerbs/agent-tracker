import { describe, expect, it } from "vitest";
import {
  BREADCRUMB_MIN_M,
  IDLE_INTERVAL_MS,
  MOVING_INTERVAL_MS,
  distanceM,
  isMoving,
  reportIntervalMs,
} from "@/lib/geo/cadence";

describe("distanceM", () => {
  it("is zero for the same point", () => {
    expect(distanceM({ lat: 13.7563, lng: 100.5018 }, { lat: 13.7563, lng: 100.5018 })).toBe(0);
  });

  it("matches a known short distance (~111 m per 0.001° latitude)", () => {
    const d = distanceM({ lat: 13.7563, lng: 100.5018 }, { lat: 13.7573, lng: 100.5018 });
    expect(d).toBeGreaterThan(108);
    expect(d).toBeLessThan(114);
  });

  it("is symmetric", () => {
    const a = { lat: 13.75, lng: 100.5 };
    const b = { lat: 13.76, lng: 100.52 };
    expect(distanceM(a, b)).toBeCloseTo(distanceM(b, a), 6);
  });

  it("resolves a sub-breadcrumb jitter step as below the threshold", () => {
    // ~3 m north — should NOT clear the 5 m breadcrumb gate.
    const d = distanceM({ lat: 13.75630, lng: 100.5018 }, { lat: 13.756327, lng: 100.5018 });
    expect(d).toBeLessThan(BREADCRUMB_MIN_M);
  });
});

describe("isMoving", () => {
  it("is moving when fast enough even with no displacement", () => {
    expect(isMoving(10, 0)).toBe(true);
  });

  it("is moving when displaced far enough even at zero speed (GPS speed often null)", () => {
    expect(isMoving(0, 30)).toBe(true);
  });

  it("is stationary when slow and barely displaced", () => {
    expect(isMoving(0.5, 3)).toBe(false);
  });

  it("treats the first fix (no previous point) as moving so it reports promptly", () => {
    expect(isMoving(0, null)).toBe(true);
  });
});

describe("reportIntervalMs", () => {
  it("uses the fast interval while moving", () => {
    expect(reportIntervalMs(20, 50)).toBe(MOVING_INTERVAL_MS);
  });

  it("backs off to the idle interval while stationary", () => {
    expect(reportIntervalMs(0, 1)).toBe(IDLE_INTERVAL_MS);
  });
});
