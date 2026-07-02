import type { QA } from "@/lib/marketing/faq";

/**
 * Structured data (JSON-LD) for the marketing homepages — drives Google rich
 * results: business info, the 4.8★ / 63-review star rating, and the FAQ box.
 * All values are static, first-party content (no user input); the standard
 * Next.js JSON-LD pattern is a <script> with stringified data, with `<`
 * escaped so the payload can't break out of the script element.
 */
const BASE = "https://detectivepulse.com";

function LdScript({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** BlogPosting structured data for an article page (Google rich results). */
export function ArticleJsonLd({
  headline,
  description,
  image,
  url,
  datePublished,
  inLanguage,
}: {
  headline: string;
  description?: string;
  image?: string;
  url: string;
  datePublished?: string;
  inLanguage: "th" | "en" | "zh";
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: headline.slice(0, 110),
    ...(description ? { description } : {}),
    ...(image ? { image: [image] } : {}),
    url,
    mainEntityOfPage: url,
    inLanguage,
    ...(datePublished ? { datePublished, dateModified: datePublished } : {}),
    author: { "@type": "Organization", name: "Detective Pulse", url: BASE },
    publisher: {
      "@type": "Organization",
      name: "Detective Pulse",
      logo: { "@type": "ImageObject", url: `${BASE}/marketing/logo.png` },
    },
  };
  return <LdScript data={data} />;
}

export function MarketingJsonLd({ faq }: { faq: QA[] }) {
  const business = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${BASE}/#business`,
    name: "Detective Pulse",
    alternateName: "นักสืบเอกชน Detective Pulse",
    description:
      "นักสืบเอกชนมืออาชีพ รับงานสืบทุกประเภท สืบชู้สาว สืบทรัพย์สิน เช็คประวัติบุคคล ตามหาคน ทั่วราชอาณาจักร เป็นความลับ",
    url: BASE,
    image: `${BASE}/marketing/logo.png`,
    logo: `${BASE}/marketing/logo.png`,
    telephone: "+66968461406",
    priceRange: "฿฿",
    areaServed: { "@type": "Country", name: "Thailand" },
    sameAs: ["https://www.facebook.com/Detectivepluse.th"],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "63",
      bestRating: "5",
      worstRating: "1",
    },
  };
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <>
      <LdScript data={business} />
      <LdScript data={faqPage} />
    </>
  );
}
