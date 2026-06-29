import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildOpsDigest, summarizeOps, templateDigest, type OpsRaw } from "./digest";

const NOW = new Date("2026-06-30T12:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const empty: OpsRaw = {
  cases: [], timeline: [], geofence: [], alerts: [], expenses: [], agents: [], devices: [],
};

describe("summarizeOps", () => {
  it("returns zeroed summary for empty input", () => {
    const s = summarizeOps(empty, "day", NOW);
    expect(s.windowHours).toBe(24);
    expect(s.cases.openedInWindow).toBe(0);
    expect(s.expenses.totalThb).toBe(0);
    expect(s.alerts.active).toEqual([]);
  });

  it("counts cases opened/closed within the window and currently open", () => {
    const raw: OpsRaw = {
      ...empty,
      cases: [
        { case_number: "C-1", status: "active", priority: "critical", case_type: "ติดตาม", client_name: "A", created_at: ago(2), updated_at: ago(1) },
        { case_number: "C-2", status: "closed", priority: "low", case_type: "x", client_name: "B", created_at: ago(200), updated_at: ago(3) },
        { case_number: "C-3", status: "new", priority: "high", case_type: "y", client_name: "C", created_at: ago(48), updated_at: ago(48) },
      ],
    };
    const s = summarizeOps(raw, "day", NOW);
    expect(s.cases.openedInWindow).toBe(1); // only C-1 created within 24h
    expect(s.cases.closedInWindow).toBe(1); // C-2 closed within 24h
    expect(s.cases.currentlyOpen).toBe(2); // C-1 active + C-3 new
    expect(s.cases.currentlyActive).toBe(1);
    // high/critical open cases surfaced, critical first
    expect(s.cases.priorityOpen.map((c) => c.caseNumber)).toEqual(["C-1", "C-3"]);
  });

  it("widens the window for period=week", () => {
    const raw: OpsRaw = {
      ...empty,
      cases: [{ case_number: "C-3", status: "new", priority: "high", case_type: "y", client_name: "C", created_at: ago(48), updated_at: ago(48) }],
    };
    expect(summarizeOps(raw, "day", NOW).cases.openedInWindow).toBe(0);
    expect(summarizeOps(raw, "week", NOW).cases.openedInWindow).toBe(1);
  });

  it("aggregates geofence crossings and zone counts", () => {
    const raw: OpsRaw = {
      ...empty,
      geofence: [
        { event_type: "enter", occurred_at: ago(1), zone: "บ้านเป้าหมาย" },
        { event_type: "exit", occurred_at: ago(1), zone: "บ้านเป้าหมาย" },
        { event_type: "enter", occurred_at: ago(200), zone: "เก่า" }, // out of window
      ],
    };
    const s = summarizeOps(raw, "day", NOW);
    expect(s.geofence.enters).toBe(1);
    expect(s.geofence.exits).toBe(1);
    expect(s.geofence.total).toBe(2);
    expect(s.geofence.zones[0]).toEqual({ zone: "บ้านเป้าหมาย", count: 2 });
  });

  it("attaches a Google Maps link to active SOS alerts with coordinates", () => {
    const raw: OpsRaw = {
      ...empty,
      alerts: [
        { status: "active", created_at: ago(1), notes: "SOS!", lat: 13.7563, lng: 100.5018 },
        { status: "resolved", created_at: ago(2), notes: "old", lat: 1, lng: 2 },
      ],
    };
    const s = summarizeOps(raw, "day", NOW);
    expect(s.alerts.newInWindow).toBe(2); // both created in window
    expect(s.alerts.currentlyActive).toBe(1); // only the unresolved one
    expect(s.alerts.active[0].maps).toContain("13.75630,100.50180");
  });

  it("totals expenses in window and groups by category", () => {
    const raw: OpsRaw = {
      ...empty,
      expenses: [
        { amount: 500, category: "fuel", expense_date: ago(2) },
        { amount: 300, category: "fuel", expense_date: ago(3) },
        { amount: 1000, category: "food", expense_date: ago(200) }, // out of window
      ],
    };
    const s = summarizeOps(raw, "day", NOW);
    expect(s.expenses.count).toBe(2);
    expect(s.expenses.totalThb).toBe(800);
    expect(s.expenses.byCategory[0]).toEqual({ category: "fuel", total: 800 });
  });

  it("classifies agents and stale GPS devices", () => {
    const raw: OpsRaw = {
      ...empty,
      agents: [{ status: "online" }, { status: "idle" }, { status: "offline" }],
      devices: [{ last_seen_at: ago(0.1) }, { last_seen_at: ago(2) }, { last_seen_at: null }],
    };
    const s = summarizeOps(raw, "day", NOW);
    expect(s.agents.total).toBe(3);
    expect(s.agents.active).toBe(2);
    expect(s.agents.offline).toBe(1);
    expect(s.agents.idle).toBe(1);
    expect(s.devices.active).toBe(1); // last 6 min
    expect(s.devices.stale).toBe(1); // 2h ago (null skipped)
  });
});

describe("templateDigest", () => {
  it("renders a readable fallback and includes SOS maps links", () => {
    const raw: OpsRaw = {
      ...empty,
      alerts: [{ status: "active", created_at: ago(1), notes: "SOS!", lat: 13.7, lng: 100.5 }],
    };
    const out = templateDigest(summarizeOps(raw, "day", NOW));
    expect(out).toContain("สรุปปฏิบัติการ");
    expect(out).toContain("https://www.google.com/maps");
  });
});

describe("buildOpsDigest — AI failure fallbacks", () => {
  const summary = summarizeOps(empty, "day", NOW);

  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back to the template (ai:false) and logs when no API key is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await buildOpsDigest(summary);
    expect(r.ai).toBe(false);
    expect(r.digest).toBe(templateDigest(summary));
  });

  it("falls back and logs when Anthropic returns a non-OK response", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 }) as Response));
    const r = await buildOpsDigest(summary);
    expect(r.ai).toBe(false);
    expect(r.digest).toBe(templateDigest(summary));
    expect(err).toHaveBeenCalled();
  });

  it("falls back and logs when the fetch throws", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const r = await buildOpsDigest(summary);
    expect(r.ai).toBe(false);
    expect(r.digest).toBe(templateDigest(summary));
    expect(err).toHaveBeenCalled();
  });

  it("returns the AI digest (ai:true) on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ content: [{ text: "สรุป AI" }] }) }) as Response));
    const r = await buildOpsDigest(summary);
    expect(r.ai).toBe(true);
    expect(r.digest).toBe("สรุป AI");
  });
});
