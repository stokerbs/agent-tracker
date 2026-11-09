import { isMarketingHost } from "./host";

export type MarketingDocumentLanguage = "th" | "en" | "zh-CN";

/** Match whole URL segments, including the English advertising landing pages. */
export function marketingLanguageForPath(pathname: string): MarketingDocumentLanguage {
  if (pathname === "/zh" || pathname.startsWith("/zh/")) return "zh-CN";
  if (
    pathname === "/en" || pathname.startsWith("/en/") ||
    pathname === "/lp/en" || pathname.startsWith("/lp/en/")
  ) return "en";
  return "th";
}

/** The .com website follows its URL; other hosts retain the app locale. */
export function documentLanguage(host: string | null, forwarded: string | null, appLocale: string): string {
  if (!isMarketingHost(host)) return appLocale;
  return forwarded === "en" || forwarded === "zh-CN" ? forwarded : "th";
}
