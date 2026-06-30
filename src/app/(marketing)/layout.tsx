import Link from "next/link";

/**
 * Public marketing site chrome (detectivepulse.com). Separate from the app
 * (dashboard/portal) layouts — these pages are indexable, content-first, and
 * have no auth.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Detective<span className="text-primary">Pulse</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">หน้าแรก</Link>
            <Link href="/ติดต่อนักสืบ/" className="hover:text-foreground">ติดต่อ</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Detective Pulse · นักสืบเอกชนมืออาชีพ
        </div>
      </footer>
    </div>
  );
}
