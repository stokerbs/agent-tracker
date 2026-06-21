import Link from "next/link";
import { Radio } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { signOut } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Button } from "@/components/ui/button";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile("/portal/login");
  const t = await getTranslations("portal");
  const tAuth = await getTranslations("auth");

  if (profile.role !== "client") {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/portal" className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Radio className="h-4 w-4" />
            </div>
            {t("clientPortal")}
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile.email}
            </span>
            <LanguageSwitcher />
            <ThemeToggle />
            <form action={signOut}>
              <Button variant="outline" size="sm">
                {tAuth("signOut")}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
