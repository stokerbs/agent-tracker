"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { EN_TO_TH, TH_TO_EN } from "@/lib/marketing/i18n";

/**
 * Marketing language switcher (TH ↔ EN). Each link points to the counterpart of
 * the current page in that language; falls back to the other language's home
 * when no translation exists.
 */
export function LangSwitch() {
  const pathname = usePathname() || "/";
  const onEN = pathname === "/en" || pathname.startsWith("/en/");

  let thHref = "/";
  let enHref = "/en";
  if (onEN) {
    enHref = pathname;
    const en = decodeURIComponent(pathname.replace(/^\/en\/?/, "").replace(/\/$/, ""));
    thHref = en && EN_TO_TH[en] ? `/${EN_TO_TH[en]}/` : "/";
  } else {
    thHref = pathname;
    const th = decodeURIComponent(pathname.replace(/^\//, "").replace(/\/$/, ""));
    enHref = th && TH_TO_EN[th] ? `/en/${TH_TO_EN[th]}` : "/en";
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Link href={thHref} className={onEN ? "text-muted-foreground hover:text-foreground" : "font-semibold text-foreground"}>
        <span aria-hidden>🇹🇭</span> TH
      </Link>
      <span className="text-muted-foreground">/</span>
      <Link href={enHref} className={onEN ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}>
        <span aria-hidden>🇬🇧</span> EN
      </Link>
    </span>
  );
}
