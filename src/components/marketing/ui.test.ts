import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionHeading } from "./ui";

describe("marketing heading semantics", () => {
  it("renders the page heading as H1 when requested", () => {
    const html = renderToStaticMarkup(createElement(SectionHeading, { as: "h1", title: "Articles", sub: "Guides" }));
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("Articles</h1>"); expect(html).not.toContain("<h2");
  });
  it("keeps normal section headings as H2", () => {
    const html = renderToStaticMarkup(createElement(SectionHeading, { title: "Services" }));
    expect(html).toContain("Services</h2>"); expect(html).not.toContain("<h1");
  });
});
