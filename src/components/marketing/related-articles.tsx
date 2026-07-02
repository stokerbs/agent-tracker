import Link from "next/link";
import { ArticleCover } from "@/components/marketing/article-cover";

export interface RelatedItem {
  href: string;
  slug: string;
  title: string;
}

/**
 * "Related articles" row shown at the bottom of an article — internal linking
 * that keeps readers on-site and helps SEO crawl/relevance. Renders nothing when
 * there are no others to show.
 */
export function RelatedArticles({
  heading,
  items,
  lang = "th",
}: {
  heading: string;
  items: RelatedItem[];
  lang?: "th" | "en";
}) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 pb-14">
      <div className="dp-hairline mb-6" />
      <h2 className="font-serif text-xl font-bold">{heading}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.slice(0, 3).map((it, i) => (
          <Link
            key={it.href}
            href={it.href}
            className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
          >
            <ArticleCover slug={it.slug} title={it.title} index={i} lang={lang} />
            <div className="p-3">
              <h3 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">{it.title}</h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
