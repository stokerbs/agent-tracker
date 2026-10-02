import { describe, expect, it } from "vitest";
import { costPerLead, parseAdSpendCsv, splitCsvLine } from "./ad-spend";

describe("ad spend CSV", () => {
  it("splits quoted CSV fields", () => {
    expect(splitCsvLine('2026-09-01,"TH | Infidelity, Bangkok","1,250.50",12')).toEqual(["2026-09-01", "TH | Infidelity, Bangkok", "1,250.50", "12"]);
  });

  it("parses a Google Ads export with title lines, Thai dates, currency symbols and a Total row", () => {
    const csv = [
      "Campaign report (Sep 1, 2026 - Sep 2, 2026)",
      "All time",
      "Day,Campaign,Cost,Clicks,Impr.,Conv.",
      '01/09/2026,"TH | สืบชู้สาว","฿1,250.50",30,"2,100",2',
      '02/09/2026,"EN | Partner verification","980.00",14,900,1.5',
      'Total: account,,"2,230.50",44,"3,000",3.5',
    ].join("\n");
    const { rows, errors } = parseAdSpendCsv(csv, { platform: "google_ads", locale: "th" });
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ spend_date: "2026-09-01", platform: "google_ads", locale: "th", cost: 1250.5, clicks: 30, impressions: 2100, conversions: 2 });
    // Locale guessed from the campaign name when the export has no locale column.
    expect(rows[1]).toMatchObject({ spend_date: "2026-09-02", locale: "en", cost: 980, conversions: 1.5 });
  });

  it("reports bad lines without dropping good ones, and rejects a header without date/cost", () => {
    const csv = "Date,Cost\n2026-09-01,100\nnot-a-date,50\n2026-09-03,abc";
    const r = parseAdSpendCsv(csv, { platform: "meta", locale: "all" });
    expect(r.rows).toHaveLength(1);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4]);
    expect(parseAdSpendCsv("Foo,Bar\n1,2", { platform: "meta", locale: "all" }).errors[0]!.message).toMatch(/ไม่พบคอลัมน์/);
    expect(parseAdSpendCsv("", { platform: "meta", locale: "all" }).rows).toEqual([]);
  });

  it("computes CPL / CPQL / ROAS per platform against paid-channel leads in the window and locale", () => {
    const spend = [
      { platform: "google_ads", locale: "th", cost: 1000, spend_date: "2026-09-01" },
      { platform: "google_ads", locale: "th", cost: 1000, spend_date: "2026-09-02" },
      { platform: "meta", locale: "all", cost: 500, spend_date: "2026-09-02" },
      { platform: "google_ads", locale: "th", cost: 9999, spend_date: "2026-08-01" }, // outside window
      { platform: "google_ads", locale: "th", cost: 1, spend_date: "2026-09-30" }, // last day of the window (day granularity)
    ];
    const leads = [
      { channel: "paid_search", locale: "th", created_at: "2026-09-01T10:00:00Z", lead_quality: "qualified", converted_at: "2026-09-05T00:00:00Z", final_revenue: 15000 },
      { channel: "paid_search", locale: "th", created_at: "2026-09-02T10:00:00Z", lead_quality: "spam" },
      { channel: "paid_search", locale: "en", created_at: "2026-09-02T10:00:00Z", lead_quality: "qualified" }, // other locale → not counted for th-tagged spend
      { channel: "paid_social", locale: "en", created_at: "2026-09-02T10:00:00Z", lead_quality: "unrated" },
      { channel: "organic_search", locale: "th", created_at: "2026-09-02T10:00:00Z", lead_quality: "qualified" },
    ];
    // `from` carries a time-of-day: the 1 Sep rows must still count (day granularity).
    const rows = costPerLead(spend, leads, { from: new Date("2026-09-01T15:30:00Z"), to: new Date("2026-09-30T03:00:00Z") });
    const g = rows.find((r) => r.platform === "google_ads")!;
    expect(g).toMatchObject({ cost: 2001, leads: 2, qualified: 1, paid: 1, revenue: 15000, cpl: 1000.5, cpql: 2001 });
    expect(g.roas).toBeCloseTo(15000 / 2001, 6);
    const m = rows.find((r) => r.platform === "meta")!;
    expect(m).toMatchObject({ cost: 500, leads: 1, qualified: 0, cpl: 500, cpql: null, roas: 0 });
    expect(rows.find((r) => r.platform === "line")).toBeUndefined();
  });
});
