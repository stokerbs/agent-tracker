/* eslint-disable @next/next/no-img-element -- static marketing assets in /public */
import Link from "next/link";
import {
  Search, HeartCrack, Wallet, MapPin, Smartphone, UserSearch, ShieldCheck,
  PhoneCall, ArrowRight, PlayCircle, MessageCircle,
} from "lucide-react";
import { getMarketingPageEN } from "@/lib/marketing/content";

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

const REVIEWS = ["/marketing/review1.png", "/marketing/review2.png", "/marketing/review3.png", "/marketing/review4.png", "/marketing/review5.png"];

export function MarketingHomeEN() {
  const services = SERVICES.map((s) => ({ ...s, page: getMarketingPageEN(s.slug) })).filter((s) => s.page);
  const contact = getMarketingPageEN("contact");

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 text-center">
          <img src="/marketing/logo.png" alt="Detective Pulse" className="mx-auto mb-6 h-12 w-auto" />
          <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            Professional <span className="text-primary">Private Investigators</span> in Thailand
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            Infidelity, asset searches, missing persons, background checks and cyber investigations — clear evidence, gathered professionally and in complete confidence.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="https://lin.ee/SSqk98x" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-5 py-2.5 font-medium text-white hover:opacity-90">
              <MessageCircle className="h-4 w-4" /> Free consult on LINE
            </a>
            <a href="https://api.whatsapp.com/send?phone=+66809188324" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:opacity-90">
              <PhoneCall className="h-4 w-4" /> WhatsApp us
            </a>
            <a href="#contact" className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-5 py-2.5 font-medium hover:bg-muted">Contact <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>

      {/* Video */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="mb-6 text-center text-xl font-bold sm:text-2xl">About Detective Pulse</h2>
        <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-xl border border-border/60">
          <img src="/marketing/video-cover.png" alt="Detective Pulse intro video" className="w-full" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
            <PlayCircle className="h-16 w-16 text-white drop-shadow-lg" />
          </span>
        </a>
      </section>

      {/* Services */}
      <section id="services" className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-center text-xl font-bold sm:text-2xl">Our Services</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <Link key={s.slug} href={s.page!.path} className="group rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/40">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><s.Icon className="h-5 w-5" /></div>
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
            <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><w.Icon className="h-5 w-5" /></div>
            <h3 className="font-semibold">{w.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{w.desc}</p>
          </div>
        ))}
      </section>

      {/* Process */}
      <section className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-center text-xl font-bold sm:text-2xl">How It Works</h2>
          <ol className="mt-8 space-y-4">
            {PROCESS.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-center text-sm text-muted-foreground">* If the client cancels, the deposit is non-refundable.</p>
        </div>
      </section>

      {/* Reviews */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-center text-xl font-bold sm:text-2xl">Client Reviews</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">Thank you to all our clients · scroll →</p>
        <div className="mt-6 flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin] snap-x">
          {REVIEWS.map((src) => (
            <img key={src} src={src} alt="Client review" loading="lazy" className="h-40 w-auto shrink-0 snap-start rounded-lg border border-border/60" />
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">Need the truth? We can help.</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Free initial consultation, every case confidential — reach our investigators directly.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
            <a href="https://lin.ee/SSqk98x" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-4 py-2 font-medium text-white hover:opacity-90"><MessageCircle className="h-4 w-4" /> LINE</a>
            <a href="https://api.whatsapp.com/send?phone=+66809188324" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 font-medium text-white hover:opacity-90"><PhoneCall className="h-4 w-4" /> WhatsApp</a>
            <a href="tel:+66809188324" className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2 hover:bg-muted"><PhoneCall className="h-4 w-4 text-primary" /> +66 80 918 8324</a>
            {contact && (
              <Link href={contact.path} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90">All contact options</Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
