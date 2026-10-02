import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getMarketingPageEN, getMarketingPagesEN } from "@/lib/marketing/content";
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
import { EN_TO_TH } from "@/lib/marketing/i18n";
import { zhSlugForEn } from "@/lib/marketing/zh/nav";
import { getServicePage, registryOnlySlugs, SERVICE_PAGES } from "@/lib/marketing/pages";
import { CONTACT } from "@/lib/marketing/contact";

export const dynamicParams = false; // translated pages + registry pages only; everything else 404s

export function generateStaticParams() {
  const md = getMarketingPagesEN().map((p) => p.slug);
  return [...md, ...registryOnlySlugs("en", new Set(md))].map((slug) => ({ slug }));
}

function titleFor(slug: string): string | undefined {
  return getServicePage("en", slug)?.h1 ?? getMarketingPageEN(slug)?.title;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;

  const sp = getServicePage("en", slug);
  if (sp) {
    const path = `/en/${sp.slug}`;
    const th = sp.counterpart?.th ?? EN_TO_TH[sp.slug];
    const zh = sp.counterpart?.zh ?? zhSlugForEn(sp.slug);
    return {
      title: sp.title,
      description: sp.description,
      alternates: {
        canonical: path,
        languages: { en: path, ...(th ? { th: `/${th}` } : {}), ...(zh ? { "zh-CN": `/zh/${zh}` } : {}), "x-default": path },
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

  const page = getMarketingPageEN(slug);
  if (!page) return {};
  const canonicalPath = page.path; // /en/<slug> (no trailing slash)
  const th = EN_TO_TH[page.slug];
  // Reciprocal hreflang: the Chinese registry page for this slug, if any.
  const zh = zhSlugForEn(page.slug);
  const cover = getArticleCover(page.slug, page.title, "en", page);
  const ogImage = `https://detectivepulse.com${cover.src}`;
  return {
    title: page.seoTitle,
    description: page.description,
    alternates: {
      canonical: canonicalPath,
      languages: { en: canonicalPath, ...(th ? { th: `/${th}` } : {}), ...(zh ? { "zh-CN": `/zh/${zh}` } : {}) },
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

export default async function MarketingArticleEN(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const sp = getServicePage("en", slug);
  if (sp) {
    const related = sp.related
      .map((s) => ({ href: `/en/${s}`, title: titleFor(s) }))
      .filter((r): r is { href: string; title: string } => Boolean(r.title));
    return <ServicePage page={sp} related={related} />;
  }

  const page = getMarketingPageEN(slug);
  if (!page) notFound();

  const cover = getArticleCover(page.slug, page.title, "en", page);
  const registrySlugs = new Set(SERVICE_PAGES.en.map((p) => p.slug));
  const related = getRelatedPages(getMarketingPagesEN(), page, 3).map((p) => ({
    href: p.href,
    slug: p.slug,
    title: registrySlugs.has(p.slug) ? (getServicePage("en", p.slug)?.h1 ?? p.title) : p.title,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <ArticleJsonLd
        headline={page.title}
        description={page.description}
        image={`https://detectivepulse.com${cover.src}`}
        url={`https://detectivepulse.com${page.path}`}
        inLanguage="en"
      />
      <Breadcrumb items={[{ name: "Home", href: "/en" }, { name: "Articles", href: "/en/articles" }, { name: page.title }]} />
      <article className="mt-6">
        <div className="overflow-hidden rounded-xl border border-border">
          <ArticleCover
            slug={page.slug}
            title={page.title}
            lang="en"
            coverImage={page.coverImage}
            coverAlt={page.coverAlt}
          />
        </div>
        <div className="mt-6">
          <Eyebrow className="!gap-2">Case File</Eyebrow>
        </div>
        <h1 className="mt-4 font-serif text-3xl font-bold leading-snug tracking-tight sm:text-4xl">{page.title}</h1>
        {page.description && <p className="mt-4 leading-relaxed text-muted-foreground">{page.description}</p>}
        <div className="dp-hairline mt-7" />
        <div className="mt-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {page.body}
          </ReactMarkdown>
        </div>
      </article>
      <div className="mt-12">
        <LawfulScope lang="en" />
      </div>
      <div className="mt-12">
        <RelatedArticles heading="Related articles" items={related} lang="en" />
      </div>
    </div>
  );
}
