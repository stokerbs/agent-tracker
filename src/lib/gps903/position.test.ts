import { describe, expect, it, vi, beforeEach } from "vitest";

// Stub notifications (no real Supabase / push) and the AI wording (no network).
vi.mock("@/lib/notifications", () => ({
  notifyRole: vi.fn(async () => {}),
  notificationLinks: { map: () => "/map" },
}));
vi.mock("@/lib/geo/geofence", async (orig) => ({
  ...(await orig<typeof import("@/lib/geo/geofence")>()),
  buildGeofenceAlert: vi.fn(async () => "ALERT"),
}));

import { applyPositionToDevice } from "./position";
import { notifyRole } from "@/lib/notifications";
import type { TrackingResult } from "./tracking";

const DEV = "dev-1";

// Square fence (~±0.01°) centred on a point.
function fenceAround(id: string, name: string, lat: number, lng: number) {
  return {
    id, name,
    coordinates: [
      { lat: lat - 0.01, lng: lng - 0.01 },
      { lat: lat - 0.01, lng: lng + 0.01 },
      { lat: lat + 0.01, lng: lng + 0.01 },
      { lat: lat + 0.01, lng: lng - 0.01 },
    ],
  };
}

function pos(lat: number, lng: number): TrackingResult {
  return { lat, lng, speed: 0, course: 0, battery: 80, ignition: false, fixTime: "2026-06-30 00:00:00", locateMode: "gps", stopMinutes: null, isStop: true };
}

// Chainable mock SvcClient. `single` = row returned by .maybeSingle() per table;
// `list` = data returned when a select chain is awaited directly (geofences).
function makeSvc(opts: { device: Record<string, unknown> | null; fences: unknown[] }) {
  const inserts: Array<{ table: string; row: any }> = [];
  const updates: Array<{ table: string; obj: any }> = [];
  const from = (table: string) => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: table === "gps_devices" ? opts.device : null }),
      insert: async (row: any) => { inserts.push({ table, row }); return { error: null }; },
      update: (obj: any) => ({ eq: async () => { updates.push({ table, obj }); return { error: null }; } }),
      // Awaiting a select chain (e.g. geofences) resolves to its list.
      then: (resolve: (v: any) => void) => resolve({ data: table === "geofences" ? opts.fences : null }),
    };
    return builder;
  };
  return { svc: { from } as any, inserts, updates };
}

const geofenceEvents = (inserts: Array<{ table: string; row: any }>) =>
  inserts.filter((i) => i.table === "geofence_events");

describe("applyPositionToDevice — geofence hysteresis", () => {
  beforeEach(() => vi.mocked(notifyRole).mockClear());

  it("first-ever fix entering a fence fires exactly one enter alert", async () => {
    const fenceA = fenceAround("A", "Zone A", 13.75, 100.5);
    const { svc, inserts, updates } = makeSvc({
      device: { geofence_id: null, geofence_alerted_at: null, stopped_since: null, last_lat: null, last_lng: null },
      fences: [fenceA],
    });

    await applyPositionToDevice(svc, DEV, pos(13.75, 100.5), "Tracker-1");

    const evs = geofenceEvents(inserts);
    expect(evs).toHaveLength(1);
    expect(evs[0].row).toMatchObject({ geofence_id: "A", gps_device_id: DEV, event_type: "enter" });
    expect(vi.mocked(notifyRole)).toHaveBeenCalledTimes(1);
    // device state advanced to fence A
    expect(updates.some((u) => u.table === "gps_devices" && u.obj.geofence_id === "A")).toBe(true);
  });

  it("absorbs a flap within the cooldown — no event, no alert, state unchanged", async () => {
    const fenceA = fenceAround("A", "Zone A", 13.75, 100.5);
    const { svc, inserts, updates } = makeSvc({
      // currently recorded inside A, alerted 30s ago (within 3-min cooldown)
      device: { geofence_id: "A", geofence_alerted_at: new Date(Date.now() - 30_000).toISOString(), stopped_since: null, last_lat: 13.75, last_lng: 100.5 },
      fences: [fenceA],
    });

    // now reports far outside A
    await applyPositionToDevice(svc, DEV, pos(14.5, 101.5), "Tracker-1");

    expect(geofenceEvents(inserts)).toHaveLength(0);
    expect(vi.mocked(notifyRole)).not.toHaveBeenCalled();
    // geofence state NOT mutated (no gps_devices update carrying geofence_id)
    expect(updates.some((u) => u.table === "gps_devices" && "geofence_id" in u.obj)).toBe(false);
  });

  it("confirms an A→B move past cooldown: exit A + enter B (two alerts)", async () => {
    const fenceA = fenceAround("A", "Zone A", 13.75, 100.5);
    const fenceB = fenceAround("B", "Zone B", 14.00, 100.8);
    const { svc, inserts, updates } = makeSvc({
      device: { geofence_id: "A", geofence_alerted_at: new Date(Date.now() - 10 * 60_000).toISOString(), stopped_since: null, last_lat: 13.75, last_lng: 100.5 },
      fences: [fenceA, fenceB],
    });

    await applyPositionToDevice(svc, DEV, pos(14.0, 100.8), "Tracker-1"); // inside B

    const evs = geofenceEvents(inserts);
    expect(evs).toHaveLength(2);
    expect(evs.map((e) => e.row.event_type).sort()).toEqual(["enter", "exit"]);
    expect(evs.find((e) => e.row.event_type === "exit")!.row.geofence_id).toBe("A");
    expect(evs.find((e) => e.row.event_type === "enter")!.row.geofence_id).toBe("B");
    expect(vi.mocked(notifyRole)).toHaveBeenCalledTimes(2);
    expect(updates.some((u) => u.table === "gps_devices" && u.obj.geofence_id === "B")).toBe(true);
  });

  it("null geofence_alerted_at is treated as not-in-cooldown (alert fires)", async () => {
    const fenceA = fenceAround("A", "Zone A", 13.75, 100.5);
    const { svc, inserts } = makeSvc({
      device: { geofence_id: null, geofence_alerted_at: null, stopped_since: null, last_lat: 13.0, last_lng: 100.0 },
      fences: [fenceA],
    });
    await applyPositionToDevice(svc, DEV, pos(13.75, 100.5), "Tracker-1");
    expect(geofenceEvents(inserts)).toHaveLength(1);
    expect(vi.mocked(notifyRole)).toHaveBeenCalledTimes(1);
  });

  it("records locate_mode on the inserted position row (for LBS filtering)", async () => {
    const { svc, inserts } = makeSvc({
      device: { geofence_id: null, geofence_alerted_at: null, stopped_since: null, last_lat: null, last_lng: null },
      fences: [],
    });
    await applyPositionToDevice(svc, DEV, pos(13.75, 100.5), "Tracker-1");
    const posInsert = inserts.find((i) => i.table === "gps_device_positions");
    expect(posInsert?.row).toMatchObject({ gps_device_id: DEV, locate_mode: "gps" });
  });
});

describe("applyPositionToDevice — stop detection (speed OR GPS displacement)", () => {
  const deviceUpdate = (updates: Array<{ table: string; obj: any }>) =>
    updates.find((u) => u.table === "gps_devices")!.obj;
  const STALE = "2026-06-29T15:54:11Z"; // a stored stop start in the past
  const posMode = (lat: number, lng: number, mode: "gps" | "lbs"): TrackingResult => ({
    ...pos(lat, lng),
    locateMode: mode,
  });

  it("clears stop when the GPS position jumped >100m even though speed reports 0", async () => {
    const { svc, updates } = makeSvc({
      device: { geofence_id: null, geofence_alerted_at: null, stopped_since: STALE, last_lat: 13.0, last_lng: 100.0 },
      fences: [],
    });
    // ~90km jump, speed 0, GPS → must be treated as moving.
    await applyPositionToDevice(svc, DEV, posMode(13.75, 100.5, "gps"), "Tracker-1");
    expect(deviceUpdate(updates)).toMatchObject({ stopped_since: null, last_stop_minutes: 0 });
  });

  it("keeps stop running when only GPS jitter (<100m) at speed 0", async () => {
    const { svc, updates } = makeSvc({
      device: { geofence_id: null, geofence_alerted_at: null, stopped_since: STALE, last_lat: 13.75000, last_lng: 100.50000 },
      fences: [],
    });
    // ~25m jitter → still parked; existing stopped_since preserved.
    await applyPositionToDevice(svc, DEV, posMode(13.75015, 100.50015, "gps"), "Tracker-1");
    const obj = deviceUpdate(updates);
    expect(obj.stopped_since).toBe(STALE);
    expect(obj.last_stop_minutes).toBeGreaterThan(0);
  });

  it("does NOT treat a large LBS position change as movement (LBS jitter)", async () => {
    const { svc, updates } = makeSvc({
      device: { geofence_id: null, geofence_alerted_at: null, stopped_since: STALE, last_lat: 13.0, last_lng: 100.0 },
      fences: [],
    });
    // Huge displacement but LBS → ignored; device stays "stopped".
    await applyPositionToDevice(svc, DEV, posMode(13.75, 100.5, "lbs"), "Tracker-1");
    expect(deviceUpdate(updates).stopped_since).toBe(STALE);
  });

  it("clears stop when the 903 flag says moving (isStop=false) at speed 0, no displacement", async () => {
    const { svc, updates } = makeSvc({
      device: { geofence_id: null, geofence_alerted_at: null, stopped_since: STALE, last_lat: 13.75, last_lng: 100.5 },
      fences: [],
    });
    // device's own flag = moving, even though speed 0 and position unchanged.
    await applyPositionToDevice(svc, DEV, { ...posMode(13.75, 100.5, "gps"), isStop: false }, "Tracker-1");
    expect(deviceUpdate(updates)).toMatchObject({ stopped_since: null, last_stop_minutes: 0 });
  });

  it("treats reported speed > 3 as moving even with no displacement", async () => {
    const { svc, updates } = makeSvc({
      device: { geofence_id: null, geofence_alerted_at: null, stopped_since: STALE, last_lat: 13.75, last_lng: 100.5 },
      fences: [],
    });
    // same position (0m moved) but driving per reported speed → moving.
    await applyPositionToDevice(svc, DEV, { ...posMode(13.75, 100.5, "gps"), speed: 42 }, "Tracker-1");
    expect(deviceUpdate(updates)).toMatchObject({ stopped_since: null, last_stop_minutes: 0 });
  });

  it("seeds a fresh stop from now (not the GPS fix time) on first stationary fix", async () => {
    const { svc, updates } = makeSvc({
      device: { geofence_id: null, geofence_alerted_at: null, stopped_since: null, last_lat: 13.75, last_lng: 100.5 },
      fences: [],
    });
    await applyPositionToDevice(svc, DEV, posMode(13.75, 100.5, "gps"), "Tracker-1");
    const obj = deviceUpdate(updates);
    // seeded ~now → small elapsed, and NOT the 2026-06-30 00:00 fixTime in pos()
    expect(obj.last_stop_minutes).toBeLessThan(5);
    expect(Date.parse(obj.stopped_since)).toBeGreaterThan(Date.parse("2026-06-30T00:00:00Z"));
  });
});
