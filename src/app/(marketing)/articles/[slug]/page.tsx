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

// AI-generated articles live in the DB and publish on approval (no redeploy).
// Render dynamically (the app is already dynamic via the root layout's
// headers()), so newly-approved articles appear immediately and unknown slugs
// resolve to a clean 404 via notFound().
export const dynamic = "force-dynamic";

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedArticleBySlug(slug, "th");
  if (!a) return {};
  const canonical = `/articles/${a.th_slug}`;
  const cover = getArticleCover(a.th_slug, a.th_title, "th");
  const ogImage = `https://detectivepulse.com${cover.src}`;
  return {
    title: `${a.th_title} | Detective Pulse`,
    description: a.th_description,
    alternates: { canonical, languages: { th: canonical, en: `/en/articles/${a.en_slug}` } },
    openGraph: {
      type: "article",
      url: `https://detectivepulse.com${canonical}`,
      title: a.th_title,
      description: a.th_description,
      siteName: "Detective Pulse",
      images: [{ url: ogImage, width: 1200, height: 675, alt: cover.alt }],
    },
    twitter: { card: "summary_large_image", title: a.th_title, description: a.th_description, images: [ogImage] },
  };
}

export default async function DbArticleTH(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const a = await getPublishedArticleBySlug(slug, "th");
  if (!a) notFound();

  const related = (await getPublishedArticles())
    .filter((x) => x.id !== a.id)
    .slice(0, 3)
    .map((x) => ({ href: `/articles/${x.th_slug}`, slug: x.th_slug, title: x.th_title }));
  const cover = getArticleCover(a.th_slug, a.th_title, "th");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <ArticleJsonLd
        headline={a.th_title}
        description={a.th_description}
        image={`https://detectivepulse.com${cover.src}`}
        url={`https://detectivepulse.com/articles/${a.th_slug}`}
        datePublished={a.published_at ?? undefined}
        inLanguage="th"
      />
      <Breadcrumb items={[{ name: "หน้าแรก", href: "/" }, { name: "บทความ", href: "/articles" }, { name: a.th_title }]} />
      <article className="mt-6">
        <div className="overflow-hidden rounded-xl border border-border">
          <ArticleCover slug={a.th_slug} title={a.th_title} lang="th" />
        </div>
        <div className="mt-6">
          <Eyebrow className="!gap-2">Case File</Eyebrow>
        </div>
        <h1 className="mt-4 font-serif text-3xl font-bold leading-snug tracking-tight sm:text-4xl">{a.th_title}</h1>
        {a.th_description && <p className="mt-4 leading-relaxed text-muted-foreground">{a.th_description}</p>}
        <div className="dp-hairline mt-7" />
        <div className="mt-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {a.th_body}
          </ReactMarkdown>
        </div>
      </article>
      <div className="mt-12">
        <RelatedArticles heading="บทความที่เกี่ยวข้อง" items={related} lang="th" />
      </div>
    </div>
  );
}
