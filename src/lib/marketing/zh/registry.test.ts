import { describe, it, expect } from "vitest";
import { ZH_PAGES, ZH_NAV, ZH_SLUG_LINKS, getZhPage } from "./registry";
import { EN_TO_TH } from "@/lib/marketing/i18n";

/** Phrases that would claim unlawful access — must never appear in copy. */
const BANNED = ["开房记录", "通话记录", "手机定位", "银行流水", "查身份证", "监听", "黑客", "出入境记录查询", "数据库查询"];

const REQUIRED_SLUGS = [
  "private-investigator-thailand", "bangkok-investigation", "relationship-investigation", "background-check",
  "find-person-thailand", "business-due-diligence", "on-site-verification", "asset-investigation",
  "how-it-works", "pricing", "case-studies", "about", "contact",
  "bangkok", "pattaya", "phuket", "chiang-mai", "chonburi", "samui",
];

/** All marketing copy EXCEPT the explicit "we don't do" refusals. */
function allText(p: (typeof ZH_PAGES)[number]): string {
  const { notOffered: _refusals, ...rest } = p;
  return JSON.stringify(rest);
}

describe("Chinese page registry", () => {
  it("contains every page from the brief with unique slugs", () => {
    const slugs = ZH_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of REQUIRED_SLUGS) expect(getZhPage(s), s).toBeDefined();
  });

  it("every page has SEO metadata within limits and one H1", () => {
    for (const p of ZH_PAGES) {
      expect(p.title.length, p.slug).toBeGreaterThan(4);
      expect(p.title.length, p.slug).toBeLessThanOrEqual(40);
      expect(p.description.length, p.slug).toBeGreaterThanOrEqual(30);
      expect(p.description.length, p.slug).toBeLessThanOrEqual(130);
      expect(p.h1.length, p.slug).toBeGreaterThan(1);
      expect(p.intro.length, p.slug).toBeGreaterThan(20);
    }
  });

  it("never promises unlawful data access", () => {
    for (const p of ZH_PAGES) {
      const text = allText(p);
      for (const phrase of BANNED) {
        // Phrases may appear only inside the "we don't do" refusals (excluded
        // above); everywhere else the copy must avoid them entirely.
        expect(text.includes(phrase), `${p.slug} contains "${phrase}"`).toBe(false);
      }
    }
  });

  it("service pages state deliverables and lawful-scope boundaries", () => {
    for (const p of ZH_PAGES.filter((x) => x.kind === "service")) {
      expect(p.deliverables?.length ?? 0, p.slug).toBeGreaterThan(0);
      expect(p.notOffered?.length ?? 0, p.slug).toBeGreaterThan(0);
      expect(p.faq.length, p.slug).toBeGreaterThanOrEqual(2);
    }
  });

  it("location pages carry unique local content (no templated duplicates)", () => {
    const locs = ZH_PAGES.filter((p) => p.kind === "location");
    const bodies = locs.map((p) => p.sections.map((s) => s.body.join(" ")).join(" "));
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        expect(bodies[i]).not.toBe(bodies[j]);
      }
      expect(bodies[i].length, locs[i].slug).toBeGreaterThan(80);
    }
  });

  it("related links and nav point at existing pages", () => {
    for (const p of ZH_PAGES) for (const r of p.related) expect(getZhPage(r), `${p.slug} → ${r}`).toBeDefined();
    for (const n of [...ZH_NAV.services, ...ZH_NAV.primary, ...ZH_NAV.locations]) expect(getZhPage(n.slug), n.slug).toBeDefined();
  });

  it("client-side slug links mirror the registry's EN/TH counterparts", () => {
    const expected = ZH_PAGES.filter((p) => p.en || p.th).map((p) => ({ slug: p.slug, en: p.en, th: p.th }));
    expect(ZH_SLUG_LINKS.map((l) => ({ slug: l.slug, en: l.en, th: l.th })).sort((a, b) => a.slug.localeCompare(b.slug)))
      .toEqual(expected.sort((a, b) => a.slug.localeCompare(b.slug)));
    // Every EN counterpart must be a real English page with a Thai twin.
    for (const l of ZH_SLUG_LINKS) if (l.en) expect(EN_TO_TH[l.en], l.en).toBe(l.th);
  });

  it("case-studies is noindexed while empty; nothing else is", () => {
    expect(getZhPage("case-studies")?.noindex).toBe(true);
    expect(ZH_PAGES.filter((p) => p.noindex).map((p) => p.slug)).toEqual(["case-studies"]);
  });
});
