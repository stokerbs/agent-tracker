import Script from "next/script";

/**
 * GA4 tag for the public marketing site. Renders nothing (loads no script) when
 * `NEXT_PUBLIC_GA_ID` is unset, so the site ships analytics-free by default and
 * only starts collecting once an ID is configured in the environment. Mounted
 * from the marketing SiteChrome, so it never runs on the private app host.
 */
export function MarketingAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim();
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}', { anonymize_ip: true });`}
      </Script>
    </>
  );
}
