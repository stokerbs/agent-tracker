import type { QA } from "@/lib/marketing/faq";
import { CONTACT, SAME_AS } from "@/lib/marketing/contact";

/**
 * Structured data (JSON-LD) for the marketing homepages — drives Google rich
 * results and gives search / AI engines one unambiguous business entity:
 * ProfessionalService (+ LocalBusiness) with NAP, founding date, service area,
 * languages, contact points, sameAs profiles and the 4.8★ / 63-review rating,
 * plus the FAQ box. All values are static, first-party content from
 * src/lib/marketing/contact.ts (no user input); the standard Next.js JSON-LD
 * pattern is a <script> with stringified data, with `<` escaped so the payload
 * can't break out of the script element.
 */
const BASE = CONTACT.siteUrl;

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
    author: { "@type": "Organization", name: CONTACT.brand, url: BASE },
    publisher: {
      "@type": "Organization",
      "@id": `${BASE}/#business`,
      name: CONTACT.brand,
      logo: { "@type": "ImageObject", url: `${BASE}/marketing/logo.png` },
    },
  };
  return <LdScript data={data} />;
}

const DESCRIPTION: Record<"th" | "en", string> = {
  th: "นักสืบเอกชนมืออาชีพ ตั้งแต่ปี 2016 รับสืบชู้สาว เช็คประวัติบุคคล ตามหาคน สืบทรัพย์ และตรวจสอบธุรกิจ ด้วยวิธีที่ถูกกฎหมาย กรุงเทพฯ และทั่วประเทศไทย เป็นความลับ",
  en: "Professional private investigators in Thailand since 2016 — infidelity, background checks, missing persons, asset tracing and due diligence, by lawful methods. Bangkok-based, nationwide, confidential.",
};

const AREA_SERVED = [
  { "@type": "Country", name: "Thailand" },
  { "@type": "City", name: "Bangkok" },
  { "@type": "City", name: "Pattaya" },
  { "@type": "City", name: "Phuket" },
  { "@type": "City", name: "Chiang Mai" },
];

export function MarketingJsonLd({ faq, lang = "th" }: { faq: QA[]; lang?: "th" | "en" }) {
  const business = {
    "@context": "https://schema.org",
    "@type": ["ProfessionalService", "LocalBusiness"],
    "@id": `${BASE}/#business`,
    name: CONTACT.brand,
    alternateName: ["นักสืบเอกชน Detective Pulse", "Detective Pulse Thailand"],
    description: DESCRIPTION[lang],
    url: lang === "en" ? `${BASE}/en` : `${BASE}/`,
    image: `${BASE}/marketing/logo.png`,
    logo: `${BASE}/marketing/logo.png`,
    foundingDate: String(CONTACT.foundingYear),
    telephone: CONTACT.phoneE164,
    email: CONTACT.email,
    address: { "@type": "PostalAddress", addressLocality: CONTACT.city, addressCountry: CONTACT.countryCode },
    areaServed: AREA_SERVED,
    knowsLanguage: ["th", "en", "zh-CN"],
    priceRange: "฿฿",
    contactPoint: [
      { "@type": "ContactPoint", contactType: "customer service", telephone: CONTACT.phoneE164, availableLanguage: ["th", "en"] },
      { "@type": "ContactPoint", contactType: "customer service", url: CONTACT.lineUrl, availableLanguage: ["th"] },
      { "@type": "ContactPoint", contactType: "customer service", url: CONTACT.whatsappUrl, availableLanguage: ["en"] },
    ],
    sameAs: SAME_AS,
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
    inLanguage: lang,
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
