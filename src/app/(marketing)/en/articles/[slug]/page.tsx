import type { Metadata } from "next";
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
import { getPublishedArticleBySlug, getPublishedArticles } from "@/lib/marketing/articles-db";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedArticleBySlug(slug, "en");
  if (!a) return {};
  const canonical = `/en/articles/${a.en_slug}`;
  const cover = getArticleCover(a.en_slug, a.en_title, "en");
  const ogImage = `https://detectivepulse.com${cover.src}`;
  return {
    title: `${a.en_title} | Detective Pulse`,
    description: a.en_description,
    alternates: { canonical, languages: { en: canonical, th: `/articles/${a.th_slug}` } },
    openGraph: {
      type: "article",
      url: `https://detectivepulse.com${canonical}`,
      title: a.en_title,
      description: a.en_description,
      siteName: "Detective Pulse",
      images: [{ url: ogImage, width: 1200, height: 675, alt: cover.alt }],
    },
    twitter: { card: "summary_large_image", title: a.en_title, description: a.en_description, images: [ogImage] },
  };
}

export default async function DbArticleEN(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const a = await getPublishedArticleBySlug(slug, "en");
  if (!a) notFound();

  const related = (await getPublishedArticles())
    .filter((x) => x.id !== a.id)
    .slice(0, 3)
    .map((x) => ({ href: `/en/articles/${x.en_slug}`, slug: x.en_slug, title: x.en_title }));
  const cover = getArticleCover(a.en_slug, a.en_title, "en");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <ArticleJsonLd
        headline={a.en_title}
        description={a.en_description}
        image={`https://detectivepulse.com${cover.src}`}
        url={`https://detectivepulse.com/en/articles/${a.en_slug}`}
        datePublished={a.published_at ?? undefined}
        inLanguage="en"
      />
      <Breadcrumb items={[{ name: "Home", href: "/en" }, { name: "Articles", href: "/en/articles" }, { name: a.en_title }]} />
      <article className="mt-6">
        <div className="overflow-hidden rounded-xl border border-border">
          <ArticleCover slug={a.en_slug} title={a.en_title} lang="en" />
        </div>
        <div className="mt-6">
          <Eyebrow className="!gap-2">Case File</Eyebrow>
        </div>
        <h1 className="mt-4 font-serif text-3xl font-bold leading-snug tracking-tight sm:text-4xl">{a.en_title}</h1>
        {a.en_description && <p className="mt-4 leading-relaxed text-muted-foreground">{a.en_description}</p>}
        <div className="dp-hairline mt-7" />
        <div className="mt-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {a.en_body}
          </ReactMarkdown>
        </div>
      </article>
      <div className="mt-12">
        <RelatedArticles heading="Related articles" items={related} lang="en" />
      </div>
    </div>
  );
}
