import type { Metadata } from "next";
import { MarketingHomeZH } from "@/components/marketing/marketing-home-zh";

export const metadata: Metadata = {
  title: "泰国私家侦探 | Detective Pulse",
  description:
    "Detective Pulse —— 泰国专业私家侦探。婚外情、财产调查、寻人、背景核查与网络调查。严格保密，全国服务。",
  alternates: { canonical: "/zh", languages: { zh: "/zh", th: "/", en: "/en" } },
  openGraph: {
    type: "website",
    url: "https://detectivepulse.com/zh",
    title: "泰国私家侦探 | Detective Pulse",
    description: "泰国专业、保密的私家侦探服务，全国承接。",
    siteName: "Detective Pulse",
    images: [{ url: "https://detectivepulse.com/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "泰国私家侦探 | Detective Pulse",
    description: "泰国专业、保密的私家侦探服务，全国承接。",
  },
};

export default function ZhHome() {
  return <MarketingHomeZH />;
}
