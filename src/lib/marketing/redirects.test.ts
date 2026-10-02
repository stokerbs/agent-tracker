import { describe, expect, it } from "vitest";
import { CONSOLIDATION_REDIRECTS, consolidationRedirects, consolidationRedirectsEnabled, isConsolidatedSource } from "./redirects";
import { SERVICE_PAGES } from "./pages";
import { EN_TO_TH } from "./i18n";
import { TH_NAV, EN_NAV } from "./nav";

describe("consolidation redirects (Appendix C.3)", () => {
  it("are off by default and on only with MARKETING_CONSOLIDATION_REDIRECTS=1", () => {
    expect(consolidationRedirectsEnabled({})).toBe(false);
    expect(consolidationRedirectsEnabled({ MARKETING_CONSOLIDATION_REDIRECTS: "true" })).toBe(false);
    expect(consolidationRedirectsEnabled({ MARKETING_CONSOLIDATION_REDIRECTS: "1" })).toBe(true);
    expect(consolidationRedirects({})).toEqual([]);
    expect(consolidationRedirects({ MARKETING_CONSOLIDATION_REDIRECTS: "1" }).length).toBe(CONSOLIDATION_REDIRECTS.length);
  });

  it("sources are unique, decoded, slash-prefixed, no trailing slash, and never also a destination (no chains)", () => {
    const froms = CONSOLIDATION_REDIRECTS.map((r) => r.from);
    const tos = new Set(CONSOLIDATION_REDIRECTS.map((r) => r.to));
    expect(new Set(froms).size).toBe(froms.length);
    for (const r of CONSOLIDATION_REDIRECTS) {
      expect(r.from.startsWith("/")).toBe(true);
      expect(r.to.startsWith("/")).toBe(true);
      expect(r.from.endsWith("/")).toBe(false);
      expect(r.to === "/" || !r.to.endsWith("/")).toBe(true);
      expect(r.from).toBe(decodeURI(r.from));
      expect(tos.has(r.from), `${r.from} is both source and destination`).toBe(false);
      expect(r.from).not.toBe(r.to);
    }
  });

  it("every destination is a live registry page or a site root", () => {
    const live = new Set([
      "/", "/en",
      ...SERVICE_PAGES.th.map((p) => `/${p.slug}`),
      ...SERVICE_PAGES.en.map((p) => `/en/${p.slug}`),
    ]);
    for (const r of CONSOLIDATION_REDIRECTS) expect(live.has(r.to), r.to).toBe(true);
  });

  it("every Thai source is a known WordPress-era slug (EN_TO_TH value) and every EN source a known EN slug", () => {
    const thKnown = new Set(Object.values(EN_TO_TH));
    const enKnown = new Set(Object.keys(EN_TO_TH));
    for (const r of CONSOLIDATION_REDIRECTS) {
      if (r.from.startsWith("/en/")) expect(enKnown.has(r.from.slice(4)), r.from).toBe(true);
      else expect(thKnown.has(r.from.slice(1)), r.from).toBe(true);
    }
  });

  it("the live site never links into a redirect source (nav, registry related, counterparts)", () => {
    for (const l of [...TH_NAV.services, ...TH_NAV.primary, ...TH_NAV.footer, ...EN_NAV.services, ...EN_NAV.primary, ...EN_NAV.footer]) {
      expect(isConsolidatedSource(l.href), l.href).toBe(false);
    }
    for (const p of SERVICE_PAGES.th) for (const s of p.related) expect(isConsolidatedSource(`/${s}`), `th/${p.slug} → ${s}`).toBe(false);
    for (const p of SERVICE_PAGES.en) for (const s of p.related) expect(isConsolidatedSource(`/en/${s}`), `en/${p.slug} → ${s}`).toBe(false);
  });

  it("emits percent-encoded sources for Next's matcher", () => {
    const rules = consolidationRedirects({ MARKETING_CONSOLIDATION_REDIRECTS: "1" });
    const th = rules.find((r) => r.destination === encodeURI("/นักสืบชู้สาว"));
    expect(th?.source).toBe(encodeURI("/นักสืบคดีชู้สาว-รับสืบค"));
    expect(th?.source).toMatch(/^\/%E0/);
    expect(rules.every((r) => r.permanent)).toBe(true);
    expect(isConsolidatedSource("/en/private-investigator/")).toBe(true);
    expect(isConsolidatedSource("/en/pricing")).toBe(false);
  });
});
