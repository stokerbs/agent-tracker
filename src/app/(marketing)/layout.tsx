import type { Metadata } from "next";
import { SiteChrome } from "@/components/marketing/site-chrome";

/**
 * Public marketing site chrome (detectivepulse.com). Separate from the app
 * (dashboard/portal) layouts — these pages are indexable, content-first, no auth.
 */
// Every marketing page gets exactly one brand suffix. Pages pass a plain
// title (no "| Detective Pulse"); the root layout's "· Detective Pulse"
// template is overridden here so titles are never double-branded.
export const metadata: Metadata = {
  title: { template: "%s | Detective Pulse", default: "Detective Pulse" },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
