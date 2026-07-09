import { describe, it, expect } from "vitest";
import { parseMetaRefresh, parseJsRedirect, parseImageTarget } from "./redirect";

const BASE = "https://jsc12.pimeyes.com/redirect/abc";

describe("parseMetaRefresh", () => {
  it("extracts and absolutizes a relative meta-refresh URL", () => {
    const html = `<html><head><meta http-equiv="refresh" content="0; url=/next/step"></head></html>`;
    expect(parseMetaRefresh(html, BASE)).toBe("https://jsc12.pimeyes.com/next/step");
  });
  it("handles an absolute URL", () => {
    const html = `<meta http-equiv=refresh content="2;url=https://mixrank.com/x">`;
    expect(parseMetaRefresh(html, BASE)).toBe("https://mixrank.com/x");
  });
  it("returns null when absent", () => {
    expect(parseMetaRefresh("<html></html>", BASE)).toBeNull();
  });
});

describe("parseJsRedirect", () => {
  it.each([
    `window.location = "https://s3.amazonaws.com/pic.jpg"`,
    `location.href='https://s3.amazonaws.com/pic.jpg'`,
    `window.location.replace("https://s3.amazonaws.com/pic.jpg")`,
    `location.assign('https://s3.amazonaws.com/pic.jpg')`,
  ])("extracts %s", (snippet) => {
    expect(parseJsRedirect(`<script>${snippet}</script>`, BASE)).toBe(
      "https://s3.amazonaws.com/pic.jpg",
    );
  });
  it("returns null when there is no JS redirect", () => {
    expect(parseJsRedirect("<script>doStuff()</script>", BASE)).toBeNull();
  });
});

describe("parseImageTarget", () => {
  it("prefers og:image", () => {
    const html = `<meta property="og:image" content="https://cdn.example.com/a.jpg"><img src="/b.png">`;
    expect(parseImageTarget(html, BASE)).toBe("https://cdn.example.com/a.jpg");
  });
  it("falls back to the first <img>", () => {
    const html = `<img src="/profile/pic.png">`;
    expect(parseImageTarget(html, BASE)).toBe("https://jsc12.pimeyes.com/profile/pic.png");
  });
  it("returns null when there is no image", () => {
    expect(parseImageTarget("<div></div>", BASE)).toBeNull();
  });
});
