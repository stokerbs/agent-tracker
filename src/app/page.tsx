import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import {
  Activity,
  MapPin,
  ShieldCheck,
  FileText,
  Radio,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { isMarketingHost } from "@/lib/marketing/host";
import { MarketingHome } from "@/components/marketing/marketing-home";

// On detectivepulse.com "/" is the public PI marketing home; on the app host
// (.app, previews, localhost) it's the app's product landing.
export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host");
  if (!isMarketingHost(host)) return {};
  const title = "นักสืบเอกชนมืออาชีพ รับงานสืบทั่วราชอาณาจักร | Detective Pulse";
  const description =
    "นักสืบเอกชน รับสืบชู้สาว สืบทรัพย์สิน ตามหาคน เช็คประวัติบุคคล งานสืบทุกประเภท เป็นความลับ มืออาชีพ ทั่วประเทศไทย";
  const ogImage = { url: "https://detectivepulse.com/api/og", width: 1200, height: 630 };
  return {
    title,
    description,
    alternates: { canonical: "/", languages: { th: "/", en: "/en", zh: "/zh" } },
    openGraph: { type: "website", url: "https://detectivepulse.com", title, description, siteName: "Detective Pulse", images: [ogImage] },
    twitter: { card: "summary_large_image", title, description, images: [ogImage.url] },
    // Google Search Console ownership verification (HTML-tag method) for the
    // detectivepulse.com property. Public token, not a secret.
    verification: { google: "wtGBoOnzPmFmmkLGce76vbb9dVcPXUd1QHiqQwXc96g" },
  };
}

export default async function Home() {
  const host = (await headers()).get("host");
  if (isMarketingHost(host)) return <MarketingHome />;

  const t = await getTranslations("home");
  const tMeta = await getTranslations("meta");

  const FEATURES = [
    { icon: MapPin, key: "gps" },
    { icon: Users, key: "agents" },
    { icon: FileText, key: "ai" },
    { icon: Radio, key: "sos" },
    { icon: Activity, key: "ops" },
    { icon: ShieldCheck, key: "security" },
  ] as const;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between p-6">
        <div className="flex items-center gap-2 font-semibold">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Radio className="h-5 w-5" />
          </div>
          <span>{tMeta("appName")}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button asChild>
            <Link href="/login">{t("signIn")}</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <section className="py-20 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {t("live")}
          </div>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            {t("hero")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            {t("subhero")}
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">{t("launch")}</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.key}
              className="rounded-xl border bg-card p-6 shadow-sm transition-colors hover:border-primary/40"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{t(`features.${f.key}.title` as any)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`features.${f.key}.desc` as any)}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t py-6 text-center text-sm text-muted-foreground">
        {t("footer")}
      </footer>
    </div>
  );
}
