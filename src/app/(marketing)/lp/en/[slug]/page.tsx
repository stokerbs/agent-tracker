import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CampaignLanding } from "@/components/marketing/campaign-landing";
import { EN_LANDING_PAGES, getLandingPage } from "@/lib/marketing/landing-pages";

export const dynamicParams = false; // only the defined campaign pages

export function generateStaticParams() {
  return EN_LANDING_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const lp = getLandingPage(slug, "en");
  if (!lp) return {};
  return {
    title: `${lp.keyword}`,
    description: lp.sub,
    // Paid-traffic landing pages — noindexed so they never compete with the
    // organic /en service pages.
    robots: { index: false, follow: false },
    alternates: { canonical: `/lp/en/${lp.slug}` },
  };
}

export default async function EnglishCampaignLandingPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const lp = getLandingPage(slug, "en");
  if (!lp) notFound();
  return <CampaignLanding lp={lp} />;
}
