import Link from "next/link";
import { Radio, Shield } from "lucide-react";
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
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#06090F] p-10 text-slate-100 lg:flex">
        {/* Tactical grid */}
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />

        {/* Glow blobs */}
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute right-10 top-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/30">
            <Radio className="h-4.5 w-4.5 text-primary" />
          </div>
          <span className="font-semibold tracking-tight">{tMeta("appName")}</span>
        </Link>

        {/* Tagline */}
        <div className="relative z-10 max-w-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            {tMeta("tagline")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            {t("brandDescription")}
          </p>

          {/* Status indicators */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { label: "Encrypted", color: "bg-primary" },
              { label: "Realtime", color: "bg-success" },
              { label: "Secure", color: "bg-warning" },
            ].map(({ label, color }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/3 px-3 py-2"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
                <span className="text-xs text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 font-mono text-[10px] uppercase tracking-widest text-slate-500">
          {tMeta("copyright", { year: new Date().getFullYear() })}
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-background p-6">
        <div className="absolute right-4 top-4 flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
