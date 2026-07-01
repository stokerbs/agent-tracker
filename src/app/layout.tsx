import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import { GoogleTagManager } from "@next/third-parties/google";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import { SplashGate } from "@/components/layout/splash-gate";
import { PwaRegister } from "@/components/pwa-register";
import { isMarketingHost } from "@/lib/marketing/host";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});
// Vintage serif for the public marketing site (the "detective dossier" display
// face). preload:false so the app/dashboard pages don't fetch it — only the
// marketing pages that use the `font-serif` utility pull the glyphs.
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["500", "600", "700", "800"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://detectivepulse.com"),
  title: {
    default: "Detective Pulse — Operations Command Center",
    template: "%s · Detective Pulse",
  },
  description:
    "Operations management platform for private investigators, surveillance teams and field agents.",
  applicationName: "Detective Pulse",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Detective Pulse",
    url: "https://detectivepulse.com",
    title: "Detective Pulse — Operations Command Center",
    description:
      "Operations management platform for private investigators, surveillance teams and field agents.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Detective Pulse — Operations Command Center",
    description:
      "Operations management platform for private investigators, surveillance teams and field agents.",
  },
};

export async function generateViewport(): Promise<Viewport> {
  const host = (await headers()).get("host");
  const marketing = isMarketingHost(host);
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
    ],
    width: "device-width",
    initialScale: 1,
    // The public marketing site (detectivepulse.com) MUST allow pinch-zoom for
    // accessibility (WCAG 1.4.4) and mobile UX. Only the app host locks zoom so
    // it feels like a native app (map pinch-zoom is handled by the Maps API).
    ...(marketing ? {} : { maximumScale: 1, userScalable: false }),
    // Required so iOS safe-area-inset env() values are non-zero in the native shell.
    viewportFit: "cover",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  // Google Tag Manager — marketing site only (ad conversion tracking for
  // detectivepulse.com), inert unless NEXT_PUBLIC_GTM_ID is configured.
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const host = (await headers()).get("host");
  const showGtm = Boolean(gtmId) && isMarketingHost(host);

  return (
    <html lang={locale} suppressHydrationWarning>
      {showGtm && <GoogleTagManager gtmId={gtmId!} />}
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} font-sans antialiased`}>
        {showGtm && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <SplashGate />
            <PwaRegister />
            {children}
            <Toaster richColors position="top-right" closeButton />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
