import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getMarketingPage, getMarketingPages } from "@/lib/marketing/content";
import { getArticleCover } from "@/lib/marketing/article-category";
import { mdComponents } from "@/components/marketing/markdown";
import { Eyebrow } from "@/components/marketing/ui";
import { ArticleCover } from "@/components/marketing/article-cover";
import { Breadcrumb } from "@/components/marketing/breadcrumb";
import { ArticleJsonLd } from "@/components/marketing/json-ld";
import { RelatedArticles } from "@/components/marketing/related-articles";
import { LawfulScope } from "@/components/marketing/lawful-scope";
import { ServicePage } from "@/components/marketing/service-page";
import { getRelatedPages } from "@/lib/marketing/related";
import { TH_TO_EN } from "@/lib/marketing/i18n";
import { zhSlugForEn } from "@/lib/marketing/zh/nav";
import { getServicePage, registryOnlySlugs, SERVICE_PAGES } from "@/lib/marketing/pages";
import { CONTACT } from "@/lib/marketing/contact";
import { caseStudiesIndexable } from "@/lib/marketing/case-studies";

export const dynamicParams = false; // migrated pages + registry pages only; everything else 404s

export function generateStaticParams() {
  const md = getMarketingPages().map((p) => p.slug);
  return [...md, ...registryOnlySlugs("th", new Set(md))].map((slug) => ({ slug }));
}

/** Title for a related-link target: registry page first, then markdown page. */
function titleFor(slug: string): string | undefined {
  return getServicePage("th", slug)?.h1 ?? getMarketingPage(slug)?.title;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;

  // Service / info / location page from the typed registry (money pages).
  const sp = getServicePage("th", slug);
  if (sp) {
    const path = `/${sp.slug}`;
    const en = sp.counterpart?.en ?? TH_TO_EN[sp.slug];
    const zh = sp.counterpart?.zh ?? (en ? zhSlugForEn(en) : undefined);
    return {
      title: sp.title,
      description: sp.description,
      // Case-study page: noindex until ≥ 3 real cases exist (audit Days 31–90).
      ...(sp.caseStudies && !caseStudiesIndexable() ? { robots: { index: false, follow: true } } : {}),
      alternates: {
        canonical: path,
        languages: { th: path, ...(en ? { en: `/en/${en}` } : {}), ...(zh ? { "zh-CN": `/zh/${zh}` } : {}), "x-default": en ? `/en/${en}` : path },
      },
      openGraph: {
        type: "website",
        url: `${CONTACT.siteUrl}${path}`,
        title: `${sp.title} | ${CONTACT.brand}`,
        description: sp.description,
        siteName: CONTACT.brand,
        images: [{ url: `${CONTACT.siteUrl}/api/og`, width: 1200, height: 630 }],
      },
      twitter: { card: "summary_large_image", title: `${sp.title} | ${CONTACT.brand}`, description: sp.description },
    };
  }

  const page = getMarketingPage(slug);
  if (!page) return {};
  // Next strips trailing slashes (308) → the page serves at the non-trailing
  // path; keep canonical/OG on that exact served URL so they don't point at a
  // redirect. The old WP trailing-slash URLs 308 here (Google honors it).
  const canonicalPath = page.path.replace(/\/+$/, "") || "/";
  const en = TH_TO_EN[page.slug];
  // Reciprocal hreflang: the Chinese registry page for this slug, if any.
  const zh = en ? zhSlugForEn(en) : undefined;
  const cover = getArticleCover(page.slug, page.title, "th", page);
  const ogImage = `https://detectivepulse.com${cover.src}`;
  return {
    title: page.seoTitle,
    description: page.description,
    alternates: {
      canonical: canonicalPath,
      languages: { th: canonicalPath, ...(en ? { en: `/en/${en}` } : {}), ...(zh ? { "zh-CN": `/zh/${zh}` } : {}) },
    },
    openGraph: {
      type: "article",
      url: `https://detectivepulse.com${canonicalPath}`,
      title: page.seoTitle,
      description: page.description,
      siteName: "Detective Pulse",
      images: [{ url: ogImage, width: 1200, height: 675, alt: cover.alt }],
    },
    twitter: { card: "summary_large_image", title: page.seoTitle, description: page.description, images: [ogImage] },
  };
}

export default async function MarketingArticle(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const sp = getServicePage("th", slug);
  if (sp) {
    const related = sp.related
      .map((s) => ({ href: `/${s}`, title: titleFor(s) }))
      .filter((r): r is { href: string; title: string } => Boolean(r.title));
    return <ServicePage page={sp} related={related} />;
  }

  const page = getMarketingPage(slug);
  if (!page) notFound();

  const cover = getArticleCover(page.slug, page.title, "th", page);
  // Related: same-topic pages, preferring the registry (service) pages' H1 as the label.
  const registrySlugs = new Set(SERVICE_PAGES.th.map((p) => p.slug));
  const related = getRelatedPages(getMarketingPages(), page, 3).map((p) => ({
    href: p.href,
    slug: p.slug,
    title: registrySlugs.has(p.slug) ? (getServicePage("th", p.slug)?.h1 ?? p.title) : p.title,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <ArticleJsonLd
        headline={page.title}
        description={page.description}
        image={`https://detectivepulse.com${cover.src}`}
        url={`https://detectivepulse.com${page.path.replace(/\/+$/, "") || "/"}`}
        inLanguage="th"
      />
      <Breadcrumb items={[{ name: "หน้าแรก", href: "/" }, { name: "บทความ", href: "/articles" }, { name: page.title }]} />
      <article className="mt-6">
        <div className="overflow-hidden rounded-xl border border-border">
          <ArticleCover
            slug={page.slug}
            title={page.title}
            lang="th"
            coverImage={page.coverImage}
            coverAlt={page.coverAlt}
          />
        </div>
        <div className="mt-6">
          <Eyebrow className="!gap-2">Case File</Eyebrow>
        </div>
        <h1 className="mt-4 font-serif text-3xl font-bold leading-snug tracking-tight sm:text-4xl">{page.title}</h1>
        {page.description && (
          <p className="mt-4 leading-relaxed text-muted-foreground">{page.description}</p>
        )}
        <div className="dp-hairline mt-7" />
        <div className="mt-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {page.body}
          </ReactMarkdown>
        </div>
      </article>
      <div className="mt-12">
        <LawfulScope lang="th" />
      </div>
      <div className="mt-12">
        <RelatedArticles heading="บทความที่เกี่ยวข้อง" items={related} lang="th" />
      </div>
    </div>
  );
}
