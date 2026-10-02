import { describe, expect, it } from "vitest";
import { FACTS, officeAnswer, responseTimeNote, paymentMethodsText, leadInvestigatorText, receiptNote } from "./facts";
import { FAQ_TH, FAQ_EN } from "./faq";
import { ZH_COMPANY } from "./zh/company";
import { ZH_PAGES } from "./zh/registry";
import { FAQ_ZH_HOME } from "./zh/home";
import { SERVICE_PAGES } from "@/lib/marketing/pages";

describe("business facts registry", () => {
  it("carries the pre-audit figures and keeps unconfirmed facts empty", () => {
    expect(FACTS.confirmed.closedCases).toBe(1953);
    expect(FACTS.confirmed.provinces).toBe(77);
    expect(FACTS.confirmed.reviews).toMatchObject({ rating: "4.8", count: 63, source: "Fastwork" });
    expect(FACTS.pending.awards).toHaveLength(0);
  });

  it("owner-confirmed facts of 2026-10-02 are present and localized in all three languages", () => {
    expect(FACTS.confirmed.teamSize).toBe(17);
    expect(FACTS.confirmed.surveillanceDays).toBe("3–7");
    expect(FACTS.confirmed.bangkokStartDays).toBe("1–2");
    for (const l of ["th", "en", "zh"] as const) {
      expect(FACTS.confirmed.priceFrom[l].length).toBeGreaterThan(0);
      expect(responseTimeNote(l)).toMatch(/1|08:00/);
      expect(paymentMethodsText(l)).toContain("PayPal");
      expect(leadInvestigatorText(l)).toContain("Tommy");
    }
    // B1: sole proprietor → no legal entity name is ever shown; A5 Fastwork URL still awaited.
    expect(FACTS.pending.legalForm).toBe("sole_proprietor");
    expect(FACTS.pending.legalName).toBeNull();
    expect(FACTS.confirmed.reviews.url).toBeNull();
    // B3 / B5 / C10 answered.
    for (const l of ["th", "en", "zh"] as const) {
      expect(officeAnswer(l)).toBe(FACTS.pending.officeNote[l]);
      expect(receiptNote(l)).toMatch(/PayPal/);
      expect(FACTS.pending.sampleReportUrl[l]).toMatch(/^\/(en\/)?sample-report$/);
    }
    expect(FACTS.pending.issuesTaxInvoice).toBe(false);
    expect(FACTS.pending.serviceLanguages).toEqual(["th", "en", "zh"]);
  });

  it("any URL in the registry is https (it is rendered straight into an href)", () => {
    const url = FACTS.confirmed.reviews.url as string | null;
    expect(url === null || /^https:\/\//.test(url)).toBe(true);
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
    // Registry about pages (TH/EN) must reuse the single office statement too.
    expect(SERVICE_PAGES.th.find((p) => p.slug === "เกี่ยวกับเรา")!.faq.find((f) => f.q.includes("สำนักงาน"))?.a).toBe(officeAnswer("th"));
    expect(SERVICE_PAGES.en.find((p) => p.slug === "about")!.faq.find((f) => /office/i.test(f.q))?.a).toBe(officeAnswer("en"));
    const about = ZH_PAGES.find((p) => p.slug === "about")!;
    expect(about.faq.find((f) => f.q.includes("办公室"))?.a).toBe(officeAnswer("zh"));
    for (const f of FAQ_ZH_HOME) expect(f.a).not.toMatch(/到访泰国办公室|实体办公室/);
  });
});
