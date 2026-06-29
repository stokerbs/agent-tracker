import { describe, expect, it, vi } from "vitest";

// flattenGpsRow is a pure transform, but queries.ts transitively imports the
// Supabase server client (which pulls in next/headers). Stub that module so the
// test stays hermetic — no Supabase client, no network.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { flattenGpsRow, getRecentGeofenceEvents } from "./queries";
import { createClient } from "@/lib/supabase/server";

// Stub the user-session client to return a fixed geofence_events page.
function stubClientWith(rows: unknown[]) {
  vi.mocked(createClient).mockResolvedValue({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({ data: rows }),
        }),
      }),
    }),
  } as never);
}

describe("flattenGpsRow (PERF-2)", () => {
  it("maps case_number and all four cred_* from populated embeds", () => {
    const row = {
      id: "device-1",
      last_lat: 13.7563,
      cases: { case_number: "CASE-001" },
      gps903_credentials: {
        device_name: "Tracker A",
        imei: "356938035643809",
        phone_number: "+66801234567",
        provider: "AIS",
      },
    } as unknown as Parameters<typeof flattenGpsRow>[0];

    const out = flattenGpsRow(row);

    expect(out.case_number).toBe("CASE-001");
    expect(out.cred_name).toBe("Tracker A");
    expect(out.cred_imei).toBe("356938035643809");
    expect(out.cred_phone).toBe("+66801234567");
    expect(out.cred_provider).toBe("AIS");
  });

  it("falls back to null when cases and gps903_credentials are null", () => {
    const row = {
      id: "device-2",
      last_lat: 13.7563,
      cases: null,
      gps903_credentials: null,
    } as unknown as Parameters<typeof flattenGpsRow>[0];

    const out = flattenGpsRow(row);

    expect(out.case_number).toBeNull();
    expect(out.cred_name).toBeNull();
    expect(out.cred_imei).toBeNull();
    expect(out.cred_phone).toBeNull();
    expect(out.cred_provider).toBeNull();
  });
});

describe("getRecentGeofenceEvents — subject labelling", () => {
  it("labels an agent crossing with the agent's name", async () => {
    stubClientWith([
      { id: "e1", agent_id: "a1", gps_device_id: null, geofence_id: "g1", event_type: "enter",
        occurred_at: "2026-06-30T00:00:00Z", agents: { full_name: "Alex" }, gps_devices: null, geofences: { name: "Zone A" } },
    ]);
    const [ev] = await getRecentGeofenceEvents();
    expect(ev.agentName).toBe("Alex");
    expect(ev.fenceName).toBe("Zone A");
  });

  it("labels a device crossing with the device notes", async () => {
    stubClientWith([
      { id: "e2", agent_id: null, gps_device_id: "d1", geofence_id: "g1", event_type: "exit",
        occurred_at: "2026-06-30T00:00:00Z", agents: null, gps_devices: { notes: "Car 7", gps903_device_id: 999 }, geofences: { name: "Zone A" } },
    ]);
    const [ev] = await getRecentGeofenceEvents();
    expect(ev.agentName).toBe("Car 7");
  });

  it("falls back to GPS903-<id> for a device with no notes", async () => {
    stubClientWith([
      { id: "e3", agent_id: null, gps_device_id: "d1", geofence_id: "g1", event_type: "enter",
        occurred_at: "2026-06-30T00:00:00Z", agents: null, gps_devices: { notes: null, gps903_device_id: 12345 }, geofences: { name: "Zone A" } },
    ]);
    const [ev] = await getRecentGeofenceEvents();
    expect(ev.agentName).toBe("GPS903-12345");
  });

  it("falls back to 'Unknown agent' when neither subject embed resolves", async () => {
    stubClientWith([
      { id: "e4", agent_id: null, gps_device_id: null, geofence_id: "g1", event_type: "enter",
        occurred_at: "2026-06-30T00:00:00Z", agents: null, gps_devices: null, geofences: null },
    ]);
    const [ev] = await getRecentGeofenceEvents();
    expect(ev.agentName).toBe("Unknown agent");
    expect(ev.fenceName).toBe("Unknown zone");
  });
});
