import {
  HeartCrack, Wallet, UserSearch, MapPin, Smartphone, Search,
  PhoneCall, ShieldCheck, Calculator, type LucideIcon,
} from "lucide-react";

/** Topic bucket for article covers — one stock image per category. */
export type ArticleCategoryKey =
  | "infidelity"
  | "asset"
  | "background"
  | "find-person"
  | "cyber"
  | "hire"
  | "pricing"
  | "contact"
  | "investigation";

export interface ArticleCategory {
  key: ArticleCategoryKey;
  Icon: LucideIcon;
  th: string;
  en: string;
}

/** Stock covers in /public/marketing/articles/ (Unsplash, free license). */
export const COVER_IMAGES: Record<
  ArticleCategoryKey,
  { src: string; altTh: string; altEn: string; credit: string }
> = {
  infidelity: {
    src: "/marketing/articles/infidelity.jpg",
    altTh: "บริการสืบชู้สาว — นักสืบเอกชน Detective Pulse",
    altEn: "Infidelity investigation — Detective Pulse private detective",
    credit: "Unsplash",
  },
  asset: {
    src: "/marketing/articles/asset.jpg",
    altTh: "สืบทรัพย์สินลูกหนี้ — นักสืบเอกชน Detective Pulse",
    altEn: "Asset investigation — Detective Pulse private detective",
    credit: "Unsplash",
  },
  background: {
    src: "/marketing/articles/background.jpg",
    altTh: "เช็คประวัติบุคคล — นักสืบเอกชน Detective Pulse",
    altEn: "Background check — Detective Pulse private detective",
    credit: "Unsplash",
  },
  "find-person": {
    src: "/marketing/articles/find-person.jpg",
    altTh: "สืบตามหาคน — นักสืบเอกชน Detective Pulse",
    altEn: "Find a missing person — Detective Pulse private detective",
    credit: "Unsplash",
  },
  cyber: {
    src: "/marketing/articles/cyber.jpg",
    altTh: "นักสืบไอที สืบออนไลน์ — Detective Pulse",
    altEn: "Cyber & online investigation — Detective Pulse",
    credit: "Unsplash",
  },
  hire: {
    src: "/marketing/articles/hire.jpg",
    altTh: "จ้างนักสืบมืออาชีพ — Detective Pulse",
    altEn: "Hire a private detective — Detective Pulse",
    credit: "Unsplash",
  },
  pricing: {
    src: "/marketing/articles/pricing.jpg",
    altTh: "ราคาจ้างนักสืบเอกชน — Detective Pulse",
    altEn: "Private detective pricing — Detective Pulse",
    credit: "Unsplash",
  },
  contact: {
    src: "/marketing/articles/contact.jpg",
    altTh: "ติดต่อนักสืบ — Detective Pulse",
    altEn: "Contact a private investigator — Detective Pulse",
    credit: "Unsplash",
  },
  investigation: {
    src: "/marketing/articles/investigation.jpg",
    altTh: "งานสืบสวนเอกชน — Detective Pulse",
    altEn: "Private investigation services — Detective Pulse",
    credit: "Unsplash",
  },
};

/** Classify article topic from slug + title (order matters — specific first). */
export function classifyArticle(text: string): ArticleCategory {
  const t = text.toLowerCase();
  const has = (...k: string[]) => k.some((x) => t.includes(x));

  if (has("ชู้", "แฟน", "เมียน้อย", "กิ๊ก", "cheating", "spouse", "infidelit"))
    return { key: "infidelity", Icon: HeartCrack, th: "สืบชู้สาว", en: "Infidelity" };
  if (has("ทรัพย์", "asset", "debtor"))
    return { key: "asset", Icon: Wallet, th: "สืบทรัพย์สิน", en: "Asset Search" };
  if (has("ประวัติบุคคล", "ตรวจสอบประวัติ", "เช็คประวัติ", "background"))
    return { key: "background", Icon: UserSearch, th: "เช็คประวัติ", en: "Background Check" };
  if (has("ตามหา", "หาคน", "หาย", "หาญาติ", "ลูกหนี้", "missing", "find-person", "find "))
    return { key: "find-person", Icon: MapPin, th: "ตามหาคน", en: "Find a Person" };
  if (has("ไอที", "ออนไลน์", "โทร", "facebook", "line", "instagram", "cyber", "ฉ้อโกง", "โซเชียล"))
    return { key: "cyber", Icon: Smartphone, th: "นักสืบไอที", en: "Cyber" };
  if (has("คิดราคา", "pricing"))
    return { key: "pricing", Icon: Calculator, th: "ราคาจ้างนักสืบ", en: "Pricing" };
  if (has("ติดต่อ", "contact"))
    return { key: "contact", Icon: PhoneCall, th: "ติดต่อนักสืบ", en: "Contact" };
  if (has("จ้าง", "hire", "private-investigator", "นักสืบ", "detective"))
    return { key: "hire", Icon: Search, th: "จ้างนักสืบ", en: "Hire a Detective" };
  return { key: "investigation", Icon: ShieldCheck, th: "งานสืบ", en: "Investigation" };
}

export function getArticleCover(
  slug: string,
  title: string,
  lang: "th" | "en" = "th",
  override?: { coverImage?: string; coverAlt?: string },
) {
  const category = classifyArticle(`${slug} ${title}`);
  const stock = COVER_IMAGES[category.key];
  return {
    category,
    src: override?.coverImage ?? stock.src,
    alt: override?.coverAlt ?? (lang === "en" ? stock.altEn : stock.altTh),
  };
}
