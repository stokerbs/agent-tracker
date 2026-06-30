import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import { SplashGate } from "@/components/layout/splash-gate";
import { PwaRegister } from "@/components/pwa-register";
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
  width: "device-width",
  initialScale: 1,
  // Lock page zoom so the app feels fixed (no browser-style pinch-zoom). Map
  // pinch-zoom is handled by the Maps API on its own container and is unaffected.
  maximumScale: 1,
  userScalable: false,
  // Required so iOS safe-area-inset env() values are non-zero in the native shell.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} font-sans antialiased`}>
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
