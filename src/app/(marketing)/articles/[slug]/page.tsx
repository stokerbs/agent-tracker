import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getArticleCover } from "@/lib/marketing/article-category";
import { mdComponents } from "@/components/marketing/markdown";
import { Eyebrow } from "@/components/marketing/ui";
import { ArticleCover } from "@/components/marketing/article-cover";
import { Breadcrumb } from "@/components/marketing/breadcrumb";
import { getPublishedArticles, getPublishedArticleBySlug } from "@/lib/marketing/articles-db";

// AI-generated articles live in the DB and publish on approval (no redeploy), so
// this route resolves dynamically. generateStaticParams pre-builds the ones that
// exist at build time; anything published later renders on demand.
export async function generateStaticParams() {
  const arts = await getPublishedArticles();
  return arts.map((a) => ({ slug: a.th_slug }));
}

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
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
    </div>
  );
}
