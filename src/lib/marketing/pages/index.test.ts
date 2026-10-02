import { describe, expect, it } from "vitest";
import { SERVICE_PAGES, getServicePage, registryOnlySlugs } from "./index";
import { getMarketingPages, getMarketingPagesEN } from "@/lib/marketing/content";
import { ZH_PAGES } from "@/lib/marketing/zh/registry";
import { FACTS } from "@/lib/marketing/facts";

const BANNED = /เครดิตบูโร|รายการเดินบัญชี|ทะเบียนราษฎร|ประกันสังคม|เข้า-?ออกประเทศ|ประวัติการโทร|credit bureau|bank statement|call (logs|history|records)|immigration record|phone records|licensed|guarantee(d)? result|#1|อันดับ 1|รับประกันผล/i;
const TH_CASE = ["สืบชู้สาว", "สืบทรัพย์สิน", "เช็คประวัติบุคคล", "ตามหาคน", "นักสืบไอที / ออนไลน์", "อื่น ๆ"];
const EN_CASE = ["Cheating spouse", "Asset search", "Background check", "Find a person", "Cyber / online", "Other"];

describe("service-page registry (TH/EN)", () => {
  const thSlugs = new Set([...getMarketingPages().map((p) => p.slug), ...SERVICE_PAGES.th.map((p) => p.slug)]);
  const enSlugs = new Set([...getMarketingPagesEN().map((p) => p.slug), ...SERVICE_PAGES.en.map((p) => p.slug)]);
  const zhSlugs = new Set(ZH_PAGES.map((p) => p.slug));

  it("slugs are unique, decoded and single-segment", () => {
    for (const lang of ["th", "en"] as const) {
      const slugs = SERVICE_PAGES[lang].map((p) => p.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const s of slugs) expect(s).not.toMatch(/[/%?#\s]/);
    }
  });

  it("metadata fits: title ≤ 60 chars without brand, description ≤ 155, h1 ≠ title, ≥3 FAQ", () => {
    for (const p of [...SERVICE_PAGES.th, ...SERVICE_PAGES.en]) {
      expect(p.title.length, `${p.lang}/${p.slug} title`).toBeLessThanOrEqual(60);
      expect(p.title.includes("Detective Pulse"), `${p.lang}/${p.slug} brand in title`).toBe(false);
      expect(p.description.length, `${p.lang}/${p.slug} description`).toBeLessThanOrEqual(155);
      expect(p.h1).not.toBe(p.title);
      expect(p.faq.length, `${p.lang}/${p.slug} faq`).toBeGreaterThanOrEqual(3);
      expect(p.sections.length, `${p.lang}/${p.slug} sections`).toBeGreaterThanOrEqual(2);
    }
  });

  it("service and location pages state what they never do, and no page implies restricted-data access", () => {
    for (const p of [...SERVICE_PAGES.th, ...SERVICE_PAGES.en]) {
      if (p.kind !== "info") expect(p.notOffered?.length ?? 0, `${p.lang}/${p.slug} notOffered`).toBeGreaterThanOrEqual(3);
      const prose = [p.title, p.description, p.h1, p.intro, ...p.sections.flatMap((s) => [s.heading, ...s.body, ...(s.bullets ?? [])]), ...(p.deliverables ?? []), ...p.faq.flatMap((f) => [f.q, f.a])].join("\n");
      // notOffered intentionally names the forbidden data; everything else must not.
      expect(prose.match(BANNED)?.[0] ?? null, `${p.lang}/${p.slug}`).toBeNull();
      // Durations are claims: any "N–M วัน/days" must be an owner-confirmed range (facts-to-confirm C11).
      const allowed = new Set<string>([FACTS.confirmed.surveillanceDays, FACTS.confirmed.bangkokStartDays]);
      for (const m of prose.matchAll(/(\d+\s*[–-]\s*\d+)\s*(?:วันทำการ|วัน|working days|days)/g)) {
        expect(allowed.has(m[1]!.replace(/\s/g, "")), `${p.lang}/${p.slug}: unconfirmed duration "${m[0]}"`).toBe(true);
      }
    }
  });

  it("related slugs, counterparts and caseType resolve", () => {
    for (const p of SERVICE_PAGES.th) {
      for (const r of p.related) expect(thSlugs.has(r), `th/${p.slug} related ${r}`).toBe(true);
      if (p.counterpart?.en) expect(enSlugs.has(p.counterpart.en), `th/${p.slug} en ${p.counterpart.en}`).toBe(true);
      if (p.counterpart?.zh) {
        expect(zhSlugs.has(p.counterpart.zh), `th/${p.slug} zh ${p.counterpart.zh}`).toBe(true);
        // hreflang must be reciprocal or Google drops the pair.
        expect(ZH_PAGES.find((z) => z.slug === p.counterpart!.zh)?.th, `zh/${p.counterpart.zh} must back-link th/${p.slug}`).toBe(p.slug);
      }
      if (p.caseType) expect(TH_CASE).toContain(p.caseType);
    }
    for (const p of SERVICE_PAGES.en) {
      for (const r of p.related) expect(enSlugs.has(r), `en/${p.slug} related ${r}`).toBe(true);
      if (p.counterpart?.th) expect(thSlugs.has(p.counterpart.th), `en/${p.slug} th ${p.counterpart.th}`).toBe(true);
      if (p.counterpart?.zh) {
        expect(zhSlugs.has(p.counterpart.zh), `en/${p.slug} zh ${p.counterpart.zh}`).toBe(true);
        expect(ZH_PAGES.find((z) => z.slug === p.counterpart!.zh)?.en, `zh/${p.counterpart.zh} must back-link en/${p.slug}`).toBe(p.slug);
      }
      if (p.caseType) expect(EN_CASE).toContain(p.caseType);
    }
  });

  it("looks up by decoded or encoded slug and lists registry-only slugs", () => {
    expect(getServicePage("th", encodeURIComponent("นักสืบชู้สาว"))?.slug).toBe("นักสืบชู้สาว");
    expect(getServicePage("en", "cheating-spouse-investigator")?.service).toBe("infidelity");
    const md = new Set(getMarketingPages().map((p) => p.slug));
    for (const s of registryOnlySlugs("th", md)) expect(md.has(s)).toBe(false);
  });
});
