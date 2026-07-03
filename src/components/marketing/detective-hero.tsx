import type { ReactNode } from "react";
import Image from "next/image";
import { Fingerprint, Crosshair } from "lucide-react";

type Cta = {
  href: string;
  label: string;
  icon?: ReactNode;
  /** Tailwind colour classes for this button (bg/text/border). */
  className: string;
  external?: boolean;
};

export type DetectiveHeroProps = {
  /** Mono "classified" bar */
  caseNo: string;
  statusLabel: string;
  recLabel: string;
  /** Headline */
  eyebrow: string;
  titleLead: string;
  titleAccent: string;
  titleRest: string;
  subtitle: string;
  /** Calls to action, rendered left→right. */
  ctas: Cta[];
  /** Mono footer line + scroll cue */
  tagline: string;
  scrollLabel: string;
};

/**
 * Cinematic "surveillance dossier" hero shared by the TH and EN marketing
 * homes. Pure CSS atmosphere + on-load entrance (see globals.css `.dp-hero*`) —
 * no client JS, so it adds zero main-thread blocking, and it only animates
 * opacity/transform so it introduces no layout shift.
 */
export function DetectiveHero(p: DetectiveHeroProps) {
  return (
    <section className="dp-hero dp-scanline relative border-b border-border/60">
      {/* Corner radar sweep */}
      <div aria-hidden className="dp-radar pointer-events-none absolute right-6 top-24 hidden h-40 w-40 opacity-50 lg:block">
        <div className="absolute inset-0 rounded-full border border-primary/25" />
        <div className="absolute inset-[20%] rounded-full border border-primary/20" />
        <div className="absolute inset-[42%] rounded-full border border-primary/15" />
        <Crosshair className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-primary/50" />
      </div>
      <Fingerprint aria-hidden className="pointer-events-none absolute -left-12 bottom-0 h-72 w-72 text-primary/[0.04]" />

      <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-14 text-center sm:pt-20">
        {/* Classified case-file bar */}
        <div
          className="dp-hero-in mx-auto mb-8 flex max-w-md items-center justify-between gap-3 rounded-md border border-primary/25 bg-black/30 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80"
          style={{ animationDelay: ".05s" }}
        >
          <span className="flex items-center gap-1.5"><span className="dp-blink text-primary">●</span> {p.recLabel}</span>
          <span className="hidden text-muted-foreground sm:inline">{p.caseNo}</span>
          <span>{p.statusLabel}</span>
        </div>

        {/* No entrance fade on the logo either: like the h1, it's an above-the-fold
            LCP candidate, so an opacity:0 start would delay LCP. It shares the
            "hero content paints instantly, chrome fades in" rhythm with the h1. */}
        <div className="mb-6 flex items-center justify-center">
          <Image src="/marketing/logo.png" alt="Detective Pulse" width={402} height={111} priority className="h-11 w-auto" />
        </div>

        <p
          className="dp-hero-in font-mono text-xs uppercase tracking-[0.3em] text-primary/80"
          style={{ animationDelay: ".18s" }}
        >
          {p.eyebrow}
        </p>

        {/* No entrance fade on the headline: it's the LCP element, so it must
            paint at full opacity immediately (opacity:0 → animation delays LCP).
            The decorative "declassify" bar on the accent word still animates. */}
        <h1 className="mx-auto mt-5 max-w-3xl text-balance font-serif text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
          {p.titleLead}{" "}
          <span className="dp-redact relative inline-block text-primary">{p.titleAccent}</span>
          <br className="hidden sm:block" /> {p.titleRest}
        </h1>

        <p
          className="dp-hero-in mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
          style={{ animationDelay: ".32s" }}
        >
          {p.subtitle}
        </p>

        <div className="dp-hero-in mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: ".4s" }}>
          {p.ctas.map((c) => (
            <a
              key={c.label}
              href={c.href}
              {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 transition-opacity hover:opacity-90 ${c.className}`}
            >
              {c.icon} {c.label}
            </a>
          ))}
        </div>

        <div
          className="dp-hero-in mt-10 flex flex-col items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
          style={{ animationDelay: ".5s" }}
        >
          <span className="text-primary/80">{p.tagline}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-muted-foreground/70" aria-hidden>
            {p.scrollLabel} <span className="dp-blink">▾</span>
          </span>
        </div>
      </div>
    </section>
  );
}
