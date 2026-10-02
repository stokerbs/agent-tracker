// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTACT, SAME_AS } from "./contact";

/** Every marketing content file (TH + EN). */
function contentFiles(): string[] {
  const root = join(process.cwd(), "src/content/marketing");
  const th = readdirSync(root).filter((f) => f.endsWith(".md")).map((f) => join(root, f));
  const en = readdirSync(join(root, "en")).filter((f) => f.endsWith(".md")).map((f) => join(root, "en", f));
  return [...th, ...en];
}

describe("canonical contact facts (NAP consistency guard)", () => {
  it("has one consistent phone number across its representations", () => {
    expect(CONTACT.phoneTel).toBe(`tel:${CONTACT.phoneE164}`);
    expect(CONTACT.whatsappUrl.endsWith(CONTACT.phoneE164)).toBe(true);
    expect(CONTACT.phoneDisplay.replace(/\s/g, "")).toBe(CONTACT.phoneE164.replace("+66", "0"));
    expect(CONTACT.mailto).toBe(`mailto:${CONTACT.email}`);
    expect(SAME_AS).toContain(CONTACT.facebookUrl);
  });

  it("content uses only the canonical LINE link (no legacy lin.ee / page.line.me variants)", () => {
    for (const f of contentFiles()) {
      const s = readFileSync(f, "utf8");
      const links = s.match(/https?:\/\/(?:lin\.ee|page\.line\.me|line\.me)\/[^\s)"]+/g) ?? [];
      for (const l of links) expect({ file: f, link: l }).toEqual({ file: f, link: CONTACT.lineUrl });
    }
  });

  it("content spells the brand 'Detective Pulse' (no 'Detectivepulse' / 'Sherlock' variants in prose)", () => {
    for (const f of contentFiles()) {
      const s = readFileSync(f, "utf8");
      // Handles/URLs (detectivepulse.com, detectivepluse) are identifiers and allowed.
      const prose = s.replace(/https?:\/\/\S+/g, "").replace(/detectivepluse/g, "");
      expect({ file: f, hit: prose.match(/Detectivepulse\b/)?.[0] ?? null }).toEqual({ file: f, hit: null });
      expect({ file: f, hit: prose.match(/Sherlock/)?.[0] ?? null }).toEqual({ file: f, hit: null });
    }
  });
});
