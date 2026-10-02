import { describe, expect, it } from "vitest";
import { FACTS, officeAnswer } from "./facts";
import { FAQ_TH, FAQ_EN, FAQ_ZH } from "./faq";
import { ZH_COMPANY } from "./zh/company";

describe("business facts registry", () => {
  it("carries the pre-audit figures and keeps unconfirmed facts empty", () => {
    expect(FACTS.confirmed.closedCases).toBe(1953);
    expect(FACTS.confirmed.provinces).toBe(77);
    expect(FACTS.confirmed.reviews).toMatchObject({ rating: "4.8", count: 63, source: "Fastwork" });
    expect(FACTS.pending.awards).toHaveLength(0);
  });

  it("the Chinese company facts read from the same registry (one business, one set of numbers)", () => {
    expect(ZH_COMPANY.closedCases).toBe(FACTS.confirmed.closedCases);
    expect(ZH_COMPANY.provinces).toBe(FACTS.confirmed.provinces);
    expect(ZH_COMPANY.reviews.count).toBe(FACTS.confirmed.reviews.count);
    expect(ZH_COMPANY.since).toBe(FACTS.confirmed.foundingYear);
  });

  it("the office FAQ never calls the firm a freelancer without an office (trust rule) and is wired into every FAQ", () => {
    for (const lang of ["th", "en", "zh"] as const) {
      const a = officeAnswer(lang);
      expect(a).not.toMatch(/freelance|ฟรีแลนซ์|自由职业|ไม่มีที่ตั้งสำนักงาน|no fixed office|没有固定办公室/);
    }
    expect(FAQ_TH.find((f) => f.q.includes("สำนักงาน"))?.a).toBe(officeAnswer("th"));
    expect(FAQ_EN.find((f) => f.q.includes("office"))?.a).toBe(officeAnswer("en"));
    expect(FAQ_ZH.find((f) => f.q.includes("办公室"))?.a).toBe(officeAnswer("zh"));
  });
});
