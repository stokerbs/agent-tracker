/** Google Ads offline-conversion export: admin gate, days clamp, CSV headers, error path, audit without gclids. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireRole: vi.fn(),
  logAudit: vi.fn(),
  reportError: vi.fn(),
  result: { data: [] as unknown[] | null, error: null as unknown },
  gte: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/errors", () => ({ reportError: h.reportError }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        not: () => ({
          gte: (col: string, since: string) => {
            h.gte(col, since);
            return { order: () => ({ limit: async () => h.result }) };
          },
        }),
      }),
    }),
  }),
}));

import { GET } from "./route";

const LEAD = { gclid: "Cj0KCQjw_abc-123_DEF", created_at: "2026-09-01T03:00:00Z", stage_changed_at: "2026-09-02T05:00:00Z", converted_at: null, lead_quality: "qualified", final_revenue: null, quoted_value: null };
const req = (q = "") => new Request(`https://detectivepulse.app/marketing-insights/offline-conversions${q}`);
const daysSince = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);

beforeEach(() => {
  vi.clearAllMocks();
  h.requireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
  h.result = { data: [LEAD], error: null };
});

describe("GET /marketing-insights/offline-conversions", () => {
  it("requires an admin (requireRole redirects/throws) before querying", async () => {
    h.requireRole.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(GET(req())).rejects.toThrow();
    expect(h.gte).not.toHaveBeenCalled();
  });

  it("clamps ?days to 1..365 and defaults to 90", async () => {
    await GET(req()); expect(daysSince(h.gte.mock.calls[0]![1])).toBe(90);
    await GET(req("?days=0")); expect(daysSince(h.gte.mock.calls[1]![1])).toBe(1);
    await GET(req("?days=9999")); expect(daysSince(h.gte.mock.calls[2]![1])).toBe(365);
    await GET(req("?days=abc")); expect(daysSince(h.gte.mock.calls[3]![1])).toBe(90);
  });

  it("returns a CSV download in Google's format and audits counts only", async () => {
    const res = await GET(req("?days=30"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="google-ads-offline-conversions-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const lines = (await res.text()).split("\r\n");
    expect(lines[0]).toBe("Parameters:TimeZone=Asia/Bangkok");
    expect(lines[2]).toBe(`${LEAD.gclid},Qualified lead,2026-09-02 12:00:00+07:00,,THB`);
    const audit = h.logAudit.mock.calls[0]![0];
    expect(audit).toMatchObject({ action: "ADS_OFFLINE_CONVERSIONS_EXPORT", metadata: { days: 30, leads: 1, conversions: 1 } });
    expect(JSON.stringify(audit)).not.toContain(LEAD.gclid);
  });

  it("500 + reportError when the query fails; nothing audited", async () => {
    h.result = { data: null, error: { message: "boom" } };
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "query_failed" });
    expect(h.reportError).toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
  });
});
