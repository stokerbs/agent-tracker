import { describe, expect, it } from "vitest";
import { parseAttribution, shouldReplace, ATTRIBUTION_LIMITS, type Attribution } from "./attribution";

const now = new Date("2026-10-02T10:00:00Z");

describe("parseAttribution", () => {
  it("captures landing path, utm_* and click ids from the URL", () => {
    const a = parseAttribution(
      new URL("https://detectivepulse.com/นักสืบชู้สาว?utm_source=google&utm_medium=cpc&utm_campaign=th-infidelity&utm_term=สืบชู้&utm_content=ad1&gclid=abc123"),
      "https://www.google.com/",
      now,
    );
    expect(a.landing_page).toBe("/%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B8%AA%E0%B8%B7%E0%B8%9A%E0%B8%8A%E0%B8%B9%E0%B9%89%E0%B8%AA%E0%B8%B2%E0%B8%A7");
    expect(a.utm_source).toBe("google");
    expect(a.utm_medium).toBe("cpc");
    expect(a.utm_campaign).toBe("th-infidelity");
    expect(a.utm_term).toBe("สืบชู้");
    expect(a.utm_content).toBe("ad1");
    expect(a.gclid).toBe("abc123");
    expect(a.fbclid).toBe("");
    expect(a.referrer).toBe("https://www.google.com/");
    expect(a.first_seen).toBe(now.toISOString());
  });

  it("drops internal referrers (same host, with or without www)", () => {
    expect(parseAttribution(new URL("https://detectivepulse.com/en"), "https://www.detectivepulse.com/", now).referrer).toBe("");
    expect(parseAttribution(new URL("https://www.detectivepulse.com/en"), "https://detectivepulse.com/articles", now).referrer).toBe("");
  });

  it("keeps only origin + path of an external referrer (no query strings)", () => {
    const a = parseAttribution(new URL("https://detectivepulse.com/"), "https://www.facebook.com/groups/x?fbclid=zzz", now);
    expect(a.referrer).toBe("https://www.facebook.com/groups/x");
  });

  it("tolerates a malformed referrer", () => {
    expect(parseAttribution(new URL("https://detectivepulse.com/"), "not a url", now).referrer).toBe("");
  });

  it("bounds every field", () => {
    const long = "x".repeat(1000);
    const a = parseAttribution(new URL(`https://detectivepulse.com/${long}?utm_source=${long}&gclid=${long}`), "", now);
    expect(a.landing_page.length).toBe(ATTRIBUTION_LIMITS.landing_page);
    expect(a.utm_source.length).toBe(ATTRIBUTION_LIMITS.utm_source);
    expect(a.gclid.length).toBe(ATTRIBUTION_LIMITS.gclid);
  });
});

describe("shouldReplace", () => {
  const base: Attribution = {
    landing_page: "/", referrer: "", utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "",
    gclid: "", fbclid: "", first_seen: now.toISOString(),
  };
  it("stores when nothing exists", () => {
    expect(shouldReplace(null, base)).toBe(true);
  });
  it("lets a tagged visit overwrite an untagged first touch", () => {
    expect(shouldReplace(base, { ...base, gclid: "g1" })).toBe(true);
    expect(shouldReplace(base, { ...base, utm_source: "google" })).toBe(true);
  });
  it("never overwrites a tagged first touch", () => {
    expect(shouldReplace({ ...base, utm_source: "google" }, { ...base, gclid: "g2" })).toBe(false);
    expect(shouldReplace({ ...base, gclid: "g1" }, base)).toBe(false);
  });
  it("keeps the first untagged touch over a later untagged one", () => {
    expect(shouldReplace(base, { ...base, landing_page: "/en" })).toBe(false);
  });
});
