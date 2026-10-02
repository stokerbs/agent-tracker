import Link from "next/link";
import { ArrowRight, CheckCircle2, XCircle, PhoneCall, ShieldCheck } from "lucide-react";
import { SectionHeading, FileTag, Stamp, CornerTicks, Eyebrow } from "@/components/marketing/ui";
import { Faq } from "@/components/marketing/faq";
import { Breadcrumb } from "@/components/marketing/breadcrumb";
import { LeadForm } from "@/components/marketing/lead-form";
import { TrackedLink } from "@/components/marketing/tracked-link";
import { LawfulScope } from "@/components/marketing/lawful-scope";
import { ServiceJsonLd } from "@/components/marketing/service-json-ld";
import { LineIcon, WhatsAppIcon } from "@/components/marketing/brand-icons";
import { CONTACT } from "@/lib/marketing/contact";
import { FACTS } from "@/lib/marketing/facts";
import { SampleReport } from "@/components/marketing/sample-report";
import type { MarketingServicePage } from "@/lib/marketing/pages";

export interface RelatedLink { href: string; title: string }

const UI = {
  th: {
    home: "หน้าแรก", services: "บริการ", info: "เกี่ยวกับเรา", locations: "พื้นที่ให้บริการ",
    lineCta: "ปรึกษาฟรีทาง LINE", waCta: "WhatsApp", callCta: "โทร", formCta: "ให้เราติดต่อกลับ",
    deliverables: "สิ่งที่คุณจะได้รับ", notOffered: "สิ่งที่เราไม่ทำ", notOfferedNote: "เราใช้เฉพาะวิธีที่ถูกกฎหมายและปฏิบัติตาม PDPA — ข้อมูลที่กฎหมายคุ้มครองเข้าถึงได้เฉพาะผ่านกระบวนการศาล",
    process: "ขั้นตอนการทำงาน", faqEyebrow: "Briefing · คำถามที่พบบ่อย", faq: "คำถามที่พบบ่อย",
    related: "หน้าที่เกี่ยวข้อง", ctaEyebrow: "Open a Case · เปิดคดี", ctaTitle: "ปรึกษาฟรี เป็นความลับ", ctaSub: "เล่าสถานการณ์ให้เราฟัง — ประเมินความเป็นไปได้และขอบเขตที่ทำได้ตามกฎหมายให้ก่อนเสนอราคา",
    cardTitle: "เริ่มต้นอย่างไร", since: "ตั้งแต่ปี", cases: "เคสที่ปิดแล้ว", rating: "คะแนนรีวิว",
    defaultProcess: [
      { step: "ปรึกษาเบื้องต้น", desc: "ทาง LINE หรือโทร ฟรี ไม่มีข้อผูกมัด" },
      { step: "ประเมินและเสนอราคา", desc: "แจ้งขอบเขตที่ทำได้ตามกฎหมาย ระยะเวลา และราคาเป็นลายลักษณ์อักษร" },
      { step: `ชำระมัดจำ ${FACTS.confirmed.depositPercent}%`, desc: "ยืนยันเริ่มงานตามแผน" },
      { step: "ดำเนินงานและอัปเดต", desc: "ทีมลงพื้นที่ อัปเดตความคืบหน้าตามรอบที่ตกลง" },
      { step: "ส่งมอบรายงาน", desc: "ชำระส่วนที่เหลือ รับรายงานพร้อมหลักฐานผ่านช่องทางที่คุณเลือก" },
    ],
  },
  en: {
    home: "Home", services: "Services", info: "About", locations: "Service areas",
    lineCta: "LINE", waCta: "Chat on WhatsApp", callCta: "Call", formCta: "Request a free assessment",
    deliverables: "What you receive", notOffered: "What we never do", notOfferedNote: "Lawful methods only, in line with Thailand's PDPA — legally protected records are available only through court process.",
    process: "How it works", faqEyebrow: "Briefing · FAQ", faq: "Frequently asked questions",
    related: "Related pages", ctaEyebrow: "Open a Case · Contact", ctaTitle: "Free, confidential assessment", ctaSub: "Tell us the situation — we assess feasibility and the lawful scope before any quote.",
    cardTitle: "How to start", since: "Since", cases: "cases closed", rating: "review rating",
    defaultProcess: [
      { step: "Free consultation", desc: "WhatsApp, phone or email — no obligation" },
      { step: "Assessment & written quote", desc: "Lawful scope, timeline and price in writing" },
      { step: `${FACTS.confirmed.depositPercent} % deposit`, desc: "Confirms the start date and plan" },
      { step: "Fieldwork & updates", desc: "Team deployed; updates on the schedule you choose" },
      { step: "Report delivery", desc: "Balance paid; report and evidence delivered through your chosen channel" },
    ],
  },
} as const;

/**
 * Renders a Thai/English registry page in the dossier style: breadcrumb →
 * hero with CTAs → sticky "how to start" card → sections → deliverables /
 * boundaries → process → FAQ (FAQPage JSON-LD) → lawful scope → related →
 * lead form. Server component; CTAs and the form are the client islands.
 */
export function ServicePage({ page, related }: { page: MarketingServicePage; related: RelatedLink[] }) {
  const t = UI[page.lang];
  const path = page.lang === "en" ? `/en/${page.slug}` : `/${page.slug}`;
  const homeHref = page.lang === "en" ? "/en" : "/";
  const contactHref = page.lang === "en" ? "/en/contact" : "/ติดต่อนักสืบ";
  const pricingHref = page.lang === "en" ? "/en/pricing" : "/ราคานักสืบ";
  const crumb = page.kind === "service" ? { name: t.services, href: `${homeHref}#services` } : page.kind === "location" ? { name: t.locations, href: `${homeHref}#areas` } : { name: t.info, href: homeHref };
  const primaryIsWa = page.lang === "en";
  const process = page.process ?? t.defaultProcess;

  return (
    <>
      <ServiceJsonLd page={page} url={`${CONTACT.siteUrl}${path}`} />

      {/* Hero */}
      <section className="dp-hero dp-scanline relative border-b border-border/60">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-10">
          <Breadcrumb items={[{ name: t.home, href: homeHref }, crumb, { name: page.h1 }]} />
          <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px] lg:items-start">
            <div className="max-w-3xl">
              <Eyebrow className="!justify-start">{page.eyebrow}</Eyebrow>
              <h1 className="mt-4 font-serif text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{page.h1}</h1>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{page.intro}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {primaryIsWa ? (
                  <TrackedLink href={CONTACT.whatsappUrl} placement="hero" className="inline-flex items-center gap-2 rounded-lg bg-[#178741] px-5 py-3 font-semibold text-white hover:opacity-90"><WhatsAppIcon className="h-5 w-5" /> {t.waCta}</TrackedLink>
                ) : (
                  <TrackedLink href={CONTACT.lineUrl} placement="hero" className="inline-flex items-center gap-2 rounded-lg bg-[#048739] px-5 py-3 font-semibold text-white hover:opacity-90"><LineIcon className="h-5 w-5" /> {t.lineCta}</TrackedLink>
                )}
                <a href="#contact" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90">{t.formCta} <ArrowRight className="h-4 w-4" /></a>
                <TrackedLink href={CONTACT.phoneTel} placement="hero" className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 font-medium hover:bg-muted"><PhoneCall className="h-4 w-4 text-primary" /> {t.callCta} {CONTACT.phoneDisplay}</TrackedLink>
              </div>
            </div>

            {/* How-to-start card (sticky on desktop) */}
            <aside className="relative rounded-2xl border border-primary/30 bg-card/70 p-5 lg:sticky lg:top-24">
              <CornerTicks />
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg font-bold">{t.cardTitle}</h2>
                <FileTag>{page.kind === "service" ? "Service" : page.kind === "location" ? "Area" : "Info"}</FileTag>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm">
                {process.slice(0, 5).map((p, i) => (
                  <li key={p.step} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/50 font-mono text-[10px] text-primary">{i + 1}</span>
                    <span><span className="font-medium">{p.step}</span><span className="text-muted-foreground"> — {p.desc}</span></span>
                  </li>
                ))}
              </ol>
              {page.priceNote && <p className="mt-4 rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{page.priceNote}</p>}
              <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> {t.since} {FACTS.confirmed.foundingYear}</span>
                <span>· {FACTS.confirmed.closedCases.toLocaleString("en-US")}+ {t.cases}</span>
                <span>· {FACTS.confirmed.reviews.rating}★ {t.rating}</span>
              </div>
              <Link href={pricingHref} className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">{page.lang === "en" ? "How pricing works" : "ดูโครงสร้างราคา"} <ArrowRight className="h-3.5 w-3.5" /></Link>
            </aside>
          </div>
        </div>
      </section>

      {/* Body sections */}
      {page.sections.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 py-14">
          {page.sections.map((s, i) => (
            <div key={s.heading} className={i > 0 ? "mt-12" : ""}>
              <h2 className="font-serif text-2xl font-bold tracking-tight">{s.heading}</h2>
              {s.body.map((p, j) => <p key={j} className="mt-4 leading-relaxed text-foreground/90">{p}</p>)}
              {s.bullets && s.bullets.length > 0 && (
                <ul className="mt-4 space-y-2 text-foreground/90">
                  {s.bullets.map((b) => <li key={b} className="relative pl-6 before:absolute before:left-0 before:text-primary before:content-['▸']">{b}</li>)}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Deliverables + boundaries */}
      {page.sampleReport && <SampleReport lang={page.lang} />}

      {(page.deliverables || page.notOffered) && (
        <section className="border-y border-border/60 bg-card/30">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-14 md:grid-cols-2">
            {page.deliverables && (
              <div className="relative rounded-xl border border-border bg-card p-6">
                <CornerTicks />
                <div className="flex items-center justify-between"><h2 className="font-serif text-xl font-bold">{t.deliverables}</h2><FileTag>Deliverables</FileTag></div>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {page.deliverables.map((d) => <li key={d} className="flex items-start gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span>{d}</span></li>)}
                </ul>
              </div>
            )}
            {page.notOffered && (
              <div className="relative rounded-xl border border-border bg-card p-6">
                <CornerTicks />
                <div className="flex items-center justify-between"><h2 className="font-serif text-xl font-bold">{t.notOffered}</h2><FileTag>Scope</FileTag></div>
                <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                  {page.notOffered.map((d) => <li key={d} className="flex items-start gap-2.5"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive/80" /><span>{d}</span></li>)}
                </ul>
                <p className="mt-4 text-xs text-muted-foreground">{t.notOfferedNote}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Process */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <SectionHeading eyebrow={`Protocol · ${t.process}`} title={t.process} />
        <ol className="relative mt-10 space-y-6 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
          {process.map((p, i) => (
            <li key={p.step} className="relative flex items-start gap-4">
              <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-background font-mono text-sm font-semibold text-primary">{i + 1}</span>
              <span className="pt-1 leading-relaxed"><span className="font-medium">{p.step}</span> <span className="text-muted-foreground">— {p.desc}</span></span>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      {page.faq.length > 0 && (
        <div className="border-t border-border/60 bg-card/30">
          <Faq items={page.faq} eyebrow={t.faqEyebrow} title={t.faq} />
        </div>
      )}

      {/* Lawful scope (site-wide boundary statement) */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <LawfulScope lang={page.lang} />
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-14">
          <h2 className="font-serif text-xl font-bold">{t.related}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <Link key={r.href} href={r.href} className="group rounded-xl border border-border bg-card p-4 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary">
                {r.title} <ArrowRight className="ml-1 inline h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="border-t border-border/60 bg-card/30 scroll-mt-24">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Stamp className="mb-6">Confidential</Stamp>
          <SectionHeading eyebrow={t.ctaEyebrow} title={t.ctaTitle} sub={t.ctaSub} />
          <div className="mt-8"><LeadForm lang={page.lang} defaultCaseType={page.caseType} /></div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
            {primaryIsWa ? (
              <>
                <TrackedLink href={CONTACT.whatsappUrl} placement="contact_section" className="inline-flex items-center gap-2 rounded-lg bg-[#178741] px-5 py-2.5 font-medium text-white hover:opacity-90"><WhatsAppIcon className="h-5 w-5" /> WhatsApp</TrackedLink>
                <TrackedLink href={CONTACT.lineUrl} placement="contact_section" className="inline-flex items-center gap-2 rounded-lg bg-[#048739] px-5 py-2.5 font-medium text-white hover:opacity-90"><LineIcon className="h-5 w-5" /> LINE</TrackedLink>
              </>
            ) : (
              <>
                <TrackedLink href={CONTACT.lineUrl} placement="contact_section" className="inline-flex items-center gap-2 rounded-lg bg-[#048739] px-5 py-2.5 font-medium text-white hover:opacity-90"><LineIcon className="h-5 w-5" /> LINE</TrackedLink>
                <TrackedLink href={CONTACT.whatsappUrl} placement="contact_section" className="inline-flex items-center gap-2 rounded-lg bg-[#178741] px-5 py-2.5 font-medium text-white hover:opacity-90"><WhatsAppIcon className="h-5 w-5" /> WhatsApp</TrackedLink>
              </>
            )}
            <TrackedLink href={CONTACT.phoneTel} placement="contact_section" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 font-mono text-xs hover:bg-muted"><PhoneCall className="h-4 w-4 text-primary" /> {CONTACT.phoneDisplay}</TrackedLink>
            <Link href={contactHref} className="inline-flex items-center gap-2 rounded-lg border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10">{page.lang === "en" ? "All contact options" : "ช่องทางทั้งหมด"}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
