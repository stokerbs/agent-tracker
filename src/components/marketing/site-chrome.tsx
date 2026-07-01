import Link from "next/link";
import { Crosshair } from "lucide-react";
import { ContactFab } from "@/components/marketing/contact-fab";
import { LangSwitch } from "@/components/marketing/lang-switch";
import { FooterDirectory } from "@/components/marketing/footer-directory";
import { MarketingAnalytics } from "@/components/marketing/analytics";
import { ConversionTracker } from "@/components/marketing/conversion-tracker";

/**
 * Shared public marketing chrome (header + footer) for detectivepulse.com.
 * Wraps the page in the `.theme-detective` palette (FBI × Sherlock dossier look)
 * and lays down the surveillance backdrop (grid + grain + vignette) behind all
 * content. Used by the (marketing) route-group layout and the homepage.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-detective relative min-h-screen overflow-hidden bg-background font-sans text-foreground">
      {/* Surveillance backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="dp-grid absolute inset-0" />
        <div className="dp-grain absolute inset-0" />
        <div className="dp-vignette absolute inset-0" />
      </div>

      <div className="relative z-10">
        {/* Status strip */}
        <div className="border-b border-border/50 bg-background/60 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Field unit online
            </span>
            <span className="hidden sm:inline text-primary/70">Confidential // Detective Pulse</span>
            <span>Est. 2016</span>
          </div>
        </div>

        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary transition-colors group-hover:border-primary/70">
                <Crosshair className="h-5 w-5" />
              </span>
              <span className="font-serif text-lg font-bold tracking-tight">
                Detective<span className="text-primary">Pulse</span>
              </span>
            </Link>
            <nav className="flex items-center gap-3 text-sm text-muted-foreground sm:gap-5">
              <Link href="/" className="hidden font-mono text-xs uppercase tracking-wider hover:text-foreground sm:inline">
                หน้าแรก
              </Link>
              <Link href="/#services" className="hidden font-mono text-xs uppercase tracking-wider hover:text-foreground sm:inline">
                บริการ
              </Link>
              <Link href="/ติดต่อนักสืบ/" className="font-mono text-xs uppercase tracking-wider hover:text-foreground">
                ติดต่อ
              </Link>
              <LangSwitch />
            </nav>
          </div>
        </header>

        {children}

        {/* Footer */}
        <footer className="border-t border-border/60 bg-background/60">
          <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="dp-hairline mb-6" />
            <FooterDirectory />
            <div className="dp-hairline mb-6" />
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="flex items-center gap-2 font-serif text-base font-bold">
                <Crosshair className="h-4 w-4 text-primary" />
                Detective<span className="text-primary">Pulse</span>
              </span>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                © {new Date().getFullYear()} · Since 2016 · นักสืบเอกชนมืออาชีพ
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/55">
                {"// End of file — all case data confidential"}
              </p>
            </div>
          </div>
        </footer>
      </div>

      <ContactFab />
      <ConversionTracker />
      <MarketingAnalytics />
    </div>
  );
}
