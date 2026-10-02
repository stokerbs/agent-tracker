import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CampaignLanding } from "@/components/marketing/campaign-landing";
import { TH_LANDING_PAGES, getLandingPage } from "@/lib/marketing/landing-pages";

export const dynamicParams = false; // only the defined campaign pages

export function generateStaticParams() {
  return TH_LANDING_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const lp = getLandingPage(slug, "th");
  if (!lp) return {};
  return {
    title: `${lp.keyword}`,
    description: lp.sub,
    // Paid-traffic landing pages — keep them out of the organic index so they
    // don't compete with / dilute the main pages.
    robots: { index: false, follow: false },
    alternates: { canonical: `/lp/${lp.slug}` },
  };
}

export default async function ThaiCampaignLandingPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const lp = getLandingPage(slug, "th");
  if (!lp) notFound();
  return <CampaignLanding lp={lp} />;
}
