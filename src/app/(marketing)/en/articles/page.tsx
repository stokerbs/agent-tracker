import type { Metadata } from "next";
import Link from "next/link";
import { getMarketingPagesEN } from "@/lib/marketing/content";
import { getPublishedArticles } from "@/lib/marketing/articles-db";
import { ArticleCover } from "@/components/marketing/article-cover";
import { SectionHeading } from "@/components/marketing/ui";

export const metadata: Metadata = {
  title: "Articles & Resources | Detective Pulse",
  description:
    "Guides and resources on private investigation in Thailand — infidelity, asset searches, background checks, finding a person, cyber investigations and hiring a detective.",
  alternates: { canonical: "/en/articles", languages: { en: "/en/articles", th: "/articles" } },
  openGraph: {
    type: "website",
    url: "https://detectivepulse.com/en/articles",
    title: "Articles & Resources | Detective Pulse",
    description: "Guides and resources on private investigation in Thailand.",
    siteName: "Detective Pulse",
  },
};

export default async function ArticlesIndexEN() {
  const pages = getMarketingPagesEN();
  const aiArticles = await getPublishedArticles();
  const cards = [
    ...aiArticles.map((a) => ({ key: a.id, href: `/en/articles/${a.en_slug}`, slug: a.en_slug, title: a.en_title, description: a.en_description })),
    ...pages.map((p) => ({ key: p.slug, href: p.path, slug: p.slug, title: p.title, description: p.description })),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <SectionHeading
        eyebrow="Case Files · Resources"
        title="Articles &amp; Resources"
        sub={`${cards.length} guides on professional private investigation`}
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <Link
            key={c.key}
            href={c.href}
            className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
          >
            <ArticleCover slug={c.slug} title={c.title} index={i} lang="en" />
            <div className="p-4">
              <h2 className="line-clamp-2 font-serif text-base font-bold leading-snug group-hover:text-primary">
                {c.title}
              </h2>
              {c.description && (
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
