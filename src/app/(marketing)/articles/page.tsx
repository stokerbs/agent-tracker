import type { Metadata } from "next";
import Link from "next/link";
import { getMarketingPages } from "@/lib/marketing/content";
import { getPublishedArticles } from "@/lib/marketing/articles-db";
import { ArticleCover } from "@/components/marketing/article-cover";
import { SectionHeading } from "@/components/marketing/ui";

export const metadata: Metadata = {
  title: "บทความน่ารู้เกี่ยวกับงานนักสืบเอกชน | Detective Pulse",
  description:
    "รวมบทความและความรู้เรื่องงานสืบ — สืบชู้สาว สืบทรัพย์สิน เช็คประวัติบุคคล ตามหาคน นักสืบไอที การจ้างนักสืบ และอื่น ๆ จากนักสืบเอกชนมืออาชีพ",
  alternates: { canonical: "/articles", languages: { th: "/articles", en: "/en/articles" } },
  openGraph: {
    type: "website",
    url: "https://detectivepulse.com/articles",
    title: "บทความน่ารู้เกี่ยวกับงานนักสืบเอกชน | Detective Pulse",
    description: "รวมบทความและความรู้เรื่องงานสืบจากนักสืบเอกชนมืออาชีพ",
    siteName: "Detective Pulse",
  },
};

export default async function ArticlesIndex() {
  const pages = getMarketingPages();
  const aiArticles = await getPublishedArticles();
  // Newest AI-published articles first, then the migrated library.
  const cards = [
    ...aiArticles.map((a) => ({ key: a.id, href: `/articles/${a.th_slug}`, slug: a.th_slug, title: a.th_title, description: a.th_description })),
    ...pages.map((p) => ({ key: p.slug, href: p.path, slug: p.slug, title: p.title, description: p.description })),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <SectionHeading
        eyebrow="Case Files · คลังบทความ"
        title="บทความทั้งหมด"
        sub={`${cards.length} บทความความรู้เกี่ยวกับงานนักสืบเอกชน`}
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <Link
            key={c.key}
            href={c.href}
            className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
          >
            <ArticleCover slug={c.slug} title={c.title} index={i} />
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
