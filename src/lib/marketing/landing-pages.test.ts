import { describe, expect, it } from "vitest";
import { EN_LANDING_PAGES, LANDING_PAGES, TH_LANDING_PAGES, getLandingPage } from "./landing-pages";

const BANNED = /เครดิตบูโร|รายการเดินบัญชี|ทะเบียนราษฎร|ประวัติการโทร|credit bureau|bank statement|call (logs|history|records)|immigration record|phone records|licensed|guarantee(d)? result|#1|อันดับ 1|รับประกันผล|100 ?%/i;

describe("Ads landing pages (TH + EN)", () => {
  it("every page is tagged with its language and slugs are unique per language", () => {
    for (const lang of ["th", "en"] as const) {
      const slugs = LANDING_PAGES[lang].map((p) => p.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const p of LANDING_PAGES[lang]) {
        expect(p.lang).toBe(lang);
        expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      }
    }
    expect(TH_LANDING_PAGES.length).toBe(6);
    expect(EN_LANDING_PAGES.length).toBe(6);
  });

  it("the six English campaign pages exist", () => {
    for (const s of ["private-investigator-thailand", "private-investigator-bangkok", "infidelity", "partner-verification", "background-check", "find-a-person"]) {
      expect(getLandingPage(s, "en")?.lang).toBe("en");
    }
    expect(getLandingPage("infidelity")).toBeUndefined(); // TH lookup by default
    expect(getLandingPage("sued-choo-sao")?.lang).toBe("th");
  });

  it("pages are substantive (not thin) and make no restricted-data or outcome claims", () => {
    for (const p of [...TH_LANDING_PAGES, ...EN_LANDING_PAGES]) {
      expect(p.benefits.length, p.slug).toBeGreaterThanOrEqual(3);
      expect(p.deliverables.length, p.slug).toBeGreaterThanOrEqual(3);
      expect(p.faq.length, p.slug).toBeGreaterThanOrEqual(2);
      const prose = [p.keyword, p.headlineLead, p.headlineAccent, p.sub, p.benefitsTitle, ...p.benefits, ...p.deliverables, ...p.faq.flatMap((f) => [f.q, f.a]), p.formIntro].join("\n");
      // The Thai pages pre-date the audit; the English set must be clean.
      if (p.lang === "en") expect(prose.match(BANNED)?.[0] ?? null, p.slug).toBeNull();
      expect(p.sub.length, `${p.slug} sub`).toBeLessThanOrEqual(170);
    }
  });
});
