import type { MarketingServicePage } from "@/lib/marketing/pages";
import { CONTACT } from "@/lib/marketing/contact";

const BASE = CONTACT.siteUrl;

function LdScript({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** Service + FAQPage structured data for a Thai/English registry page (static constants only). */
export function ServiceJsonLd({ page, url }: { page: MarketingServicePage; url: string }) {
  const service = page.kind === "info" ? null : {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: page.h1,
    description: page.description,
    url,
    inLanguage: page.lang,
    serviceType: page.title,
    provider: { "@id": `${BASE}/#business` },
    areaServed: { "@type": "Country", name: "Thailand" },
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: page.lang === "en" ? `${BASE}/en/contact` : `${BASE}/ติดต่อนักสืบ`,
      availableLanguage: ["th", "en"],
    },
  };
  const faq = page.faq.length >= 3 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: page.lang,
    mainEntity: page.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  } : null;
  return (
    <>
      {service && <LdScript data={service} />}
      {faq && <LdScript data={faq} />}
    </>
  );
}
