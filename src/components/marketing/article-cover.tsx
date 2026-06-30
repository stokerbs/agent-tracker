import {
  HeartCrack, Wallet, UserSearch, MapPin, Smartphone, Search,
  PhoneCall, ShieldCheck, type LucideIcon,
} from "lucide-react";
import { FileTag, CornerTicks } from "@/components/marketing/ui";

/**
 * Generated dossier-style cover for a marketing article. Picks an icon +
 * category label that match the article's topic (by keyword on slug + title),
 * rendered in the FBI × Sherlock theme — so every article gets a content-aware
 * cover without managing a separate image file per page.
 */
type Category = { Icon: LucideIcon; th: string; en: string };

function classify(text: string): Category {
  const has = (...k: string[]) => k.some((x) => text.includes(x));
  // Order matters: more specific topics first.
  if (has("ชู้", "แฟน", "เมียน้อย", "กิ๊ก", "cheating", "spouse", "infidelit"))
    return { Icon: HeartCrack, th: "สืบชู้สาว", en: "Infidelity" };
  if (has("ทรัพย์", "asset", "debtor"))
    return { Icon: Wallet, th: "สืบทรัพย์สิน", en: "Asset Search" };
  if (has("ประวัติบุคคล", "ตรวจสอบประวัติ", "เช็คประวัติ", "background"))
    return { Icon: UserSearch, th: "เช็คประวัติ", en: "Background Check" };
  if (has("ตามหา", "หาคน", "หาย", "หาญาติ", "ลูกหนี้", "missing", "find"))
    return { Icon: MapPin, th: "ตามหาคน", en: "Find a Person" };
  if (has("ไอที", "ออนไลน์", "โทร", "facebook", "line", "instagram", "cyber", "ฉ้อโกง", "โซเชียล"))
    return { Icon: Smartphone, th: "นักสืบไอที", en: "Cyber" };
  if (has("ติดต่อ", "contact"))
    return { Icon: PhoneCall, th: "ติดต่อนักสืบ", en: "Contact" };
  if (has("ราคา", "คิดราคา", "จ้าง", "hire", "pricing"))
    return { Icon: Search, th: "จ้างนักสืบ", en: "Hire a Detective" };
  return { Icon: ShieldCheck, th: "งานสืบ", en: "Investigation" };
}

export function ArticleCover({
  slug,
  title = "",
  index = 0,
  lang = "th",
  className = "",
}: {
  slug: string;
  title?: string;
  index?: number;
  lang?: "th" | "en";
  className?: string;
}) {
  const c = classify(`${slug} ${title}`.toLowerCase() + ` ${slug} ${title}`);
  const Icon = c.Icon;
  const label = lang === "en" ? c.en : c.th;

  return (
    <div className={`relative aspect-video w-full overflow-hidden bg-[#0a0e16] ${className}`}>
      <div className="dp-grid absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-primary/15 blur-2xl" />
      {/* Oversized watermark icon */}
      <Icon aria-hidden className="pointer-events-none absolute -bottom-8 -right-5 h-48 w-48 text-primary/[0.06]" strokeWidth={1.25} />
      <CornerTicks />
      <div className="absolute left-3 top-3">
        <FileTag>{`CASE ${String(index + 1).padStart(2, "0")}`}</FileTag>
      </div>
      {/* Focal icon + category */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
          <Icon className="h-8 w-8" strokeWidth={1.5} />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary/85">{label}</span>
      </div>
    </div>
  );
}
