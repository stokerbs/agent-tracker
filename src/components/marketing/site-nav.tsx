"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LangSwitch } from "@/components/marketing/lang-switch";
import { WeChatCta } from "@/components/marketing/zh/wechat-cta";
import { useMarketingLang } from "@/components/marketing/use-marketing-lang";
import { ZH_NAV } from "@/lib/marketing/zh/nav";
import { TH_NAV, EN_NAV, type NavLink } from "@/lib/marketing/nav";

/**
 * Header navigation, switched by the marketing language in the URL. Every
 * language gets a Services dropdown (the six core service pages), the primary
 * links and the language switcher; Chinese additionally gets the WeChat CTA
 * (its primary conversion path). All hrefs are decoded, non-trailing-slash
 * paths so no click lands on a 308.
 */
export function SiteNav() {
  const lang = useMarketingLang();
  if (lang === "zh") return <ZhNav />;
  const nav = lang === "en" ? EN_NAV : TH_NAV;
  return (
    <nav className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider text-muted-foreground sm:gap-5">
      <ServicesDropdown label={lang === "en" ? "Services" : "บริการ"} items={nav.services} />
      {nav.primary.map((l, i) => (
        <Link key={l.href} href={l.href} className={`hover:text-foreground ${i < nav.primary.length - 1 ? "hidden md:inline" : ""}`}>
          {l.label}
        </Link>
      ))}
      <LangSwitch />
    </nav>
  );
}

/** Click-to-open dropdown (closes on outside click). Shared by all languages. */
function ServicesDropdown({ label, items }: { label: string; items: readonly NavLink[] | readonly { slug: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" className="inline-flex items-center gap-1 hover:text-foreground">
        {label} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-lg border border-border/70 bg-card shadow-xl normal-case tracking-normal">
          {items.map((s) => {
            const href = "href" in s ? s.href : `/zh/${s.slug}`;
            return (
              <Link key={href} href={href} role="menuitem" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm hover:bg-muted hover:text-foreground">
                {s.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ZhNav() {
  return (
    <nav className="flex items-center gap-2.5 text-sm text-muted-foreground sm:gap-4">
      <ServicesDropdown label="服务" items={ZH_NAV.services} />
      <Link href="/zh/how-it-works" className="hidden hover:text-foreground md:inline">流程</Link>
      <Link href="/zh/pricing" className="hidden hover:text-foreground md:inline">收费</Link>
      <Link href="/zh/about" className="hidden hover:text-foreground lg:inline">关于</Link>
      <Link href="/zh/contact" className="hover:text-foreground">联系</Link>
      <span className="hidden sm:inline">
        <WeChatCta placement="header" variant="compact" />
      </span>
      <LangSwitch />
    </nav>
  );
}

/** Footer links by language: services + primary for crawl depth (all languages). */
export function SiteFooterLinks() {
  const lang = useMarketingLang();
  if (lang === "zh") {
    return (
      <div className="mt-2 space-y-2 text-[12px] text-muted-foreground">
        <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {ZH_NAV.services.map((s) => (
            <Link key={s.slug} href={`/zh/${s.slug}`} className="hover:text-primary">{s.label}</Link>
          ))}
        </nav>
        <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {ZH_NAV.locations.map((s) => (
            <Link key={s.slug} href={`/zh/${s.slug}`} className="hover:text-primary">{s.label}</Link>
          ))}
        </nav>
        <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider">
          {ZH_NAV.primary.map((s) => (
            <Link key={s.slug} href={`/zh/${s.slug}`} className="hover:text-primary">{s.label}</Link>
          ))}
          <Link href="/privacy" className="hover:text-primary">隐私政策</Link>
        </nav>
      </div>
    );
  }
  const nav = lang === "en" ? EN_NAV : TH_NAV;
  return (
    <div className="mt-2 space-y-2 text-[12px] text-muted-foreground">
      <nav aria-label={lang === "en" ? "Services" : "บริการ"} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {nav.services.map((s) => (
          <Link key={s.href} href={s.href} className="hover:text-primary">{s.label}</Link>
        ))}
      </nav>
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider">
        {[...nav.primary.filter((l) => !nav.footer.some((f) => f.href === l.href)), ...nav.footer].map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-primary">{l.label}</Link>
        ))}
      </nav>
    </div>
  );
}
