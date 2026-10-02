// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@next/third-parties/google", () => ({ sendGTMEvent: vi.fn() }));

import { langForPath, currentPage } from "./analytics";

describe("langForPath", () => {
  it("maps marketing paths to their language", () => {
    expect(langForPath("/")).toBe("th");
    expect(langForPath("/นักสืบชู้สาว")).toBe("th");
    expect(langForPath("/en")).toBe("en");
    expect(langForPath("/en/contact")).toBe("en");
    expect(langForPath("/zh")).toBe("zh");
    expect(langForPath("/zh/pricing")).toBe("zh");
  });
  it("does not treat look-alike prefixes as a language", () => {
    expect(langForPath("/english")).toBe("th");
    expect(langForPath("/zhou")).toBe("th");
  });
});

describe("currentPage", () => {
  it("is SSR-safe (empty string without a window)", () => {
    expect(currentPage()).toBe("");
  });
});
