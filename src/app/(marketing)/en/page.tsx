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
  },
};

export default function EnglishHome() {
  return <MarketingHomeEN />;
}
