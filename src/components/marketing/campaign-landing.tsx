import { CheckCircle2, PhoneCall, ShieldCheck, Star } from "lucide-react";
import { DetectiveHero } from "@/components/marketing/detective-hero";
import { SectionHeading, Stamp, CornerTicks } from "@/components/marketing/ui";
import { Faq } from "@/components/marketing/faq";
import { LeadForm } from "@/components/marketing/lead-form";
import { LineIcon, WhatsAppIcon } from "@/components/marketing/brand-icons";
import { TrackedLink } from "@/components/marketing/tracked-link";
import type { LandingPage } from "@/lib/marketing/landing-pages";
import { CONTACT } from "@/lib/marketing/contact";
import { FACTS } from "@/lib/marketing/facts";

const cases = FACTS.confirmed.closedCases.toLocaleString("en-US");
const rating = FACTS.confirmed.reviews.rating;

const UI = {
  th: {
    statusLabel: "แฟ้มเปิดอยู่",
    eyebrow: "ปรึกษาฟรี · เป็นความลับ",
    tagline: `// ปิดกว่า ${cases} เคส · คะแนน ${rating}/5 · ทั่วราชอาณาจักร`,
    scroll: "เลื่อนลงดูรายละเอียด",
    why: "ทำไมต้องเรา",
    closed: `ปิดแล้วกว่า ${cases} เคส`,
    confidential: "เป็นความลับ",
    deliverablesEyebrow: "Deliverables · สิ่งที่คุณจะได้รับ",
    deliverables: "สิ่งที่คุณจะได้รับ",
    faqEyebrow: "Briefing · คำถามที่พบบ่อย",
    faq: "คำถามที่พบบ่อย",
    contactEyebrow: "เปิดเคส · ติดต่อเรา",
    contact: "ปรึกษาฟรี ไม่มีค่าใช้จ่าย",
    primaryCta: "ปรึกษาฟรีทาง LINE",
    call: (n: string) => `โทรเลย ${n}`,
  },
  en: {
    statusLabel: "FILE OPEN",
    eyebrow: "Free consultation · Confidential",
    tagline: `// ${cases}+ cases closed · ${rating}/5 on ${FACTS.confirmed.reviews.source} · Since ${FACTS.confirmed.foundingYear}`,
    scroll: "Scroll for details",
    why: "Why us",
    closed: `${cases}+ cases closed`,
    confidential: "Confidential",
    deliverablesEyebrow: "Deliverables · What you get",
    deliverables: "What you get",
    faqEyebrow: "Briefing · FAQ",
    faq: "Frequently asked questions",
    contactEyebrow: "Open a case · Contact us",
    contact: "Free, confidential consultation",
    primaryCta: "Free consult on WhatsApp",
    call: (n: string) => `Call ${n}`,
  },
} as const;

/**
 * Shared renderer for the noindexed Google Ads landing pages (/lp/<slug> in
 * Thai, /lp/en/<slug> in English). Primary chat channel follows the audience:
 * LINE for Thai visitors, WhatsApp for English visitors.
 */
export function CampaignLanding({ lp }: { lp: LandingPage }) {
  const t = UI[lp.lang];
  const chat = lp.lang === "en"
    ? { href: CONTACT.whatsappUrl, label: t.primaryCta, icon: <WhatsAppIcon className="h-5 w-5" />, className: "bg-[#178741] font-medium text-white" }
    : { href: CONTACT.lineUrl, label: t.primaryCta, icon: <LineIcon className="h-5 w-5" />, className: "bg-[#048739] font-medium text-white" };

  return (
    <>
      <DetectiveHero
        caseNo="CASE FILE №DP-∞"
        statusLabel={t.statusLabel}
        recLabel="REC"
        eyebrow={t.eyebrow}
        titleLead={lp.headlineLead}
        titleAccent={lp.headlineAccent}
        titleRest=""
        subtitle={lp.sub}
        ctas={[
          { ...chat, external: true },
          { href: CONTACT.phoneTel, label: t.call(CONTACT.phoneDisplay), icon: <PhoneCall className="h-4 w-4" />, className: "bg-primary font-semibold text-primary-foreground" },
        ]}
        tagline={t.tagline}
        scrollLabel={t.scroll}
      />

      {/* Benefits */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <SectionHeading eyebrow={t.why} title={lp.benefitsTitle} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {lp.benefits.map((b) => (
            <div key={b} className="flex items-start gap-3 rounded-xl border border-border bg-card p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm leading-relaxed">{b}</span>
            </div>
          ))}
        </div>

        {/* Trust strip — figures from the facts registry only */}
        <div className="mx-auto mt-8 flex w-fit flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-xl border border-primary/30 bg-primary/5 px-6 py-4 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-primary">
            <Star className="h-4 w-4 fill-primary" /> {rating}/5
          </span>
          <span className="text-muted-foreground">{t.closed}</span>
          <span className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> {t.confidential}</span>
        </div>
      </section>

      {/* What you get */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <SectionHeading eyebrow={t.deliverablesEyebrow} title={t.deliverables} />
          <div className="relative mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <CornerTicks />
            <ul className="space-y-3">
              {lp.deliverables.map((d) => (
                <li key={d} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm leading-relaxed">{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <div className="border-b border-border/60">
        <Faq items={lp.faq} eyebrow={t.faqEyebrow} title={t.faq} />
      </div>

      {/* Lead form */}
      <section id="contact" className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <Stamp className="mb-6">Confidential</Stamp>
          <SectionHeading eyebrow={t.contactEyebrow} title={t.contact} sub={lp.formIntro} />
          <div className="mt-8">
            <LeadForm lang={lp.lang} />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
            {lp.lang === "en" ? (
              <>
                <TrackedLink href={CONTACT.whatsappUrl} placement="lp" className="inline-flex items-center gap-2 rounded-lg bg-[#178741] px-5 py-2.5 font-medium text-white hover:opacity-90"><WhatsAppIcon className="h-5 w-5" /> WhatsApp</TrackedLink>
                <TrackedLink href={CONTACT.lineUrl} placement="lp" className="inline-flex items-center gap-2 rounded-lg bg-[#048739] px-5 py-2.5 font-medium text-white hover:opacity-90"><LineIcon className="h-5 w-5" /> LINE</TrackedLink>
              </>
            ) : (
              <>
                <TrackedLink href={CONTACT.lineUrl} placement="lp" className="inline-flex items-center gap-2 rounded-lg bg-[#048739] px-5 py-2.5 font-medium text-white hover:opacity-90"><LineIcon className="h-5 w-5" /> LINE</TrackedLink>
                <TrackedLink href={CONTACT.whatsappUrl} placement="lp" className="inline-flex items-center gap-2 rounded-lg bg-[#178741] px-5 py-2.5 font-medium text-white hover:opacity-90"><WhatsAppIcon className="h-5 w-5" /> WhatsApp</TrackedLink>
              </>
            )}
            <TrackedLink href={CONTACT.phoneTel} placement="lp" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 font-mono text-xs hover:bg-muted"><PhoneCall className="h-4 w-4 text-primary" /> {CONTACT.phoneDisplay}</TrackedLink>
          </div>
        </div>
      </section>
    </>
  );
}
