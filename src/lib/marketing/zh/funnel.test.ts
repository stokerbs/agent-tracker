import { describe, it, expect } from "vitest";
import { computeFunnel, type FunnelLeadRow } from "./funnel";

const row = (o: Partial<FunnelLeadRow>): FunnelLeadRow => ({
  locale: "zh", source: "zh_intake", stage: "new", quoted_value: null, final_revenue: null, converted_at: null, service: null, utm_source: null, ...o,
});

describe("computeFunnel", () => {
  it("returns zeros and null rates for no leads", () => {
    const m = computeFunnel([]);
    expect(m).toMatchObject({ leads: 0, qualified: 0, quoted: 0, paid: 0, leadToQuote: null, quoteToPaid: null, revenue: 0, revenuePerLead: null, avgCaseValue: null });
    expect(m.bySource).toEqual([]);
  });

  it("counts funnel steps cumulatively and computes rates", () => {
    const rows = [
      row({ stage: "new" }),
      row({ stage: "qualified", service: "relationship" }),
      row({ stage: "quotation_sent", quoted_value: 45000, service: "relationship" }),
      row({ stage: "paid", quoted_value: 60000, final_revenue: "60000", converted_at: "2026-10-01T00:00:00Z", service: "due_diligence", utm_source: "partner-a" }),
      row({ stage: "closed", quoted_value: 90000, final_revenue: 100000, converted_at: "2026-09-01T00:00:00Z", service: "due_diligence" }),
    ];
    const m = computeFunnel(rows);
    expect(m.leads).toBe(5);
    expect(m.qualified).toBe(4);
    expect(m.quoted).toBe(3);
    expect(m.paid).toBe(2);
    expect(m.leadToQuote).toBeCloseTo(0.75);
    expect(m.quoteToPaid).toBeCloseTo(2 / 3);
    expect(m.revenue).toBe(160000);
    expect(m.quotedTotal).toBe(195000);
    expect(m.revenuePerLead).toBe(32000);
    expect(m.avgCaseValue).toBe(80000);
  });

  it("breaks down by source (with utm) and service, revenue-first", () => {
    const m = computeFunnel([
      row({ source: "zh_intake", final_revenue: 10, converted_at: "x" }),
      row({ source: "zh_intake", utm_source: "partner-a", final_revenue: 500, converted_at: "x", service: "on_site" }),
      row({ source: "wechat", service: "on_site" }),
    ]);
    expect(m.bySource.map((b) => b.key)).toEqual(["zh_intake / partner-a", "zh_intake", "wechat"]);
    expect(m.byService[0]).toEqual({ key: "on_site", leads: 2, paid: 1, revenue: 500 });
    expect(m.byService[1]).toEqual({ key: "unspecified", leads: 1, paid: 1, revenue: 10 });
  });

  it("keeps the funnel monotonic when a converted lead is moved back a stage", () => {
    const m = computeFunnel([row({ stage: "qualified", converted_at: "2026-09-01T00:00:00Z", final_revenue: 5000 })]);
    expect(m).toMatchObject({ leads: 1, qualified: 1, quoted: 1, paid: 1, quoteToPaid: 1 });
  });

  it("lists stages in pipeline order", () => {
    const m = computeFunnel([row({ stage: "closed" }), row({ stage: "new" }), row({ stage: "quotation_sent" })]);
    expect(m.byStage.map((s) => s.stage)).toEqual(["new", "quotation_sent", "closed"]);
  });

  it("treats unknown stages as new and ignores negative/invalid money", () => {
    const m = computeFunnel([row({ stage: "bogus", final_revenue: "-5" }), row({ stage: null, quoted_value: "abc" })]);
    expect(m.byStage).toEqual([{ stage: "new", count: 2 }]);
    expect(m.revenue).toBe(0);
    expect(m.quotedTotal).toBe(0);
  });
});
