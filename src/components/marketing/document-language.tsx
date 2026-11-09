"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isMarketingHost } from "@/lib/marketing/host";
import { marketingLanguageForPath } from "@/lib/marketing/document-language";

/** Root layouts persist across Link navigation, so update their lang as well. */
export function MarketingDocumentLanguage() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname && isMarketingHost(window.location.host)) {
      document.documentElement.lang = marketingLanguageForPath(pathname);
    }
  }, [pathname]);
  return null;
}
