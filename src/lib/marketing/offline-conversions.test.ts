import { describe, expect, it } from "vitest";
import { conversionsForLead, formatBangkok, offlineConversionsCsv } from "./offline-conversions";

const base = { gclid: "Cj0KCQjw_abc-123_DEF", created_at: "2026-09-01T03:00:00Z", stage_changed_at: null, converted_at: null, lead_quality: null, final_revenue: null, quoted_value: null };

describe("Google Ads offline conversions", () => {
  it("formats Bangkok time with the fixed +07:00 offset", () => {
    expect(formatBangkok("2026-09-01T03:04:05Z")).toBe("2026-09-01 10:04:05+07:00");
    expect(formatBangkok("2026-12-31T20:00:00Z")).toBe("2027-01-01 03:00:00+07:00");
  });

  it("emits nothing without a (valid) gclid or without a qualifying state", () => {
    expect(conversionsForLead({ ...base, gclid: null, lead_quality: "qualified" })).toEqual([]);
    expect(conversionsForLead({ ...base, gclid: "bad id", lead_quality: "qualified" })).toEqual([]);
    expect(conversionsForLead({ ...base, lead_quality: "unrated" })).toEqual([]);
    expect(conversionsForLead({ ...base, lead_quality: "spam" })).toEqual([]);
  });

  it("qualified → one row at the stage-change time; paid → qualified + paid with revenue", () => {
    const q = conversionsForLead({ ...base, lead_quality: "qualified", stage_changed_at: "2026-09-02T05:00:00Z" });
    expect(q).toEqual([{ gclid: base.gclid, name: "Qualified lead", time: "2026-09-02 12:00:00+07:00", value: 0, currency: "THB" }]);
    const p = conversionsForLead({ ...base, lead_quality: "unrated", converted_at: "2026-09-10T01:00:00Z", final_revenue: "25000.00" });
    expect(p.map((c) => c.name)).toEqual(["Qualified lead", "Paid case"]);
    expect(p[1]).toMatchObject({ value: 25000, time: "2026-09-10 08:00:00+07:00" });
    // Falls back to the quote when revenue is not yet recorded.
    expect(conversionsForLead({ ...base, converted_at: "2026-09-10T01:00:00Z", quoted_value: 18000 })[1]!.value).toBe(18000);
  });

  it("writes the CSV Google Ads expects, with the timezone parameter line and CRLF", () => {
    const csv = offlineConversionsCsv([{ ...base, lead_quality: "high_value" }, { ...base, gclid: "x" }]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Parameters:TimeZone=Asia/Bangkok");
    expect(lines[1]).toBe("Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency");
    expect(lines[2]).toBe(`${base.gclid},Qualified lead,2026-09-01 10:00:00+07:00,,THB`);
    expect(lines).toHaveLength(4); // trailing CRLF → empty last element
  });
});
