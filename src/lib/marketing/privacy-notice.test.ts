import { describe, expect, it } from "vitest";
import { PRIVACY_NOTICES, PRIVACY_PATH, PRIVACY_UPDATED, getPrivacyNotice } from "./privacy-notice";
import { CONTACT } from "./contact";

// Mirrors the registry test: the notice must never read as if we access
// protected data, and never promise outcomes.
const BANNED = /เครดิตบูโร|รายการเดินบัญชี|ทะเบียนราษฎร|credit bureau|bank statement|call (logs|history|records)|licensed|guarantee/i;

describe("marketing privacy notice", () => {
  const langs = ["th", "en", "zh"] as const;

  it("exists in all three languages with matching structure and paths", () => {
    const n = PRIVACY_NOTICES.en.sections.length;
    expect(n).toBeGreaterThanOrEqual(8);
    for (const l of langs) {
      const p = getPrivacyNotice(l);
      expect(p.lang).toBe(l);
      expect(p.path).toBe(PRIVACY_PATH[l]);
      expect(p.sections.length).toBe(n);
      expect(p.title.length).toBeLessThanOrEqual(70);
      expect(p.description.length).toBeLessThanOrEqual(160);
      for (const s of p.sections) {
        expect(s.heading.trim().length).toBeGreaterThan(0);
        expect(s.body.length + (s.bullets?.length ?? 0)).toBeGreaterThan(0);
      }
    }
    expect(PRIVACY_PATH).toEqual({ th: "/privacy", en: "/en/privacy", zh: "/zh/privacy" });
  });

  it("is dated and names the brand as controller", () => {
    expect(PRIVACY_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const l of langs) expect(getPrivacyNotice(l).intro).toContain(CONTACT.brand);
  });

  it("covers the website's actual processors and the PDPA rights, without restricted-data claims", () => {
    for (const l of langs) {
      const text = JSON.stringify(getPrivacyNotice(l));
      for (const vendor of ["Supabase", "Vercel", "Upstash", "Sentry", "Anthropic", "Google", "LINE"]) expect(text, `${l} ${vendor}`).toContain(vendor);
      expect(text).toMatch(/PDPA/);
      expect(text).toMatch(/utm/);
      expect(text.match(BANNED)?.[0] ?? null, l).toBeNull();
    }
  });
});
