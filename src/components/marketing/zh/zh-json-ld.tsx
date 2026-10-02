import type { ZhPage } from "@/lib/marketing/zh/registry";
import { ZH_COMPANY } from "@/lib/marketing/zh/company";

const BASE = "https://detectivepulse.com";

function LdScript({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** Chinese-language business entity (ProfessionalService) for /zh pages. */
export function ZhBusinessJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${BASE}/#business`,
    name: ZH_COMPANY.name,
    alternateName: "泰国专业调查与核实服务 Detective Pulse",
    description: "为中国客户提供泰国本地调查、背景核实、寻人及商业尽职调查服务。",
    url: `${BASE}/zh`,
    image: `${BASE}/marketing/logo.png`,
    logo: `${BASE}/marketing/logo.png`,
    email: ZH_COMPANY.email,
    telephone: ZH_COMPANY.whatsapp,
    foundingDate: String(ZH_COMPANY.since),
    areaServed: { "@type": "Country", name: "Thailand" },
    availableLanguage: ["zh-CN", "en", "th"],
    sameAs: ZH_COMPANY.sameAs,
    address: { "@type": "PostalAddress", addressLocality: "Bangkok", addressCountry: "TH" },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: ZH_COMPANY.reviews.rating,
      reviewCount: String(ZH_COMPANY.reviews.count),
      bestRating: "5",
      worstRating: "1",
    },
  };
  return <LdScript data={data} />;
}

/** Service + FAQPage structured data for a registry page. */
export function ZhServiceJsonLd({ page, url }: { page: ZhPage; url: string }) {
  const service = page.kind === "info" ? null : {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.h1,
    description: page.description,
    url,
    inLanguage: "zh-CN",
    serviceType: page.h1,
    provider: { "@id": `${BASE}/#business` },
    areaServed: { "@type": "Country", name: "Thailand" },
  };
  const faq = page.faq.length >= 3 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "zh-CN",
    mainEntity: page.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  } : null;
  return (
    <>
      {service && <LdScript data={service} />}
      {faq && <LdScript data={faq} />}
    </>
  );
}
