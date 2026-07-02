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
import { EN_TO_TH } from "@/lib/marketing/i18n";

export const dynamicParams = false; // only translated pages; everything else 404s

export function generateStaticParams() {
  return getMarketingPagesEN().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const page = getMarketingPageEN(slug);
  if (!page) return {};
  const canonicalPath = page.path; // /en/<slug> (no trailing slash)
  const th = EN_TO_TH[page.slug];
  const cover = getArticleCover(page.slug, page.title, "en", page);
  const ogImage = `https://detectivepulse.com${cover.src}`;
  return {
    title: page.seoTitle,
    description: page.description,
    alternates: {
      canonical: canonicalPath,
      languages: { en: canonicalPath, ...(th ? { th: `/${th}/` } : {}) },
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
  const page = getMarketingPageEN(slug);
  if (!page) notFound();

  const cover = getArticleCover(page.slug, page.title, "en", page);
  const related = getMarketingPagesEN()
    .filter((p) => p.slug !== page.slug)
    .slice(0, 3)
    .map((p) => ({ href: p.path, slug: p.slug, title: p.title }));

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
        <RelatedArticles heading="Related articles" items={related} lang="en" />
      </div>
    </div>
  );
}
