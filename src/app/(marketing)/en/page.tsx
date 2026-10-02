import type { Metadata } from "next";
import { MarketingHomeEN } from "@/components/marketing/marketing-home-en";

export const metadata: Metadata = {
  title: "Private Investigator Thailand — Discreet, Lawful, Nationwide",
  description:
    "Professional private investigators in Thailand since 2016. Infidelity, partner verification, background checks, missing persons, asset tracing and due diligence by lawful methods. Free, confidential consultation.",
  alternates: { canonical: "/en", languages: { en: "/en", th: "/", "zh-CN": "/zh", "x-default": "/en" } },
  openGraph: {
    type: "website",
    url: "https://detectivepulse.com/en",
    title: "Private Investigator Thailand — Discreet, Lawful, Nationwide | Detective Pulse",
    description: "Professional, confidential private investigation services across Thailand.",
    siteName: "Detective Pulse",
    images: [{ url: "https://detectivepulse.com/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Private Investigator Thailand — Discreet, Lawful, Nationwide | Detective Pulse",
    description: "Professional, confidential private investigation services across Thailand.",
    images: ["https://detectivepulse.com/api/og"],
  },
};

export default function EnglishHome() {
  return <MarketingHomeEN />;
}
