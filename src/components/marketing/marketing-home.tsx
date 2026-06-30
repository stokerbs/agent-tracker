import Link from "next/link";
import {
  Search, HeartCrack, Wallet, MapPin, Smartphone, UserSearch, ShieldCheck,
  PhoneCall, Mail, MessageCircle, FileText, ArrowRight, CheckCircle2,
} from "lucide-react";
import { SiteChrome } from "@/components/marketing/site-chrome";
import { getMarketingPage } from "@/lib/marketing/content";

// Services grid → the migrated service pages.
const SERVICES: { slug: string; label: string; blurb: string; Icon: typeof Search }[] = [
  { slug: "นักสืบชู้สาว", label: "นักสืบชู้สาว", blurb: "ติดตามพฤติกรรมสามี/ภรรยา สืบชู้ สืบกิ๊ก เก็บหลักฐานเพื่อใช้ในชั้นศาล", Icon: HeartCrack },
  { slug: "สืบทรัพย์สิน", label: "สืบทรัพย์สิน", blurb: "ตรวจสอบทรัพย์สินลูกหนี้ก่อนฟ้อง/บังคับคดี อย่างเป็นระบบ", Icon: Wallet },
  { slug: "เช็คประวัติบุคคล", label: "เช็คประวัติบุคคล", blurb: "ตรวจสอบประวัติ ความน่าเชื่อถือ ก่อนร่วมงานหรือทำธุรกรรม", Icon: UserSearch },
  { slug: "สืบตามหาคน", label: "สืบตามหาคน", blurb: "ติดตามคนหาย ญาติพลัดพราก ลูกหนี้หลบหนี ตามหาคนโกง", Icon: MapPin },
  { slug: "นักสืบไอที", label: "นักสืบไอที", blurb: "สืบงานบนโลกออนไลน์ โซเชียล และข้อมูลดิจิทัล", Icon: Smartphone },
  { slug: "จ้างนักสืบ", label: "จ้างนักสืบ", blurb: "ขั้นตอน ราคา และวิธีเลือกนักสืบมืออาชีพที่ไว้ใจได้", Icon: Search },
];

const PROCESS = [
  "คุยรายละเอียดของงาน",
  "ตกลงราคา",
  "ชำระงวดแรก 50% ของราคางาน",
  "เริ่มทำงาน",
  "ชำระงวดสุดท้ายก่อนรับข้อมูล",
];

const ARTICLES = ["จ้างนักสืบออนไลน์", "Private Investigator", "สืบตามหาคน", "บริการนักสืบ"];
// /private-investigator is the one English slug
const ART_SLUGS: Record<string, string> = { "Private Investigator": "private-investigator" };

const WHY = [
  { Icon: ShieldCheck, title: "เป็นความลับ", desc: "ข้อมูลทุกอย่างของลูกค้าถูกเก็บเป็นความลับอย่างเคร่งครัด" },
  { Icon: Search, title: "มืออาชีพ", desc: "ทีมนักสืบประสบการณ์สูง พร้อมรางวัลการันตีความสำเร็จ" },
  { Icon: MapPin, title: "ทั่วราชอาณาจักร", desc: "รับงานสืบทุกจังหวัดทั่วประเทศไทย เฝ้าไม่พลาดแม้วินาทีเดียว" },
];

export function MarketingHome() {
  const services = SERVICES.map((s) => ({ ...s, page: getMarketingPage(s.slug) })).filter((s) => s.page);
  const articles = ARTICLES.map((a) => ({ label: a, page: getMarketingPage(ART_SLUGS[a] ?? a) })).filter((a) => a.page);
  const contact = getMarketingPage("ติดต่อนักสืบ");

  return (
    <SiteChrome>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">DETECTIVE PULSE</p>
          <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            นักสืบเอกชน <span className="text-primary">มืออาชีพ</span> รับงานสืบทั่วราชอาณาจักร
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            ด้วยประสบการณ์ที่สั่งสมมานาน พร้อมรางวัลการันตีความสำเร็จมากมาย และที่สำคัญ — ข้อมูลทุกอย่างของลูกค้าจะถูกเก็บเป็นความลับ
          </p>
          {contact && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={contact.path} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90">
                <PhoneCall className="h-4 w-4" /> ปรึกษา / ติดต่อนักสืบ
              </Link>
              <a href="#services" className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-5 py-2.5 font-medium hover:bg-muted">
                ดูบริการ <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto max-w-3xl px-4 py-14 text-center">
        <h2 className="text-xl font-bold sm:text-2xl">เกี่ยวกับเรา</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          นักสืบเอกชน Detective Pulse ให้บริการสืบข้อมูลด้านบุคคล เช่น การสืบชู้สาว สืบจับบุคคลตามหมายจับ หมายศาล สืบหาคนหาย หาที่อยู่บุคคล ตามหาคนโกง โดนโกงออนไลน์ สืบพฤติกรรมบุตรหลาน สืบประวัติการก่ออาชญากรรม สืบประวัติบุคคลก่อนเข้าทำงาน สืบประวัติการเดินทางเข้าออกประเทศ ติดตามรถยนต์ เช็คการใช้งานโทรศัพท์ และอื่น ๆ — ข้อมูลทุกอย่างของลูกค้าจะถูกเก็บเป็นความลับ
        </p>
      </section>

      {/* Services */}
      <section id="services" className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-center text-xl font-bold sm:text-2xl">บริการของเรา</h2>
          <p className="mt-2 text-center text-sm font-medium text-primary">กัดไม่ปล่อย เฝ้าไม่ถอย คอยไม่เลิก</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <Link key={s.slug} href={s.page!.path} className="group rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/40">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold group-hover:text-primary">{s.label}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:grid-cols-3">
        {WHY.map((w) => (
          <div key={w.title} className="text-center">
            <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <w.Icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold">{w.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{w.desc}</p>
          </div>
        ))}
      </section>

      {/* Process */}
      <section id="process" className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-center text-xl font-bold sm:text-2xl">ขั้นตอนการทำงาน</h2>
          <ol className="mt-8 space-y-4">
            {PROCESS.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-center text-sm text-muted-foreground">* หากยกเลิกโดยผู้ว่าจ้าง จะไม่คืนเงินมัดจำ</p>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="mx-auto max-w-3xl px-4 py-14 text-center">
        <h2 className="text-xl font-bold sm:text-2xl">รีวิว</h2>
        <CheckCircle2 className="mx-auto mt-4 h-8 w-8 text-primary" />
        <p className="mt-3 text-muted-foreground">ขอขอบคุณลูกค้าทุกท่านที่ไว้วางใจให้ Detective Pulse ดูแล</p>
      </section>

      {/* Articles */}
      {articles.length > 0 && (
        <section id="articles" className="border-t border-border/60 bg-card/30">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="text-center text-xl font-bold sm:text-2xl">บทความที่น่าสนใจ</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {articles.map((a) => (
                <Link key={a.label} href={a.page!.path} className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/40">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    <span className="font-medium group-hover:text-primary">{a.page!.title}</span>
                    <span className="mt-1 flex items-center gap-1 text-sm text-primary">อ่านบทความ <ArrowRight className="h-3.5 w-3.5" /></span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-xl font-bold sm:text-2xl">เรา คือนักสืบเอกชน มืออาชีพ</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          ปรึกษาเบื้องต้นได้ทุกเคส เป็นความลับ — ติดต่อทีมนักสืบของเราได้เลย
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
          <a href="tel:+66968461406" className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2 hover:bg-muted">
            <PhoneCall className="h-4 w-4 text-primary" /> 096 846 1406
          </a>
          <a href="tel:+66809188324" className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2 hover:bg-muted">
            <PhoneCall className="h-4 w-4 text-primary" /> +66 80 918 8324
          </a>
          <a href="mailto:detectivepluse@gmail.com" className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2 hover:bg-muted">
            <Mail className="h-4 w-4 text-primary" /> detectivepluse@gmail.com
          </a>
          {contact && (
            <Link href={contact.path} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90">
              <MessageCircle className="h-4 w-4" /> ช่องทางติดต่อทั้งหมด
            </Link>
          )}
        </div>
      </section>
    </SiteChrome>
  );
}
