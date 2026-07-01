import Link from "next/link";
import Image from "next/image";
import {
  Search, HeartCrack, Wallet, MapPin, Smartphone, UserSearch, ShieldCheck,
  PhoneCall, ArrowRight, PlayCircle, Crosshair, Fingerprint, Star,
} from "lucide-react";
import { Eyebrow, SectionHeading, FileTag, Stamp, CornerTicks } from "@/components/marketing/ui";
import { ArticleCover } from "@/components/marketing/article-cover";
import { Faq } from "@/components/marketing/faq";
import { LeadForm } from "@/components/marketing/lead-form";
import { MarketingJsonLd } from "@/components/marketing/json-ld";
import { LineIcon, WhatsAppIcon, FacebookIcon } from "@/components/marketing/brand-icons";
import { getMarketingPageEN } from "@/lib/marketing/content";
import { FAQ_EN } from "@/lib/marketing/faq";

const YOUTUBE_URL = "https://www.youtube.com/watch?v=-sYx6i8OBF0";

const SERVICES: { slug: string; label: string; blurb: string; Icon: typeof Search }[] = [
  { slug: "cheating-spouse-investigator", label: "Cheating Spouse", blurb: "Discreetly track a partner's behaviour and gather court-admissible evidence.", Icon: HeartCrack },
  { slug: "asset-investigation", label: "Asset Investigation", blurb: "Trace and verify a debtor's assets before you sue or enforce a judgment.", Icon: Wallet },
  { slug: "background-check", label: "Background Check", blurb: "Verify a person's history and credibility before you trust or hire.", Icon: UserSearch },
  { slug: "find-missing-person", label: "Find a Person", blurb: "Locate missing people, lost relatives, or a debtor in hiding.", Icon: MapPin },
  { slug: "cyber-investigation", label: "Cyber Investigation", blurb: "Social media, online fraud, and digital footprint investigations.", Icon: Smartphone },
  { slug: "hire-a-private-detective", label: "Hire a Detective", blurb: "Services, process and pricing — how to hire a pro you can trust.", Icon: Search },
];

const PROCESS = ["Discuss your case", "Agree on the price", "Pay the first instalment (50%)", "We begin the investigation", "Final payment before results are handed over"];

const WHY = [
  { Icon: ShieldCheck, title: "Confidential", desc: "Every client's information is kept strictly confidential." },
  { Icon: Search, title: "Professional", desc: "Experienced investigators with a proven track record." },
  { Icon: MapPin, title: "Nationwide", desc: "We take on cases across the whole of Thailand." },
];

// Verified customer reviews from the firm's Fastwork profile.
const REVIEW_RATING = "4.8";
const REVIEW_COUNT = 63;
const TESTIMONIALS: { name: string; date: string; stars: number; text: string }[] = [
  { name: "pingpong27", date: "07/02/2026", stars: 5, text: "Fast and 100% accurate. Far quicker than promised — they said 1–2 days, but I had the complete, correct information in under half a day." },
  { name: "Nattavara", date: "13/01/2026", stars: 5, text: "I was stunned by how much they uncovered — genuinely deep detail on the person. Highly recommend." },
  { name: "Fastwork client", date: "10/06/2026", stars: 5, text: "Excellent service — really impressed with the team, constant updates throughout. I honestly recommend them to anyone looking to hire." },
  { name: "Fastwork client", date: "25/12/2025", stars: 4, text: "Great work and great advice. The results exceeded expectations — you can trust them completely." },
  { name: "Ada", date: "04/02/2026", stars: 5, text: "Good finding." },
  { name: "Fastwork client", date: "15/08/2025", stars: 5, text: "Truly professional." },
];

// Informational articles for the homepage row — distinct from the six service
// cards so the section adds new content rather than duplicating them.
const ARTICLE_SLUGS = [
  "hire-a-detective-online",
  "online-fraud-investigation",
  "qualities-of-a-good-detective",
  "private-detective-pricing",
  "investigate-partner-before-marriage",
  "what-is-a-detective-agency",
];

export function MarketingHomeEN() {
  const services = SERVICES.map((s) => ({ ...s, page: getMarketingPageEN(s.slug) })).filter((s) => s.page);
  const articles = ARTICLE_SLUGS.map((slug) => getMarketingPageEN(slug)).filter((p) => p != null);
  const contact = getMarketingPageEN("contact");

  return (
    <>
      <MarketingJsonLd faq={FAQ_EN} />
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <Fingerprint aria-hidden className="pointer-events-none absolute -right-10 top-10 h-72 w-72 text-primary/[0.04]" />
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center">
          <Image src="/marketing/logo.png" alt="Detective Pulse" width={402} height={111} priority className="mx-auto mb-6 h-11 w-auto" />
          <Eyebrow>Case File · Investigation Opened</Eyebrow>
          <h1 className="mx-auto mt-5 max-w-3xl text-balance font-serif text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
            Professional <span className="text-primary">Private Investigators</span> in Thailand
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Infidelity, asset searches, missing persons, background checks and cyber investigations — clear evidence, gathered professionally and in complete confidence.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href="https://lin.ee/SSqk98x" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#048739] px-5 py-2.5 font-medium text-white hover:opacity-90">
              <LineIcon className="h-5 w-5" /> Free consult on LINE
            </a>
            <a href="https://api.whatsapp.com/send?phone=+66809188324" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#178741] px-5 py-2.5 font-semibold text-white hover:opacity-90">
              <WhatsAppIcon className="h-5 w-5" /> WhatsApp us
            </a>
            <a href="#contact" className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-muted">Contact <ArrowRight className="h-4 w-4" /></a>
          </div>
          <div className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-primary/80">{"// Relentless · discreet · nationwide"}</div>
        </div>
      </section>

      {/* Video */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <SectionHeading eyebrow="Evidence Reel · Intro" title="About Detective Pulse" />
        <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="group relative mt-8 block overflow-hidden rounded-xl border border-border bg-card">
          <CornerTicks />
          <Image src="/marketing/video-cover.png" alt="Detective Pulse intro video" width={600} height={369} sizes="(max-width: 768px) 100vw, 768px" className="h-auto w-full" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 transition-colors group-hover:bg-black/45">
            <PlayCircle className="h-16 w-16 text-white drop-shadow-lg transition-transform group-hover:scale-110" />
          </span>
          <span className="absolute left-3 top-3"><FileTag>REC ●</FileTag></span>
        </a>
      </section>

      {/* Services — case files */}
      <section id="services" className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <SectionHeading eyebrow="Active Cases · Services" title="Our Services" />
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
                  Open file <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why us — seals */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <SectionHeading eyebrow="Credentials · Why us" title="Why Detective Pulse" />
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
      </section>

      {/* Process — evidence chain */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <SectionHeading eyebrow="Protocol · How it works" title="How It Works" />
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
          <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">* If the client cancels, the deposit is non-refundable.</p>
        </div>
      </section>

      {/* Reviews — verified on Fastwork */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <SectionHeading eyebrow="Exhibits · Verified on Fastwork" title="Client Reviews" sub="Thank you to all our clients · scroll →" />

        {/* Aggregate rating */}
        <div className="mx-auto mt-8 flex w-fit items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 px-6 py-4">
          <span className="font-serif text-4xl font-bold text-primary">{REVIEW_RATING}</span>
          <div className="flex flex-col">
            <span className="flex gap-0.5 text-primary">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-primary text-primary" />
              ))}
            </span>
            <span className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{REVIEW_COUNT} reviews · Fastwork</span>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mt-8 flex items-stretch gap-4 overflow-x-auto pb-3 [scrollbar-width:thin] snap-x">
          {TESTIMONIALS.map((r, i) => (
            <figure key={i} className="relative flex w-72 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-card p-6">
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
              <figcaption className="mt-auto flex items-center gap-2 pt-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <span className="h-px w-4 bg-primary/50" /> {r.name} · {r.date}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Articles — field notes */}
      <section id="articles" className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <SectionHeading eyebrow="Field Notes · Guides" title="Articles &amp; Guides" sub="scroll →" />
          <div className="mt-8 flex gap-4 overflow-x-auto pb-3 [scrollbar-width:thin] snap-x">
            {articles.map((p, i) => (
              <Link key={p!.slug} href={p!.path} className="group w-60 shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50">
                <ArticleCover slug={p!.slug} title={p!.title} index={i} lang="en" />
                <div className="p-3.5">
                  <h3 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">{p!.title}</h3>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/en/articles" className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-primary hover:bg-primary/10">
              View all articles <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <div className="border-t border-border/60">
        <Faq items={FAQ_EN} eyebrow="Briefing · FAQ" title="Frequently Asked Questions" />
      </div>

      {/* Contact */}
      <section id="contact" className="relative overflow-hidden border-t border-border/60 bg-card/30">
        <Crosshair aria-hidden className="pointer-events-none absolute -left-8 bottom-0 h-64 w-64 text-primary/[0.04]" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center">
          <Stamp className="mb-6">Confidential</Stamp>
          <SectionHeading eyebrow="Open a Case · Contact" title="Need the truth? We can help." sub="Free initial consultation, every case confidential — leave your details or chat with us directly." />
          <div className="mt-8">
            <LeadForm lang="en" />
          </div>
          <div className="mt-8 flex items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-px w-8 bg-border" /> or chat directly <span className="h-px w-8 bg-border" />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
            <a href="https://lin.ee/SSqk98x" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#048739] px-5 py-2.5 font-medium text-white hover:opacity-90"><LineIcon className="h-5 w-5" /> LINE</a>
            <a href="https://api.whatsapp.com/send?phone=+66809188324" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#178741] px-5 py-2.5 font-medium text-white hover:opacity-90"><WhatsAppIcon className="h-5 w-5" /> WhatsApp</a>
            <a href="https://www.facebook.com/Detectivepluse.th" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#1772e8] px-5 py-2.5 font-medium text-white hover:opacity-90"><FacebookIcon className="h-5 w-5" /> Facebook</a>
            <a href="tel:+66809188324" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 font-mono text-xs hover:bg-muted"><PhoneCall className="h-4 w-4 text-primary" /> +66 80 918 8324</a>
            {contact && (
              <Link href={contact.path} className="inline-flex items-center gap-2 rounded-lg border border-primary/40 px-4 py-2.5 font-medium text-primary hover:bg-primary/10">All contact options</Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
