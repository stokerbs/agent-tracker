import Link from "next/link";
import { Search, HeartCrack, Wallet, MapPin, Smartphone, UserSearch, ShieldCheck, PhoneCall } from "lucide-react";
import { SiteChrome } from "@/components/marketing/site-chrome";
import { getMarketingPage } from "@/lib/marketing/content";

// Curated services for the homepage grid → link to the migrated service pages.
const SERVICES: { slug: string; label: string; blurb: string; Icon: typeof Search }[] = [
  { slug: "นักสืบชู้สาว", label: "นักสืบชู้สาว", blurb: "ติดตามพฤติกรรมคู่รัก/คู่สมรส เก็บหลักฐานเพื่อความสบายใจหรือใช้ในชั้นศาล", Icon: HeartCrack },
  { slug: "สืบทรัพย์สิน", label: "สืบทรัพย์สิน", blurb: "ตรวจสอบทรัพย์สินลูกหนี้ก่อนฟ้อง/บังคับคดี อย่างเป็นระบบ", Icon: Wallet },
  { slug: "เช็คประวัติบุคคล", label: "เช็คประวัติบุคคล", blurb: "ตรวจสอบประวัติ ความน่าเชื่อถือ ก่อนร่วมงานหรือทำธุรกรรม", Icon: UserSearch },
  { slug: "สืบตามหาคน", label: "สืบตามหาคน", blurb: "ติดตามคนหาย ญาติพลัดพราก ลูกหนี้หลบหนี จากทุกเบาะแส", Icon: MapPin },
  { slug: "นักสืบไอที", label: "นักสืบไอที", blurb: "สืบงานบนโลกออนไลน์ โซเชียล และข้อมูลดิจิทัล", Icon: Smartphone },
  { slug: "จ้างนักสืบ", label: "จ้างนักสืบ", blurb: "ขั้นตอน ราคา และวิธีเลือกนักสืบมืออาชีพที่ไว้ใจได้", Icon: Search },
];

const WHY = [
  { Icon: ShieldCheck, title: "เป็นความลับ", desc: "รักษาข้อมูลลูกค้าอย่างเคร่งครัด ทุกเคสปกปิดตัวตน" },
  { Icon: Search, title: "มืออาชีพ", desc: "ทีมนักสืบมีประสบการณ์ ทำงานเป็นระบบ มีหลักฐานชัดเจน" },
  { Icon: MapPin, title: "ทั่วราชอาณาจักร", desc: "รับงานสืบทุกจังหวัดทั่วประเทศไทย" },
];

export function MarketingHome() {
  const services = SERVICES.map((s) => ({ ...s, page: getMarketingPage(s.slug) })).filter((s) => s.page);
  const contact = getMarketingPage("ติดต่อนักสืบ");

  return (
    <SiteChrome>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center">
          <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            นักสืบเอกชนมืออาชีพ <span className="text-primary">รับงานสืบทั่วราชอาณาจักร</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            สืบชู้สาว สืบทรัพย์สิน ตามหาคน เช็คประวัติบุคคล และงานสืบทุกประเภท — เก็บหลักฐานอย่างมืออาชีพ เป็นความลับ และเชื่อถือได้
          </p>
          {contact && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                href={contact.path}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <PhoneCall className="h-4 w-4" /> ปรึกษา / ติดต่อนักสืบ
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-center text-xl font-bold sm:text-2xl">บริการของเรา</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Link
              key={s.slug}
              href={s.page!.path}
              className="group rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/40"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold group-hover:text-primary">{s.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="border-t border-border/60 bg-card/30">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:grid-cols-3">
          {WHY.map((w) => (
            <div key={w.title} className="text-center">
              <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <w.Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{w.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      {contact && (
        <section className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">ต้องการความจริง? เราพร้อมช่วยคุณ</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            ปรึกษาเบื้องต้นฟรี ทุกเคสเป็นความลับ — บอกเล่าเรื่องราวของคุณ แล้วให้ทีมนักสืบของเราดูแล
          </p>
          <Link
            href={contact.path}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <PhoneCall className="h-4 w-4" /> ติดต่อเรา
          </Link>
        </section>
      )}
    </SiteChrome>
  );
}
