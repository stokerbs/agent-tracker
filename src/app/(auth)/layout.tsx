import Link from "next/link";
import { Radio } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("auth");
  const tMeta = await getTranslations("meta");

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-10 text-slate-100 lg:flex">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <Link href="/" className="relative z-10 flex items-center gap-2 font-semibold">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Radio className="h-5 w-5" />
          </div>
          {tMeta("appName")}
        </Link>
        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            {tMeta("tagline")}
          </h2>
          <p className="mt-3 text-slate-300">{t("brandDescription")}</p>
        </div>
        <p className="relative z-10 text-xs text-slate-400">
          {tMeta("copyright", { year: new Date().getFullYear() })}
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center p-6">
        <div className="absolute right-4 top-4 flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
