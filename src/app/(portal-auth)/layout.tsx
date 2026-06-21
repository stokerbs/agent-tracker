import Link from "next/link";
import { Radio } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export default async function PortalAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tMeta = await getTranslations("meta");
  const tPortal = await getTranslations("portal");

  return (
    <div className="relative flex min-h-screen flex-col bg-muted/20">
      {/* Minimal header */}
      <header className="flex h-14 items-center justify-between px-6">
        <Link href="/portal/login" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Radio className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold">{tMeta("appName")}</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {tPortal("clientPortal")}
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Centered form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
