import { describe, expect, it } from "vitest";
import { SAMPLE_REPORT } from "./sample-report-data";
import { FACTS } from "./facts";
import { metadata as thMeta } from "@/app/(marketing)/sample-report/page";
import { metadata as enMeta } from "@/app/(marketing)/en/sample-report/page";

// Anything that could read as a real identifier: full dates, plates, phone-like numbers, real-looking names.
const REAL_LOOKING = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b20\d\d-\d\d-\d\d\b|\b\d{9,}\b|[ก-๙]{2}\s?\d{3,4}\b|\b[1-9][ก-๙]{2}\s?\d{3,4}\b/;
const BANNED = /licensed|guarantee|รับประกันผล|เครดิตบูโร|รายการเดินบัญชี|ประวัติการโทร|call (logs|records)|bank statement/i;

describe("sample report (C10)", () => {
  it("is a template in both languages: watermark + notice present, only redaction marks, nothing real-looking", () => {
    for (const lang of ["th", "en"] as const) {
      const r = SAMPLE_REPORT[lang];
      expect(r.watermark).toMatch(/SAMPLE|ตัวอย่าง/);
      expect(r.notice.length).toBeGreaterThan(40);
      const text = JSON.stringify(r);
      expect(text).toContain("█");
      expect(text.match(REAL_LOOKING)?.[0] ?? null, lang).toBeNull();
      expect(text.match(BANNED)?.[0] ?? null, lang).toBeNull();
      // Every entry time is partially redacted and every entry has a public-place location.
      for (const d of r.days) for (const e of d.entries) {
        expect(e.time).toMatch(/^\d\d:\d█$/);
        expect(e.location.length).toBeGreaterThan(0);
        expect(e.photos).toBeGreaterThanOrEqual(1);
      }
      expect(r.endLine).toMatch(/End of Report/);
    }
  });

  it("pages are noindex, follow, and are what the facts registry links to", () => {
    for (const m of [thMeta, enMeta]) expect(m.robots).toEqual({ index: false, follow: true });
    expect(thMeta.alternates?.canonical).toBe(FACTS.pending.sampleReportUrl.th);
    expect(enMeta.alternates?.canonical).toBe(FACTS.pending.sampleReportUrl.en);
    expect(FACTS.pending.sampleReportUrl.zh).toBe(FACTS.pending.sampleReportUrl.en);
  });
});
