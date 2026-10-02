import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZhMarketingPage } from "@/components/marketing/zh/zh-page";
import { ZH_PAGES, getZhPage } from "@/lib/marketing/zh/registry";
import { zhAlternates, enPathFor, thPathFor } from "@/lib/marketing/zh/alternates";
import { ZH_CASE_STUDIES } from "@/lib/marketing/zh/case-studies";
import { getPublishedArticlesZhByService } from "@/lib/marketing/articles-db";

// Every Chinese service / info / location page is pre-rendered from the
// registry (src/lib/marketing/zh). Unknown slugs 404 at build time.
export const dynamicParams = false;
// Related articles are fetched at render time; revalidate hourly so newly
// published Chinese articles appear without a redeploy.
export const revalidate = 3600;

export function generateStaticParams() {
  return ZH_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getZhPage(slug);
  if (!page) return {};
  const path = `/zh/${page.slug}`;
  const title = `${page.title}`;
  // case-studies stays out of the index until the first real case is published.
  const noindex = page.noindex && (page.slug !== "case-studies" || ZH_CASE_STUDIES.length === 0);
  return {
    title,
    description: page.description,
    alternates: zhAlternates({ zh: path, en: enPathFor(page.en), th: thPathFor(page.th) }),
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "website",
      url: `https://detectivepulse.com${path}`,
      title,
      description: page.description,
      siteName: "Detective Pulse",
      locale: "zh_CN",
      images: [{ url: "https://detectivepulse.com/api/og", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description: page.description },
  };
}

export default async function ZhRegistryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getZhPage(slug);
  if (!page) notFound();
  // Related Chinese articles for this service (S-2 internal linking). Info
  // pages (pricing/about/contact/how-it-works) skip it; "general" gets any.
  const articles = page.kind === "info" ? [] : await getPublishedArticlesZhByService(page.service, 3).catch(() => []);
  return (
    <ZhMarketingPage
      page={page}
      articles={articles.filter((a) => a.zh_slug && a.zh_title).map((a) => ({ href: `/zh/articles/${a.zh_slug}`, slug: a.zh_slug!, title: a.zh_title! }))}
    />
  );
}
