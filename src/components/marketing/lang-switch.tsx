"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, ChevronDown, Check } from "lucide-react";
import { EN_TO_TH, TH_TO_EN } from "@/lib/marketing/i18n";

/**
 * Marketing language switcher (TH / EN / 中文) as a compact dropdown — the button
 * shows the current language, opening a small menu of the three. Keeps the mobile
 * header tidy vs. three inline links. TH/EN link to the counterpart of the
 * current page (falling back to the language's home); ZH only has a home.
 */
export function LangSwitch() {
  const pathname = usePathname() || "/";
  const onEN = pathname === "/en" || pathname.startsWith("/en/");
  const onZH = pathname === "/zh" || pathname.startsWith("/zh/");
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

  let thHref = "/";
  let enHref = "/en";
  if (onEN) {
    enHref = pathname;
    const en = decodeURIComponent(pathname.replace(/^\/en\/?/, "").replace(/\/$/, ""));
    thHref = en && EN_TO_TH[en] ? `/${EN_TO_TH[en]}/` : "/";
  } else if (onZH) {
    thHref = "/";
    enHref = "/en";
  } else {
    thHref = pathname;
    const th = decodeURIComponent(pathname.replace(/^\//, "").replace(/\/$/, ""));
    enHref = th && TH_TO_EN[th] ? `/en/${TH_TO_EN[th]}` : "/en";
  }

  const current = onZH ? { flag: "🇨🇳", code: "中文" } : onEN ? { flag: "🇬🇧", code: "EN" } : { flag: "🇹🇭", code: "TH" };
  const options = [
    { key: "th", flag: "🇹🇭", label: "ไทย", href: thHref, active: !onEN && !onZH },
    { key: "en", flag: "🇬🇧", label: "English", href: enHref, active: onEN },
    { key: "zh", flag: "🇨🇳", label: "中文", href: "/zh", active: onZH },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="เปลี่ยนภาษา / Language"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Globe className="h-4 w-4" />
        <span aria-hidden>{current.flag}</span>
        <span className="font-medium text-foreground">{current.code}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-36 overflow-hidden rounded-lg border border-border/70 bg-card shadow-xl">
          {options.map((o) => (
            <Link
              key={o.key}
              href={o.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted ${o.active ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              <span aria-hidden className="text-base leading-none">{o.flag}</span>
              <span className="flex-1">{o.label}</span>
              {o.active && <Check className="h-3.5 w-3.5 text-primary" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
