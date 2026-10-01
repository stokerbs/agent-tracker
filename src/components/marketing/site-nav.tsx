"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LangSwitch } from "@/components/marketing/lang-switch";
import { WeChatCta } from "@/components/marketing/zh/wechat-cta";
import { useMarketingLang } from "@/components/marketing/use-marketing-lang";
import { ZH_NAV } from "@/lib/marketing/zh/nav";

/**
 * Header navigation, switched by the marketing language in the URL. Thai and
 * English keep the original three links; Chinese gets the full service menu
 * plus the WeChat CTA (the primary Chinese conversion path) in the header.
 */
export function SiteNav() {
  const lang = useMarketingLang();
  if (lang === "zh") return <ZhNav />;
  if (lang === "en") {
    return (
      <nav className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider text-muted-foreground sm:gap-5">
        <Link href="/en" className="hover:text-foreground">Home</Link>
        <Link href="/en/careers" className="hover:text-foreground">Careers</Link>
        <Link href="/en/contact" className="hover:text-foreground">Contact</Link>
        <LangSwitch />
      </nav>
    );
  }
  return (
    <nav className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider text-muted-foreground sm:gap-5">
      <Link href="/" className="hover:text-foreground">หน้าแรก</Link>
      <Link href="/careers" className="hover:text-foreground">ร่วมงาน</Link>
      <Link href="/ติดต่อนักสืบ/" className="hover:text-foreground">ติดต่อ</Link>
      <LangSwitch />
    </nav>
  );
}

function ZhNav() {
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
    <nav className="flex items-center gap-2.5 text-sm text-muted-foreground sm:gap-4">
      <div ref={ref} className="relative">
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1 hover:text-foreground">
          服务 <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-lg border border-border/70 bg-card shadow-xl">
            {ZH_NAV.services.map((s) => (
              <Link key={s.slug} href={`/zh/${s.slug}`} onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-muted hover:text-foreground">
                {s.label}
              </Link>
            ))}
          </div>
        )}
      </div>
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

/** Footer links by language (Chinese gets services + locations for crawl depth). */
export function SiteFooterLinks() {
  const lang = useMarketingLang();
  if (lang !== "zh") {
    return (
      <nav className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        <Link href="/careers" className="hover:text-primary">ร่วมงานกับเรา · Careers</Link>
        <span aria-hidden className="text-border">·</span>
        <Link href="/privacy" className="hover:text-primary">นโยบายความเป็นส่วนตัว</Link>
      </nav>
    );
  }
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
