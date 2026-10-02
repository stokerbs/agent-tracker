import { describe, expect, it } from "vitest";
import { CASE_STUDIES, CASE_STUDY_INDEX_MIN, caseStudiesFor, caseStudiesIndexable, type CaseStudy } from "./case-studies";
import { ZH_CASE_STUDIES } from "./zh/case-studies";

// Things that must never appear in a published anonymised case.
const PII = /\+?\d[\d\s-]{8,}\d|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}\b|ทะเบียน\s?\d|[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4}/;

describe("case-study registry", () => {
  it("indexes only from the third real case", () => {
    expect(CASE_STUDY_INDEX_MIN).toBe(3);
    expect(caseStudiesIndexable(0)).toBe(false);
    expect(caseStudiesIndexable(2)).toBe(false);
    expect(caseStudiesIndexable(3)).toBe(true);
    expect(caseStudiesIndexable()).toBe(CASE_STUDIES.length >= 3);
  });

  it("the Chinese view is derived from the same registry (one source of truth)", () => {
    expect(ZH_CASE_STUDIES.length).toBe(CASE_STUDIES.length);
    expect(ZH_CASE_STUDIES.map((c) => c.id)).toEqual(CASE_STUDIES.map((c) => c.id));
  });

  it("every published case is consented, trilingual, anonymised and tactic-free", () => {
    const ids = CASE_STUDIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CASE_STUDIES) {
      expect(c.consentConfirmed).toBe(true);
      expect(c.id).toMatch(/^cs-\d{4}-\d{2}$/);
      for (const lang of ["th", "en", "zh"] as const) {
        const v = caseStudiesFor(lang, [c])[0]!;
        for (const [k, text] of Object.entries(v)) {
          if (k === "id" || k === "service") continue;
          expect(String(text).trim().length, `${c.id}.${k}.${lang}`).toBeGreaterThan(0);
          expect(PII.test(String(text)), `${c.id}.${k}.${lang} looks like PII`).toBe(false);
        }
      }
    }
  });

  it("projection keeps field order and language", () => {
    const sample: CaseStudy = {
      id: "cs-2026-99", service: "background", consentConfirmed: true,
      location: { th: "กรุงเทพฯ", en: "Bangkok", zh: "曼谷" }, timeline: { th: "5 วัน", en: "5 days", zh: "5 天" },
      title: { th: "ก", en: "a", zh: "甲" }, situation: { th: "ข", en: "b", zh: "乙" }, objective: { th: "ค", en: "c", zh: "丙" },
      challenges: { th: "ง", en: "d", zh: "丁" }, approach: { th: "จ", en: "e", zh: "戊" }, deliverables: { th: "ฉ", en: "f", zh: "己" },
      outcome: { th: "ช", en: "g", zh: "庚" }, lessons: { th: "ซ", en: "h", zh: "辛" },
    };
    expect(caseStudiesFor("en", [sample])[0]).toMatchObject({ id: "cs-2026-99", location: "Bangkok", title: "a", lessons: "h" });
    expect(caseStudiesFor("zh", [sample])[0]!.timeline).toBe("5 天");
  });
});
