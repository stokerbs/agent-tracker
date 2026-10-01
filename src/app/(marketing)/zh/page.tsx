import type { Metadata } from "next";
import { MarketingHomeZH } from "@/components/marketing/marketing-home-zh";
import { zhAlternates } from "@/lib/marketing/zh/alternates";

const TITLE = "泰国专业调查与核实服务 | Detective Pulse";
const DESCRIPTION = "为中国客户提供泰国本地调查、背景核实、寻人及商业尽职调查服务。泰国本地团队，全国覆盖，微信沟通，证据化中文报告。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: zhAlternates({ zh: "/zh", th: "/", en: "/en" }),
  openGraph: {
    type: "website",
    url: "https://detectivepulse.com/zh",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Detective Pulse",
    locale: "zh_CN",
    images: [{ url: "https://detectivepulse.com/api/og", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function ZhHome() {
  return <MarketingHomeZH />;
}
