import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getMarketingPageEN, getMarketingPagesEN } from "@/lib/marketing/content";
import { mdComponents } from "@/components/marketing/markdown";
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
    },
    twitter: { card: "summary_large_image", title: page.seoTitle, description: page.description },
  };
}

export default async function MarketingArticleEN(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const page = getMarketingPageEN(slug);
  if (!page) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <article>
        <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{page.title}</h1>
        {page.description && <p className="mt-3 text-muted-foreground">{page.description}</p>}
        <div className="mt-6 border-t border-border/60 pt-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {page.body}
          </ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
