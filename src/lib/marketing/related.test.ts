import { describe, expect, it } from "vitest";
import { getRelatedPages } from "./related";
import type { MarketingPage } from "./content";

const mk = (slug: string, title: string): MarketingPage => ({ id: slug, slug, path: `/${slug}/`, href: `/${slug}`, title, seoTitle: title, description: "", body: "" });
const pages = [
  mk("นักสืบชู้สาว", "นักสืบชู้สาว"),
  mk("จ้างนักสืบตามแฟน", "จ้างนักสืบตามแฟน"),
  mk("สืบทรัพย์สิน", "สืบทรัพย์สิน"),
  mk("เช็คประวัติบุคคล", "เช็คประวัติบุคคล"),
  mk("สืบตามหาคน", "สืบตามหาคน"),
  mk("นักสืบไอที", "นักสืบไอที"),
];

describe("getRelatedPages", () => {
  it("never includes the current page and returns at most n", () => {
    const r = getRelatedPages(pages, pages[0]!, 3);
    expect(r).toHaveLength(3);
    expect(r.map((p) => p.slug)).not.toContain("นักสืบชู้สาว");
  });
  it("puts same-category pages first", () => {
    const r = getRelatedPages(pages, pages[0]!, 3);
    expect(r[0]!.slug).toBe("จ้างนักสืบตามแฟน"); // infidelity cluster
  });
  it("differs between pages (no fixed trio)", () => {
    const a = getRelatedPages(pages, pages[2]!, 3).map((p) => p.slug);
    const b = getRelatedPages(pages, pages[5]!, 3).map((p) => p.slug);
    expect(a).not.toEqual(b);
  });
});
