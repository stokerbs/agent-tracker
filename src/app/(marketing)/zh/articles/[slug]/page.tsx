import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getArticleCover } from "@/lib/marketing/article-category";
import { mdComponents } from "@/components/marketing/markdown";
import { Eyebrow } from "@/components/marketing/ui";
import { ArticleCover } from "@/components/marketing/article-cover";
import { Breadcrumb } from "@/components/marketing/breadcrumb";
import { ArticleJsonLd } from "@/components/marketing/json-ld";
import { RelatedArticles } from "@/components/marketing/related-articles";
import { getPublishedArticleBySlug, getPublishedArticlesZh } from "@/lib/marketing/articles-db";
import { ZH_SERVICE_PAGE, articleServiceKey } from "@/lib/marketing/zh/nav";
import { zhPageLabel } from "@/lib/marketing/zh/registry";
import { WeChatCta } from "@/components/marketing/zh/wechat-cta";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedArticleBySlug(slug, "zh");
  if (!a || !a.zh_title) return {};
  const canonical = `/zh/articles/${a.zh_slug}`;
  const cover = getArticleCover(a.zh_slug ?? a.en_slug, a.zh_title, "en");
  const ogImage = `https://detectivepulse.com${cover.src}`;
  return {
    title: `${a.zh_title}`,
    description: a.zh_description ?? undefined,
    alternates: {
      canonical,
      languages: { "zh-CN": canonical, th: `/articles/${a.th_slug}`, en: `/en/articles/${a.en_slug}`, "x-default": `/en/articles/${a.en_slug}` },
    },
    openGraph: {
      type: "article",
      url: `https://detectivepulse.com${canonical}`,
      title: a.zh_title,
      description: a.zh_description ?? undefined,
      siteName: "Detective Pulse",
      images: [{ url: ogImage, width: 1200, height: 675, alt: cover.alt }],
    },
    twitter: { card: "summary_large_image", title: a.zh_title, description: a.zh_description ?? undefined, images: [ogImage] },
  };
}

export default async function DbArticleZH(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const a = await getPublishedArticleBySlug(slug, "zh");
  if (!a || !a.zh_title || !a.zh_body) notFound();

  const related = (await getPublishedArticlesZh())
    .filter((x) => x.id !== a.id && x.zh_slug && x.zh_title)
    .slice(0, 3)
    .map((x) => ({ href: `/zh/articles/${x.zh_slug}`, slug: x.zh_slug!, title: x.zh_title! }));
  const cover = getArticleCover(a.zh_slug ?? a.en_slug, a.zh_title, "en");
  // Internal link to the service this article supports (S-2): stored service
  // key for Phase-2 articles, cover-category guess for older ones.
  const serviceKey = articleServiceKey(a.service, a.cover_category);
  const servicePath = ZH_SERVICE_PAGE[serviceKey] ?? "/zh/private-investigator-thailand";
  const serviceSlug = servicePath.replace(/^\/zh\//, "");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <ArticleJsonLd
        headline={a.zh_title}
        description={a.zh_description ?? undefined}
        image={`https://detectivepulse.com${cover.src}`}
        url={`https://detectivepulse.com/zh/articles/${a.zh_slug}`}
        datePublished={a.published_at ?? undefined}
        inLanguage="zh"
      />
      <Breadcrumb items={[{ name: "首页", href: "/zh" }, { name: "文章", href: "/zh/articles" }, { name: a.zh_title }]} />
      <article className="mt-6">
        <div className="overflow-hidden rounded-xl border border-border">
          <ArticleCover slug={a.zh_slug ?? a.en_slug} title={a.zh_title} lang="en" />
        </div>
        <div className="mt-6">
          <Eyebrow className="!gap-2">Case File</Eyebrow>
        </div>
        <h1 className="mt-4 font-serif text-3xl font-bold leading-snug tracking-tight sm:text-4xl">{a.zh_title}</h1>
        {a.zh_description && <p className="mt-4 leading-relaxed text-muted-foreground">{a.zh_description}</p>}
        <div className="dp-hairline mt-7" />
        <div className="mt-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {a.zh_body}
          </ReactMarkdown>
        </div>
        {/* Related service — turns the article's readers into service-page visitors. */}
        <aside className="mt-10 flex flex-col items-start justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary/80">相关服务</p>
            <p className="mt-1 font-serif text-lg font-bold">{zhPageLabel(serviceSlug)}</p>
            <p className="mt-1 text-sm text-muted-foreground">了解服务范围、交付内容与收费方式，或直接微信咨询。</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href={servicePath} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/50 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10">
              查看服务 <ArrowRight className="h-4 w-4" />
            </Link>
            <WeChatCta placement="service" service={serviceKey} variant="compact" />
          </div>
        </aside>
      </article>
      <div className="mt-12">
        <RelatedArticles heading="相关文章" items={related} lang="en" />
      </div>
    </div>
  );
}
