import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getMarketingPage, getMarketingPages } from "@/lib/marketing/content";
import { mdComponents } from "@/components/marketing/markdown";
import { Eyebrow } from "@/components/marketing/ui";
import { ArticleCover } from "@/components/marketing/article-cover";
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
    },
    twitter: { card: "summary_large_image", title: page.seoTitle, description: page.description },
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
      <Link href="/" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> กลับหน้าแรก
      </Link>
      <article className="mt-6">
        <div className="overflow-hidden rounded-xl border border-border">
          <ArticleCover slug={page.slug} title={page.title} lang="th" />
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
