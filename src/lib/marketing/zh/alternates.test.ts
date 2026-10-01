import { describe, it, expect } from "vitest";
import { zhAlternates } from "./alternates";

describe("zhAlternates", () => {
  it("emits zh-CN, th, en and x-default → en when an English page exists", () => {
    expect(zhAlternates({ zh: "/zh/background-check", en: "/en/background-check", th: "/เช็คประวัติบุคคล/" })).toEqual({
      canonical: "/zh/background-check",
      languages: { "zh-CN": "/zh/background-check", th: "/เช็คประวัติบุคคล/", en: "/en/background-check", "x-default": "/en/background-check" },
    });
  });

  it("falls back x-default to the Chinese page when no counterpart exists", () => {
    expect(zhAlternates({ zh: "/zh/on-site-verification" })).toEqual({
      canonical: "/zh/on-site-verification",
      languages: { "zh-CN": "/zh/on-site-verification", "x-default": "/zh/on-site-verification" },
    });
  });
});
