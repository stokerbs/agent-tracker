import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedArticlesZh } from "@/lib/marketing/articles-db";
import { ArticleCover } from "@/components/marketing/article-cover";
import { SectionHeading } from "@/components/marketing/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "文章与指南 | Detective Pulse",
  description: "关于泰国私家侦探的文章与指南 —— 婚外情、财产调查、背景核查、寻人与网络调查。",
  alternates: { canonical: "/zh/articles", languages: { zh: "/zh/articles", th: "/articles", en: "/en/articles" } },
  openGraph: {
    type: "website",
    url: "https://detectivepulse.com/zh/articles",
    title: "文章与指南 | Detective Pulse",
    description: "关于泰国私家侦探的文章与指南。",
    siteName: "Detective Pulse",
  },
};

export default async function ArticlesIndexZH() {
  const articles = await getPublishedArticlesZh();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <SectionHeading eyebrow="Case Files · 文章库" title="文章与指南" sub={`${articles.length} 篇私家侦探相关文章`} />
      {articles.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">暂无文章，敬请期待。</p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a, i) => (
            <Link
              key={a.id}
              href={`/zh/articles/${a.zh_slug}`}
              className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
            >
              <ArticleCover slug={a.zh_slug ?? a.en_slug} title={a.zh_title ?? a.en_title} index={i} lang="en" />
              <div className="p-4">
                <h2 className="line-clamp-2 font-serif text-base font-bold leading-snug group-hover:text-primary">
                  {a.zh_title}
                </h2>
                {a.zh_description && (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{a.zh_description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
