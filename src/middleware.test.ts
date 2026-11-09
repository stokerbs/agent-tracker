import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, middleware } from "./middleware";

function request(path: string, host = "detectivepulse.com", extra: Record<string, string> = {}) {
  return new NextRequest(`https://${host}${path}`, { headers: { host, ...extra } });
}

describe("registered .com language middleware", () => {
  it.each([
    ["/", "th"], ["/articles", "th"], ["/en", "en"],
    ["/en/articles/a-guide", "en"], ["/zh", "zh-CN"], ["/zh/contact", "zh-CN"],
    ["/lp/en/infidelity", "en"],
  ])("forwards %s as %s without an authentication redirect", (path, lang) => {
    const res = middleware(request(path));
    expect(res.headers.get("x-middleware-request-x-marketing-lang")).toBe(lang);
    expect(res.headers.get("x-middleware-override-headers")).toContain("x-marketing-lang");
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.getAll()).toEqual([]);
  });

  it("overwrites spoofed headers and ignores the app language cookie", () => {
    const res = middleware(request("/zh/contact", "www.detectivepulse.com", {
      "x-marketing-lang": "en", cookie: "locale=en", "x-retained-header": "retained",
    }));
    expect(res.headers.get("x-middleware-request-x-marketing-lang")).toBe("zh-CN");
    expect(res.headers.get("x-middleware-request-x-retained-header")).toBe("retained");
    expect(res.headers.get("x-marketing-lang")).toBeNull();
  });

  it.each(["detectivepulse.app", "preview.vercel.app", "detectivepulse.com.evil.test"])(
    "does not modify requests on %s", (host) => {
      const res = middleware(request("/en", host));
      expect(res.headers.get("x-middleware-override-headers")).toBeNull();
    },
  );

  it.each(["/", "/en", "/zh/contact", "/lp/en/infidelity"])(
    "Next's matcher runs for the .com page %s", (path) => {
      for (const host of ["detectivepulse.com", "www.detectivepulse.com"]) {
        expect(unstable_doesMiddlewareMatch({ config, url: `https://${host}${path}`, headers: { host } })).toBe(true);
      }
    },
  );

  it.each(["/api/marketing/lead", "/api/cron/publish-article", "/_next/static/main.js", "/_next/image", "/marketing/logo.png"])(
    "Next's matcher skips %s", (path) => {
      expect(unstable_doesMiddlewareMatch({ config, url: `https://detectivepulse.com${path}`, headers: { host: "detectivepulse.com" } })).toBe(false);
    },
  );

  it.each(["detectivepulse.app", "preview.vercel.app", "detectivepulse.com.evil.test"])(
    "Next's matcher skips host %s", (host) => {
      expect(unstable_doesMiddlewareMatch({ config, url: `https://${host}/zh`, headers: { host } })).toBe(false);
    },
  );
});
