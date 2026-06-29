/**
 * anomaly-watch cron: fail-closed CRON_SECRET auth, and that a NEW anomaly
 * notifies staff once while an unchanged signature is deduped (no re-notify).
 * Uses the real detector (detectAnomalies) with the template-alert fallback
 * (no ANTHROPIC_API_KEY) so no network call is made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({
  notifyRole: vi.fn(),
  devices: [] as unknown[],
  positions: [] as unknown[],
  updates: [] as unknown[],
}));

vi.mock("@/lib/notifications", () => ({
  notifyRole: h.notifyRole,
  notificationLinks: { gpsMonitor: () => "/gps-monitor" },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      let isUpdate = false;
      for (const m of ["select", "eq", "gte", "is", "not", "order", "limit"]) b[m] = () => b;
      b.update = (vals: unknown) => { isUpdate = true; h.updates.push(vals); return b; };
      (b as { then: unknown }).then = (res: (v: unknown) => unknown) => {
        if (table === "gps_device_positions") return res({ data: h.positions });
        if (isUpdate) return res({ error: null });
        return res({ data: h.devices }); // gps_devices select
      };
      return b;
    },
  }),
}));

function req(authHeader?: string) {
  return {
    headers: { get: (k: string) => (k === "authorization" ? authHeader ?? null : null) },
  } as unknown as import("next/server").NextRequest;
}

async function load() {
  return import("@/app/api/cron/anomaly-watch/route");
}

// 60 parked daytime fixes at "home", all older than 24h → a trusted baseline.
function homeBaseline(n = 60) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ lat: 13.7563, lng: 100.5018, speed_kmh: 0, recorded_at: new Date(Date.now() - (48 + i) * 3_600_000).toISOString() });
  }
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.devices.length = 0;
  h.positions.length = 0;
  h.updates.length = 0;
  process.env.CRON_SECRET = "test-secret";
  delete process.env.ANTHROPIC_API_KEY; // force template fallback (no network)
});
afterEach(() => vi.restoreAllMocks());

describe("anomaly-watch auth", () => {
  it("401 without authorization header", async () => {
    const { GET } = await load();
    expect((await GET(req())).status).toBe(401);
    expect(h.notifyRole).not.toHaveBeenCalled();
  });
  it("401 with wrong secret", async () => {
    const { GET } = await load();
    expect((await GET(req("Bearer nope"))).status).toBe(401);
  });
});

describe("anomaly-watch detection + dedup", () => {
  it("notifies once for a newly-detected anomaly (went-dark) and records the signature", async () => {
    h.devices.push({
      id: "dev-1", notes: "รถเป้าหมาย", gps903_device_id: 7, case_id: "case-1",
      last_seen_at: new Date(Date.now() - 5 * 3_600_000).toISOString(), // 5h silent
      anomaly_signature: null,
    });
    h.positions.push(...homeBaseline());

    const { GET } = await load();
    const res = await GET(req("Bearer test-secret"));
    const body = await res.json();

    expect(body).toMatchObject({ ok: true, scanned: 1, alerted: 1 });
    expect(h.notifyRole).toHaveBeenCalledTimes(1);
    expect(h.notifyRole).toHaveBeenCalledWith(
      ["admin", "supervisor"],
      expect.objectContaining({ url: "/gps-monitor", entityId: "case-1", priority: "high" }),
    );
    expect(h.updates[0]).toMatchObject({ anomaly_signature: "dark" });
  });

  it("does not re-notify when the signature is unchanged", async () => {
    h.devices.push({
      id: "dev-1", notes: "รถเป้าหมาย", gps903_device_id: 7, case_id: "case-1",
      last_seen_at: new Date(Date.now() - 5 * 3_600_000).toISOString(),
      anomaly_signature: "dark", // already alerted
    });
    h.positions.push(...homeBaseline());

    const { GET } = await load();
    const body = await (await GET(req("Bearer test-secret"))).json();

    expect(body).toMatchObject({ ok: true, scanned: 1, alerted: 0 });
    expect(h.notifyRole).not.toHaveBeenCalled();
    expect(h.updates).toHaveLength(0);
  });

  it("clears a recovered anomaly: resets signature without notifying", async () => {
    h.devices.push({
      id: "dev-1", notes: "รถเป้าหมาย", gps903_device_id: 7, case_id: "case-1",
      last_seen_at: new Date(Date.now() - 0.2 * 3_600_000).toISOString(), // reporting again
      anomaly_signature: "dark", // was dark, now recovered
    });
    // baseline + a fresh home fix → no anomaly now
    h.positions.push(...homeBaseline(), { lat: 13.7563, lng: 100.5018, speed_kmh: 0, recorded_at: new Date(Date.now() - 0.2 * 3_600_000).toISOString() });

    const { GET } = await load();
    const body = await (await GET(req("Bearer test-secret"))).json();

    expect(body).toMatchObject({ ok: true, scanned: 1, alerted: 0 });
    expect(h.notifyRole).not.toHaveBeenCalled();
    expect(h.updates[0]).toMatchObject({ anomaly_signature: "", anomaly_notified_at: null });
  });

  it("does not raise new-location from a fuzzy LBS fix", async () => {
    h.devices.push({
      id: "dev-1", notes: "รถเป้าหมาย", gps903_device_id: 7, case_id: "case-1",
      last_seen_at: new Date(Date.now() - 0.2 * 3_600_000).toISOString(), // reporting → no went-dark
      anomaly_signature: null,
    });
    // Baseline at home + a far recent dwell that is LBS-sourced → must be ignored.
    h.positions.push(
      ...homeBaseline(),
      { lat: 18.7883, lng: 98.9853, speed_kmh: 0, recorded_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), locate_mode: "lbs" },
    );

    const { GET } = await load();
    const body = await (await GET(req("Bearer test-secret"))).json();

    expect(body).toMatchObject({ ok: true, scanned: 1, alerted: 0 });
    expect(h.notifyRole).not.toHaveBeenCalled();
  });

  it("returns scanned:0 gracefully when there are no devices", async () => {
    const { GET } = await load();
    const body = await (await GET(req("Bearer test-secret"))).json();
    expect(body).toMatchObject({ ok: true, scanned: 0, alerted: 0 });
    expect(h.notifyRole).not.toHaveBeenCalled();
  });
});
