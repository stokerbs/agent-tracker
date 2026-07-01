/**
 * Structured data for a single marketing article — drives Google's Article rich
 * result and the breadcrumb trail in search listings. All values are static,
 * first-party content (page frontmatter), rendered as a `<script type=
 * "application/ld+json">` with `<` escaped so the payload can't break out.
 */
const BASE = "https://detectivepulse.com";

export function ArticleJsonLd({
  title,
  description,
  path,
  lang,
  homeLabel,
}: {
  title: string;
  description?: string;
  /** Served (non-trailing) path, e.g. "/นักสืบชู้สาว" or "/en/background-check". */
  path: string;
  lang: "th" | "en";
  /** Breadcrumb label for the home crumb, e.g. "หน้าแรก" / "Home". */
  homeLabel: string;
}) {
  const url = `${BASE}${path}`;
  const homeUrl = lang === "en" ? `${BASE}/en` : `${BASE}/`;

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    ...(description ? { description } : {}),
    inLanguage: lang,
    image: `${BASE}/opengraph-image`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    author: { "@type": "Organization", name: "Detective Pulse" },
    publisher: {
      "@type": "Organization",
      name: "Detective Pulse",
      logo: { "@type": "ImageObject", url: `${BASE}/marketing/logo.png` },
    },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: homeLabel, item: homeUrl },
      { "@type": "ListItem", position: 2, name: title, item: url },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(article).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
