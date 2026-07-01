import type { Metadata } from "next";
import Link from "next/link";
import { getMarketingPagesEN } from "@/lib/marketing/content";
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

export default function ArticlesIndexEN() {
  const pages = getMarketingPagesEN();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <SectionHeading
        eyebrow="Case Files · Resources"
        title="Articles &amp; Resources"
        sub={`${pages.length} guides on professional private investigation`}
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((p, i) => (
          <Link
            key={p.slug}
            href={p.path}
            className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
          >
            <ArticleCover slug={p.slug} title={p.title} index={i} lang="en" />
            <div className="p-4">
              <h2 className="line-clamp-2 font-serif text-base font-bold leading-snug group-hover:text-primary">
                {p.title}
              </h2>
              {p.description && (
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {p.description}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
