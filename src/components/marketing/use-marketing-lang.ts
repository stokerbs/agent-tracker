"use client";

import { usePathname } from "next/navigation";

export type MarketingLang = "th" | "en" | "zh";

/** Current marketing page language, from the URL (/en/*, /zh/*, else TH). */
export function useMarketingLang(): MarketingLang {
  const p = usePathname() || "/";
  if (p === "/en" || p.startsWith("/en/")) return "en";
  if (p === "/zh" || p.startsWith("/zh/")) return "zh";
  return "th";
}
