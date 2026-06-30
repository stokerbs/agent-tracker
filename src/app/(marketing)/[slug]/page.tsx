import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getMarketingPage, getMarketingPages } from "@/lib/marketing/content";

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
  return {
    title: page.seoTitle,
    description: page.description,
    alternates: { canonical: canonicalPath },
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

// Tailwind-styled renderers (no @tailwindcss/typography dependency).
const md = {
  h1: (p: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className="mt-8 text-xl font-bold" {...p} />,
  h2: (p: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className="mt-8 text-xl font-bold" {...p} />,
  h3: (p: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className="mt-6 text-lg font-semibold" {...p} />,
  h4: (p: React.HTMLAttributes<HTMLHeadingElement>) => <h4 className="mt-4 font-semibold" {...p} />,
  p:  (p: React.HTMLAttributes<HTMLParagraphElement>) => <p className="mt-4 leading-relaxed text-foreground/90" {...p} />,
  ul: (p: React.HTMLAttributes<HTMLUListElement>) => <ul className="mt-4 list-disc space-y-1.5 pl-6 text-foreground/90" {...p} />,
  ol: (p: React.HTMLAttributes<HTMLOListElement>) => <ol className="mt-4 list-decimal space-y-1.5 pl-6 text-foreground/90" {...p} />,
  a:  (p: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a className="text-primary underline underline-offset-2 hover:opacity-80" {...p} />,
  strong: (p: React.HTMLAttributes<HTMLElement>) => <strong className="font-semibold" {...p} />,
};

export default async function MarketingArticle(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const page = getMarketingPage(slug);
  if (!page) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <article>
        <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{page.title}</h1>
        {page.description && (
          <p className="mt-3 text-muted-foreground">{page.description}</p>
        )}
        <div className="mt-6 border-t border-border/60 pt-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
            {page.body}
          </ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
