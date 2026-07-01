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
import { TH_TO_EN } from "@/lib/marketing/i18n";

export const dynamicParams = false; // only the migrated pages; everything else 404s

export function generateStaticParams() {
  return getMarketingPages().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const page = getMarketingPage(slug);
  if (!page) return {};
  // Next strips trailing slashes (308) → the page serves at the non-trailing
  // path; keep canonical/OG on that exact served URL so they don't point at a
  // redirect. The old WP trailing-slash URLs 308 here (Google honors it).
  const canonicalPath = page.path.replace(/\/+$/, "") || "/";
  const en = TH_TO_EN[page.slug];
  const cover = getArticleCover(page.slug, page.title, "th", page);
  const ogImage = `https://detectivepulse.com${cover.src}`;
  return {
    title: page.seoTitle,
    description: page.description,
    alternates: {
      canonical: canonicalPath,
      languages: { th: canonicalPath, ...(en ? { en: `/en/${en}` } : {}) },
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
  const page = getMarketingPage(slug);
  if (!page) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
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
    </main>
  );
}
