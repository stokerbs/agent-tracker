import type { Metadata } from "next";
import Link from "next/link";
import { getMarketingPages } from "@/lib/marketing/content";
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

export default function ArticlesIndex() {
  const pages = getMarketingPages();

  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <SectionHeading
        eyebrow="Case Files · คลังบทความ"
        title="บทความทั้งหมด"
        sub={`${pages.length} บทความความรู้เกี่ยวกับงานนักสืบเอกชน`}
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((p, i) => (
          <Link
            key={p.slug}
            href={p.path}
            className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
          >
            <ArticleCover slug={p.slug} title={p.title} index={i} />
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
    </main>
  );
}
