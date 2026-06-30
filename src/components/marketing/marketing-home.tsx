/* eslint-disable @next/next/no-img-element -- static marketing assets in /public; next/image adds no value here */
import Link from "next/link";
import {
  Search, HeartCrack, Wallet, MapPin, Smartphone, UserSearch, ShieldCheck,
  PhoneCall, Mail, MessageCircle, ArrowRight, PlayCircle, Facebook,
} from "lucide-react";
import { SiteChrome } from "@/components/marketing/site-chrome";
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

const REVIEWS = ["/marketing/review1.png", "/marketing/review2.png", "/marketing/review3.png", "/marketing/review4.png", "/marketing/review5.png"];

const CONTACT_BTNS = [
  { href: "https://lin.ee/SSqk98x", img: "/marketing/btn-line.jpg", alt: "เพิ่มเพื่อน LINE" },
  { href: "https://api.whatsapp.com/send?phone=+66809188324", img: "/marketing/btn-whatsapp.jpg", alt: "WhatsApp" },
];

export function MarketingHome() {
  const services = SERVICES.map((s) => ({ ...s, page: getMarketingPage(s.slug) })).filter((s) => s.page);
  const articles = ARTICLES.map((a) => ({ ...a, page: getMarketingPage(a.slug) })).filter((a) => a.page);
  const contact = getMarketingPage("ติดต่อนักสืบ");

  return (
    <SiteChrome>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 text-center">
          <img src="/marketing/logo.png" alt="Detective Pulse" className="mx-auto mb-6 h-12 w-auto" />
          <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            นักสืบเอกชน <span className="text-primary">มืออาชีพ</span> รับงานสืบทั่วราชอาณาจักร
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            ด้วยประสบการณ์ที่สั่งสมมานาน พร้อมรางวัลการันตีความสำเร็จมากมาย และที่สำคัญ — ข้อมูลทุกอย่างของลูกค้าจะถูกเก็บเป็นความลับ
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="https://lin.ee/SSqk98x" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-90">
              <MessageCircle className="h-4 w-4" /> ปรึกษาฟรีทาง LINE
            </a>
            <a href="tel:+66968461406" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90">
              <PhoneCall className="h-4 w-4" /> โทรเลย
            </a>
            <a href="#contact" className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-5 py-2.5 font-medium hover:bg-muted">ช่องทางติดต่อ <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>

      {/* Video */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="mb-6 text-center text-xl font-bold sm:text-2xl">แนะนำ Detective Pulse</h2>
        <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-xl border border-border/60">
          <img src="/marketing/video-cover.png" alt="วิดีโอแนะนำ Detective Pulse" className="w-full" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
            <PlayCircle className="h-16 w-16 text-white drop-shadow-lg" />
          </span>
        </a>
      </section>

      {/* About */}
      <section id="about" className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">เกี่ยวกับเรา</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            นักสืบเอกชน Detective Pulse ให้บริการสืบข้อมูลด้านบุคคล เช่น การสืบชู้สาว สืบจับบุคคลตามหมายจับ หมายศาล สืบหาคนหาย หาที่อยู่บุคคล ตามหาคนโกง โดนโกงออนไลน์ สืบพฤติกรรมบุตรหลาน สืบประวัติการก่ออาชญากรรม สืบประวัติบุคคลก่อนเข้าทำงาน สืบประวัติการเดินทางเข้าออกประเทศ ติดตามรถยนต์ เช็คการใช้งานโทรศัพท์ และอื่น ๆ — ข้อมูลทุกอย่างของลูกค้าจะถูกเก็บเป็นความลับ
          </p>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-center text-xl font-bold sm:text-2xl">บริการของเรา</h2>
        <p className="mt-2 text-center text-sm font-medium text-primary">กัดไม่ปล่อย เฝ้าไม่ถอย คอยไม่เลิก</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Link key={s.slug} href={s.page!.path} className="group rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/40">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><s.Icon className="h-5 w-5" /></div>
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
              <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><w.Icon className="h-5 w-5" /></div>
              <h3 className="font-semibold">{w.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section id="process" className="mx-auto max-w-3xl px-4 py-14">
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
      </section>

      {/* Reviews */}
      <section id="reviews" className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-center text-xl font-bold sm:text-2xl">รีวิวจากลูกค้า</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">ขอขอบคุณลูกค้าทุกท่านที่ไว้วางใจ · เลื่อนดู →</p>
          <div className="mt-6 flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin] snap-x">
            {REVIEWS.map((src) => (
              <img key={src} src={src} alt="รีวิวลูกค้า" loading="lazy" className="h-40 w-auto shrink-0 snap-start rounded-lg border border-border/60" />
            ))}
          </div>
        </div>
      </section>

      {/* Articles */}
      {articles.length > 0 && (
        <section id="articles" className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-center text-xl font-bold sm:text-2xl">บทความที่น่าสนใจ</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">เลื่อนดู →</p>
          <div className="mt-6 flex gap-4 overflow-x-auto pb-3 [scrollbar-width:thin] snap-x">
            {articles.map((a) => (
              <Link key={a.slug} href={a.page!.path} className="group w-60 shrink-0 snap-start overflow-hidden rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/40">
                <img src={a.img} alt={a.page!.title} loading="lazy" className="aspect-video w-full object-cover" />
                <div className="p-3">
                  <h3 className="line-clamp-2 text-sm font-medium group-hover:text-primary">{a.page!.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">เรา คือนักสืบเอกชน มืออาชีพ</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">ปรึกษาเบื้องต้นได้ทุกเคส เป็นความลับ — ติดต่อทีมนักสืบของเราได้เลย</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {CONTACT_BTNS.map((b) => (
              <a key={b.href} href={b.href} target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-105">
                <img src={b.img} alt={b.alt} className="h-12 w-auto rounded-md" />
              </a>
            ))}
            <a href="https://www.facebook.com/Detectivepluse.th" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2.5 hover:bg-muted">
              <Facebook className="h-5 w-5 text-primary" /> Facebook
            </a>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
            <a href="tel:+66968461406" className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2 hover:bg-muted"><PhoneCall className="h-4 w-4 text-primary" /> 096 846 1406</a>
            <a href="tel:+66809188324" className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2 hover:bg-muted"><PhoneCall className="h-4 w-4 text-primary" /> +66 80 918 8324</a>
            <a href="mailto:detectivepluse@gmail.com" className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2 hover:bg-muted"><Mail className="h-4 w-4 text-primary" /> detectivepluse@gmail.com</a>
            {contact && (
              <Link href={contact.path} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"><MessageCircle className="h-4 w-4" /> ช่องทางทั้งหมด</Link>
            )}
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <img src="/marketing/btn-wechat.jpg" alt="WeChat QR" className="h-24 w-24 rounded-md border border-border/60" />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
