import { describe, expect, it } from "vitest";
import { documentLanguage, marketingLanguageForPath } from "./document-language";

describe("marketing document language", () => {
  it.each([
    ["/", "th"], ["/articles", "th"], ["/นักสืบชู้สาว", "th"],
    ["/en", "en"], ["/en/", "en"], ["/en/articles/a-guide", "en"],
    ["/zh", "zh-CN"], ["/zh/", "zh-CN"], ["/zh/contact", "zh-CN"],
    ["/lp/en", "en"], ["/lp/en/infidelity", "en"], ["/lp/sued-choo-sao", "th"],
    ["/enough", "th"], ["/zh-other", "th"], ["/lp/english", "th"],
  ])("%s declares %s", (path, lang) => {
    expect(marketingLanguageForPath(path)).toBe(lang);
  });

  it.each(["th", "en"])("uses URL language on .com regardless of the %s app cookie", (locale) => {
    for (const lang of ["th", "en", "zh-CN"]) {
      expect(documentLanguage("detectivepulse.com", lang, locale)).toBe(lang);
      expect(documentLanguage("www.detectivepulse.com", lang, locale)).toBe(lang);
    }
  });

  it.each([null, "", "invalid"])("defaults .com to Thai for an unset/invalid header (%s)", (header) => {
    expect(documentLanguage("detectivepulse.com", header, "en")).toBe("th");
  });

  it.each(["detectivepulse.app", "localhost:3000", "preview.vercel.app", "detectivepulse.com.evil.test", null])(
    "preserves the app locale on %s even with a supplied language header", (host) => {
      expect(documentLanguage(host, "zh-CN", "en")).toBe("en");
      expect(documentLanguage(host, "en", "th")).toBe("th");
    },
  );
});
