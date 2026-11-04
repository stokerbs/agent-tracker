import { describe, expect, it } from "vitest";
import { getServicePage, servicePathForKey } from "./index";
import { TH_NAV, EN_NAV } from "@/lib/marketing/nav";
import { EN_TO_TH, TH_TO_EN } from "@/lib/marketing/i18n";

/**
 * Mystery Shopper (B2B service-quality audit) — the generic registry
 * invariants live in index.test.ts; this pins the pieces that make the page
 * reachable and correctly localised, because each of them is a separate file
 * that is easy to forget: nav/footer links, the TH↔EN slug map (language
 * switcher + hreflang), the lead-form inquiry category and the required
 * structure (four audit categories, five-step process, deliverables).
 */
const TH_SLUG = "ลูกค้าปริศนา";
const EN_SLUG = "mystery-shopper";

describe("mystery shopper service page", () => {
  const th = getServicePage("th", TH_SLUG);
  const en = getServicePage("en", EN_SLUG);

  it("exists in both languages as a service page with a shared service key", () => {
    expect(th).toBeDefined();
    expect(en).toBeDefined();
    expect(th!.kind).toBe("service");
    expect(en!.kind).toBe("service");
    expect(th!.service).toBe("mystery_shopper");
    expect(en!.service).toBe("mystery_shopper");
    expect(servicePathForKey("th", "mystery_shopper")).toBe(`/${TH_SLUG}`);
    expect(servicePathForKey("en", "mystery_shopper")).toBe(`/en/${EN_SLUG}`);
  });

  it("has reciprocal TH↔EN counterparts and slug-map entries (hreflang + language switcher)", () => {
    expect(th!.counterpart?.en).toBe(EN_SLUG);
    expect(en!.counterpart?.th).toBe(TH_SLUG);
    expect(EN_TO_TH[EN_SLUG]).toBe(TH_SLUG);
    expect(TH_TO_EN[TH_SLUG]).toBe(EN_SLUG);
  });

  it("is linked from the services navigation in both languages (header dropdown + footer)", () => {
    expect(TH_NAV.services.map((l) => l.href)).toContain(`/${TH_SLUG}`);
    expect(EN_NAV.services.map((l) => l.href)).toContain(`/en/${EN_SLUG}`);
  });

  it("preselects a lead-form inquiry category", () => {
    expect(th!.caseType).toBe("ลูกค้าปริศนา (Mystery Shopper)");
    expect(en!.caseType).toBe("Mystery shopper");
  });

  it("covers the four audit categories, five process steps, deliverables and six FAQs", () => {
    for (const p of [th!, en!]) {
      expect(p.process).toHaveLength(5);
      expect(p.faq).toHaveLength(6);
      expect(p.deliverables!.length).toBeGreaterThanOrEqual(8);
      expect(p.sections.length).toBeGreaterThanOrEqual(8);
    }
    const thHeadings = th!.sections.map((s) => s.heading);
    expect(thHeadings).toEqual(expect.arrayContaining([
      "ตรวจสอบคุณภาพการบริการ", "ตรวจสอบกระบวนการขาย", "ตรวจสอบมาตรฐานการปฏิบัติงาน", "ตรวจสอบความซื่อสัตย์ของพนักงาน",
    ]));
    const enHeadings = en!.sections.map((s) => s.heading);
    expect(enHeadings).toEqual(expect.arrayContaining([
      "Service quality audit", "Sales performance audit", "Operational compliance audit", "Employee integrity assessment",
    ]));
  });

  it("states the lawful boundaries of an audit (no entrapment, no unauthorised assessment)", () => {
    for (const p of [th!, en!]) {
      expect(p.notOffered!.length).toBeGreaterThanOrEqual(4);
    }
    expect(en!.notOffered!.join(" ")).toMatch(/entrapment/i);
    expect(th!.notOffered!.join(" ")).toContain("ล่อให้พนักงานทำผิด");
  });

  it("quotes no fixed price and keeps pricing scope-based", () => {
    for (const p of [th!, en!]) {
      const prose = [p.intro, p.description, ...p.sections.flatMap((s) => s.body), ...p.faq.map((f) => f.a)].join("\n");
      expect(prose).not.toMatch(/(฿|THB|baht)\s?\d|\d[\d,]{2,}\s?(฿|THB|baht|บาท)/i);
    }
  });
});
