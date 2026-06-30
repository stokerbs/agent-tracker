import { SiteChrome } from "@/components/marketing/site-chrome";

/**
 * Public marketing site chrome (detectivepulse.com). Separate from the app
 * (dashboard/portal) layouts — these pages are indexable, content-first, no auth.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
