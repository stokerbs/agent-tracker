import { describe, expect, it } from "vitest";
import { summarizeTrack, type TrackPoint } from "./brief";

// Build a point at a base location offset by ~(metersE) east, at minute `min`.
const base = { lat: 13.75, lng: 100.5 };
function pt(min: number, speed: number, eastDeg = 0): TrackPoint {
  return {
    lat: base.lat,
    lng: base.lng + eastDeg,
    speed,
    t: new Date(Date.UTC(2026, 0, 1, 0, min, 0)).toISOString(),
  };
}

describe("summarizeTrack", () => {
  it("returns a zeroed summary for empty input", () => {
    const s = summarizeTrack([]);
    expect(s.fixes).toBe(0);
    expect(s.distanceKm).toBe(0);
    expect(s.stops).toEqual([]);
    expect(s.firstAt).toBeNull();
  });

  it("handles a single point without NaN or phantom stops", () => {
    const s = summarizeTrack([pt(0, 0)]);
    expect(s.fixes).toBe(1);
    expect(s.distanceKm).toBe(0);
    expect(s.maxSpeedKmh).toBe(0);
    expect(s.stops).toEqual([]); // a 0-minute stop is filtered out
    expect(Number.isNaN(s.distanceKm)).toBe(false);
  });

  it("records a single long stop when stationary throughout", () => {
    // 7 fixes, 10 min apart, all stopped → ~60 min stop
    const pts = Array.from({ length: 7 }, (_, i) => pt(i * 10, 0));
    const s = summarizeTrack(pts);
    expect(s.stops).toHaveLength(1);
    expect(s.stops[0].minutes).toBe(60);
    expect(s.distanceKm).toBe(0);
    expect(s.movingMinutes).toBe(0);
  });

  it("counts moving distance and no stops when always moving", () => {
    const pts = Array.from({ length: 5 }, (_, i) => pt(i, 40, i * 0.01));
    const s = summarizeTrack(pts);
    expect(s.stops).toHaveLength(0);
    expect(s.distanceKm).toBeGreaterThan(0);
    expect(s.movingMinutes).toBeGreaterThan(0);
    expect(s.maxSpeedKmh).toBe(40);
  });

  it("flushes stops on movement and at the end (stop → move → stop)", () => {
    const pts = [
      ...Array.from({ length: 7 }, (_, i) => pt(i * 10, 0)),        // 0–60: stopped (~60m)
      pt(70, 50, 0.05),                                            // 70: moving
      ...Array.from({ length: 7 }, (_, i) => pt(80 + i * 10, 0, 0.05)), // 80–140: stopped (~60m)
    ];
    const s = summarizeTrack(pts);
    expect(s.stops.length).toBe(2);
    // sorted longest-first; both ~60 min
    expect(s.stops[0].minutes).toBeGreaterThanOrEqual(50);
  });

  it("caps stops at 6", () => {
    const pts: TrackPoint[] = [];
    let min = 0;
    for (let k = 0; k < 9; k++) {
      // each stop: two points 10 min apart (stopped), then a moving point
      pts.push(pt(min, 0, k * 0.1)); min += 10;
      pts.push(pt(min, 0, k * 0.1)); min += 1;
      pts.push(pt(min, 60, k * 0.1 + 0.05)); min += 5;
    }
    const s = summarizeTrack(pts);
    expect(s.stops.length).toBeLessThanOrEqual(6);
  });
});
