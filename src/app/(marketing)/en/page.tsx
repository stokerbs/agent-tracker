import type { Metadata } from "next";
import { MarketingHomeEN } from "@/components/marketing/marketing-home-en";

export const metadata: Metadata = {
  title: "Private Investigator in Thailand | Detective Pulse",
  description:
    "Detective Pulse — professional private investigators in Thailand. Infidelity, asset searches, missing persons, background checks and cyber investigations. Confidential, nationwide.",
  alternates: { canonical: "/en", languages: { en: "/en", th: "/" } },
  openGraph: {
    type: "website",
    url: "https://detectivepulse.com/en",
    title: "Private Investigator in Thailand | Detective Pulse",
    description: "Professional, confidential private investigation services across Thailand.",
    siteName: "Detective Pulse",
    images: [{ url: "https://detectivepulse.com/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Private Investigator in Thailand | Detective Pulse",
    description: "Professional, confidential private investigation services across Thailand.",
    images: ["https://detectivepulse.com/api/og"],
  },
};

export default function EnglishHome() {
  return <MarketingHomeEN />;
}
