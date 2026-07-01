import type { Viewport } from "next";
import { SiteChrome } from "@/components/marketing/site-chrome";

/**
 * Public marketing site chrome (detectivepulse.com). Separate from the app
 * (dashboard/portal) layouts — these pages are indexable, content-first, no auth.
 */

// The root layout locks page zoom (maximumScale:1, userScalable:false) so the
// app feels like a native shell. That hurts accessibility/SEO on the public
// content pages, so re-enable pinch-zoom for the marketing route group.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
