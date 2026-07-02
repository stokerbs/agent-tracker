"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { EN_TO_TH, TH_TO_EN } from "@/lib/marketing/i18n";

/**
 * Marketing language switcher (TH ↔ EN ↔ 中文). TH/EN link to the counterpart of
 * the current page (falling back to the language's home when no translation
 * exists); ZH only has a home, so it always links to /zh.
 */
export function LangSwitch() {
  const pathname = usePathname() || "/";
  const onEN = pathname === "/en" || pathname.startsWith("/en/");
  const onZH = pathname === "/zh" || pathname.startsWith("/zh/");

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

  const active = "font-semibold text-foreground";
  const idle = "text-muted-foreground hover:text-foreground";
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Link href={thHref} className={!onEN && !onZH ? active : idle}>
        <span aria-hidden>🇹🇭</span> TH
      </Link>
      <span className="text-muted-foreground">/</span>
      <Link href={enHref} className={onEN ? active : idle}>
        <span aria-hidden>🇬🇧</span> EN
      </Link>
      <span className="text-muted-foreground">/</span>
      <Link href="/zh" className={onZH ? active : idle}>
        <span aria-hidden>🇨🇳</span> 中文
      </Link>
    </span>
  );
}
