import Link from "next/link";
import { ContactFab } from "@/components/marketing/contact-fab";
import { LangSwitch } from "@/components/marketing/lang-switch";

/**
 * Shared public marketing chrome (header + footer) for detectivepulse.com —
 * used by the (marketing) route-group layout and the marketing homepage so they
 * stay visually consistent.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Detective<span className="text-primary">Pulse</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground sm:gap-4">
            <Link href="/" className="hidden hover:text-foreground sm:inline">หน้าแรก</Link>
            <Link href="/ติดต่อนักสืบ/" className="hover:text-foreground">ติดต่อ</Link>
            <LangSwitch />
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Detective Pulse · Since 2016 · นักสืบเอกชนมืออาชีพ รับงานสืบทั่วราชอาณาจักร
        </div>
      </footer>
      <ContactFab />
    </div>
  );
}
