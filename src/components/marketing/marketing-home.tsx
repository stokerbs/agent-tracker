/* eslint-disable @next/next/no-img-element -- static marketing assets in /public; next/image adds no value here */
import Link from "next/link";
import {
  Search, HeartCrack, Wallet, MapPin, Smartphone, UserSearch, ShieldCheck,
  PhoneCall, Mail, MessageCircle, ArrowRight, PlayCircle, Crosshair, Fingerprint, Star,
} from "lucide-react";
import { SiteChrome } from "@/components/marketing/site-chrome";
import { Eyebrow, SectionHeading, FileTag, Stamp, CornerTicks } from "@/components/marketing/ui";
import { LineIcon, WhatsAppIcon, FacebookIcon, WeChatIcon } from "@/components/marketing/brand-icons";
import { getMarketingPage } from "@/lib/marketing/content";

const YOUTUBE_URL = "https://www.youtube.com/watch?v=-sYx6i8OBF0";

const SERVICES: { slug: string; label: string; blurb: string; Icon: typeof Search }[] = [
  { slug: "นักสืบชู้สาว", label: "นักสืบชู้สาว", blurb: "ติดตามพฤติกรรมสามี/ภรรยา สืบชู้ สืบกิ๊ก เก็บหลักฐานเพื่อใช้ในชั้นศาล", Icon: HeartCrack },
  { slug: "สืบทรัพย์สิน", label: "สืบทรัพย์สิน", blurb: "ตรวจสอบทรัพย์สินลูกหนี้ก่อนฟ้อง/บังคับคดี อย่างเป็นระบบ", Icon: Wallet },
  { slug: "เช็คประวัติบุคคล", label: "เช็คประวัติบุคคล", blurb: "ตรวจสอบประวัติ ความน่าเชื่อถือ ก่อนร่วมงานหรือทำธุรกรรม", Icon: UserSearch },
  { slug: "สืบตามหาคน", label: "สืบตามหาคน", blurb: "ติดตามคนหาย ญาติพลัดพราก ลูกหนี้หลบหนี ตามหาคนโกง", Icon: MapPin },
  { slug: "นักสืบไอที", label: "นักสืบไอที", blurb: "สืบงานบนโลกออนไลน์ โซเชียล และข้อมูลดิจิทัล", Icon: Smartphone },
  { slug: "จ้างนักสืบ", label: "จ้างนักสืบ", blurb: "ขั้นตอน ราคา และวิธีเลือกนักสืบมืออาชีพที่ไว้ใจได้", Icon: Search },
];

const PROCESS = ["คุยรายละเอียดของงาน", "ตกลงราคา", "ชำระงวดแรก 50% ของราคางาน", "เริ่มทำงาน", "ชำระงวดสุดท้ายก่อนรับข้อมูล"];

const WHY = [
  { Icon: ShieldCheck, title: "เป็นความลับ", desc: "ข้อมูลทุกอย่างของลูกค้าถูกเก็บเป็นความลับอย่างเคร่งครัด" },
  { Icon: Search, title: "มืออาชีพ", desc: "ทีมนักสืบประสบการณ์สูง พร้อมรางวัลการันตีความสำเร็จ" },
  { Icon: MapPin, title: "ทั่วราชอาณาจักร", desc: "รับงานสืบทุกจังหวัดทั่วประเทศไทย เฝ้าไม่พลาดแม้วินาทีเดียว" },
];

const ARTICLES = [
  { slug: "จ้างนักสืบออนไลน์", img: "/marketing/art-online.png" },
  { slug: "private-investigator", img: "/marketing/art-pi.png" },
  { slug: "สืบตามหาคน", img: "/marketing/art-find.png" },
  { slug: "บริการนักสืบ", img: "/marketing/art-services.png" },
  { slug: "สืบทรัพย์สิน", img: "/marketing/art-assets.png" },
  { slug: "ติดต่อนักสืบ", img: "/marketing/art-contact.png" },
];

// Verified customer reviews (from the firm's Fastwork profile).
const REVIEW_RATING = "4.8";
const REVIEW_COUNT = 63;
const TESTIMONIALS: { name: string; date: string; stars: number; text: string }[] = [
  { name: "pingpong27", date: "07/02/2026", stars: 5, text: "รวดเร็วและข้อมูลแม่นยำแบบ 100% ทำงานเร็วกว่ากำหนดไว้มาก แจ้งว่าได้ข้อมูล 1-2 วัน แต่เวลาจริงไม่ถึงครึ่งวันได้ข้อมูลมาแล้วและครบถ้วนถูกต้อง" },
  { name: "Nattavara", date: "13/01/2026", stars: 5, text: "ตกใจกับข้อมูลที่ได้เพราะรู้ลึกพอสมควรสำหรับคนที่ให้สืบ แนะนำค่ะ" },
  { name: "ลูกค้า Fastwork", date: "10/06/2026", stars: 5, text: "ดีมากค่ะ ประทับใจทีมงาน อัพเดทตลอดเวลา ใครต้องการจ้างแนะนำเลยจริงๆค่ะ" },
  { name: "ลูกค้า Fastwork", date: "25/12/2025", stars: 4, text: "ทำงานดี ให้คำปรึกษาดี ผลงานออกมาดีเกินคาดเลย เชื่อมั่นได้ว่าไม่โกงแน่นอน" },
  { name: "plmrenpz", date: "16/10/2025", stars: 5, text: "ทำงานรอไว้ล่วงหน้าเลย ดีมากค่ะ แนะนำ" },
  { name: "ลูกค้า Fastwork", date: "15/08/2025", stars: 5, text: "มืออาชีพมากค่ะ" },
];

export function MarketingHome() {
  const services = SERVICES.map((s) => ({ ...s, page: getMarketingPage(s.slug) })).filter((s) => s.page);
  const articles = ARTICLES.map((a) => ({ ...a, page: getMarketingPage(a.slug) })).filter((a) => a.page);
  const contact = getMarketingPage("ติดต่อนักสืบ");

  return (
    <SiteChrome>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <Fingerprint aria-hidden className="pointer-events-none absolute -right-10 top-10 h-72 w-72 text-primary/[0.04]" />
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center">
          <div className="mb-6 flex items-center justify-center gap-3">
            <img src="/marketing/logo.png" alt="Detective Pulse" className="h-11 w-auto" />
          </div>
          <Eyebrow>Case File · เปิดสำนวนสืบสวน</Eyebrow>
          <h1 className="mx-auto mt-5 max-w-3xl text-balance font-serif text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
            นักสืบเอกชน <span className="text-primary">มืออาชีพ</span><br className="hidden sm:block" /> รับงานสืบทั่วราชอาณาจักร
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            ด้วยประสบการณ์ที่สั่งสมมานาน พร้อมรางวัลการันตีความสำเร็จมากมาย และที่สำคัญ — ข้อมูลทุกอย่างของลูกค้าจะถูกเก็บเป็นความลับ
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href="https://lin.ee/SSqk98x" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-90">
              <LineIcon className="h-5 w-5" /> ปรึกษาฟรีทาง LINE
            </a>
            <a href="tel:+66968461406" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              <PhoneCall className="h-4 w-4" /> โทรเลย
            </a>
            <a href="#contact" className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-muted">
              ช่องทางติดต่อ <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="text-primary/80">{"// กัดไม่ปล่อย เฝ้าไม่ถอย คอยไม่เลิก"}</span>
          </div>
        </div>
      </section>

      {/* Video */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <SectionHeading eyebrow="Evidence Reel · วิดีโอแนะนำ" title="แนะนำ Detective Pulse" />
        <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="group relative mt-8 block overflow-hidden rounded-xl border border-border bg-card">
          <CornerTicks />
          <img src="/marketing/video-cover.png" alt="วิดีโอแนะนำ Detective Pulse" className="w-full" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 transition-colors group-hover:bg-black/45">
            <PlayCircle className="h-16 w-16 text-white drop-shadow-lg transition-transform group-hover:scale-110" />
          </span>
          <span className="absolute left-3 top-3"><FileTag>REC ●</FileTag></span>
        </a>
      </section>

      {/* About */}
      <section id="about" className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <SectionHeading eyebrow="Dossier · เกี่ยวกับเรา" title="เกี่ยวกับเรา" />
          <p className="mt-6 leading-relaxed text-muted-foreground">
            นักสืบเอกชน Detective Pulse ให้บริการสืบข้อมูลด้านบุคคล เช่น การสืบชู้สาว สืบจับบุคคลตามหมายจับ หมายศาล สืบหาคนหาย หาที่อยู่บุคคล ตามหาคนโกง โดนโกงออนไลน์ สืบพฤติกรรมบุตรหลาน สืบประวัติการก่ออาชญากรรม สืบประวัติบุคคลก่อนเข้าทำงาน สืบประวัติการเดินทางเข้าออกประเทศ ติดตามรถยนต์ เช็คการใช้งานโทรศัพท์ และอื่น ๆ — ข้อมูลทุกอย่างของลูกค้าจะถูกเก็บเป็นความลับ
          </p>
        </div>
      </section>

      {/* Services — case files */}
      <section id="services" className="mx-auto max-w-5xl px-4 py-16">
        <SectionHeading eyebrow="Active Cases · แฟ้มคดี" title="บริการของเรา" sub="กัดไม่ปล่อย เฝ้าไม่ถอย คอยไม่เลิก" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <Link key={s.slug} href={s.page!.path} className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/50">
              <CornerTicks />
              <div className="flex items-center justify-between">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition-colors group-hover:border-primary/60">
                  <s.Icon className="h-5 w-5" />
                </span>
                <FileTag>{`CASE ${String(i + 1).padStart(2, "0")}`}</FileTag>
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold group-hover:text-primary">{s.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.blurb}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-primary/80">
                เปิดสำนวน <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Why us — seals */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <SectionHeading eyebrow="Credentials · จุดเด่น" title="ทำไมต้องเรา" />
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {WHY.map((w) => (
              <div key={w.title} className="text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/40 bg-primary/5 text-primary shadow-[inset_0_0_0_4px_hsl(var(--primary)/0.08)]">
                  <w.Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-serif text-lg font-bold">{w.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process — evidence chain */}
      <section id="process" className="mx-auto max-w-3xl px-4 py-16">
        <SectionHeading eyebrow="Protocol · ขั้นตอน" title="ขั้นตอนการทำงาน" />
        <ol className="relative mt-10 space-y-6 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
          {PROCESS.map((step, i) => (
            <li key={i} className="relative flex items-start gap-4">
              <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-background font-mono text-sm font-semibold text-primary">
                {i + 1}
              </span>
              <span className="pt-1 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">* หากยกเลิกโดยผู้ว่าจ้าง จะไม่คืนเงินมัดจำ</p>
      </section>

      {/* Reviews — verified on Fastwork */}
      <section id="reviews" className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <SectionHeading eyebrow="Exhibits · ยืนยันบน Fastwork" title="รีวิวจากลูกค้า" sub="ขอขอบคุณลูกค้าทุกท่านที่ไว้วางใจ" />

          {/* Aggregate rating */}
          <div className="mx-auto mt-8 flex w-fit items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 px-6 py-4">
            <span className="font-serif text-4xl font-bold text-primary">{REVIEW_RATING}</span>
            <div className="flex flex-col">
              <span className="flex gap-0.5 text-primary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </span>
              <span className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{REVIEW_COUNT} รีวิว · Fastwork</span>
            </div>
          </div>

          {/* Testimonials */}
          <div className="mt-8 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((r, i) => (
              <figure key={i} className="relative overflow-hidden rounded-xl border border-border bg-card p-6">
                <CornerTicks />
                <div className="flex items-center justify-between">
                  <span className="flex gap-0.5 text-primary">
                    {Array.from({ length: r.stars }).map((_, s) => (
                      <Star key={s} className="h-3.5 w-3.5 fill-primary text-primary" />
                    ))}
                  </span>
                  <FileTag>{`EXHIBIT ${String.fromCharCode(65 + i)}`}</FileTag>
                </div>
                <blockquote className="mt-4 font-serif text-base leading-relaxed text-foreground/95">“{r.text}”</blockquote>
                <figcaption className="mt-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span className="h-px w-4 bg-primary/50" /> {r.name} · {r.date}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Articles — field notes */}
      {articles.length > 0 && (
        <section id="articles" className="mx-auto max-w-5xl px-4 py-16">
          <SectionHeading eyebrow="Field Notes · บันทึก" title="บทความที่น่าสนใจ" sub="เลื่อนดู →" />
          <div className="mt-8 flex gap-4 overflow-x-auto pb-3 [scrollbar-width:thin] snap-x">
            {articles.map((a) => (
              <Link key={a.slug} href={a.page!.path} className="group w-60 shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50">
                <img src={a.img} alt={a.page!.title} loading="lazy" className="aspect-video w-full object-cover" />
                <div className="p-3.5">
                  <h3 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">{a.page!.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="relative overflow-hidden border-t border-border/60 bg-card/30">
        <Crosshair aria-hidden className="pointer-events-none absolute -left-8 bottom-0 h-64 w-64 text-primary/[0.04]" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center">
          <Stamp className="mb-6">Confidential</Stamp>
          <SectionHeading eyebrow="Open a Case · เปิดคดี" title="เรา คือนักสืบเอกชน มืออาชีพ" sub="ปรึกษาเบื้องต้นได้ทุกเคส เป็นความลับ — ติดต่อทีมนักสืบของเราได้เลย" />
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="https://lin.ee/SSqk98x" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-90">
              <LineIcon className="h-5 w-5" /> LINE
            </a>
            <a href="https://api.whatsapp.com/send?phone=+66809188324" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-90">
              <WhatsAppIcon className="h-5 w-5" /> WhatsApp
            </a>
            <a href="https://www.facebook.com/Detectivepluse.th" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-90">
              <FacebookIcon className="h-5 w-5" /> Facebook
            </a>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
            <a href="tel:+66968461406" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-mono text-xs hover:bg-muted"><PhoneCall className="h-4 w-4 text-primary" /> 096 846 1406</a>
            <a href="tel:+66809188324" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-mono text-xs hover:bg-muted"><PhoneCall className="h-4 w-4 text-primary" /> +66 80 918 8324</a>
            <a href="mailto:detectivepluse@gmail.com" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-mono text-xs hover:bg-muted"><Mail className="h-4 w-4 text-primary" /> detectivepluse@gmail.com</a>
            {contact && (
              <Link href={contact.path} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"><MessageCircle className="h-4 w-4" /> ช่องทางทั้งหมด</Link>
            )}
          </div>
          <div className="mt-8 inline-flex flex-col items-center gap-2 rounded-xl border border-border bg-card/50 p-4">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[#07C160]"><WeChatIcon className="h-4 w-4" /> WeChat</span>
            <img src="/marketing/btn-wechat.jpg" alt="WeChat QR code" className="h-28 w-28 rounded-md border border-border" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">สแกนเพื่อเพิ่มเพื่อน</span>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
