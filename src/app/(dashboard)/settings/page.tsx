import type { Metadata } from "next";
import { Database, KeyRound, MapPin, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole(["admin"]);
  const t = await getTranslations("settings");

  const checks = [
    {
      icon: Database,
      label: "Supabase",
      env: "NEXT_PUBLIC_SUPABASE_URL",
      ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
    {
      icon: KeyRound,
      label: "Service Role Key",
      env: "SUPABASE_SERVICE_ROLE_KEY",
      ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    {
      icon: MapPin,
      label: "Google Maps",
      env: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
      ok: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    },
    {
      icon: Sparkles,
      label: "AI Report Generator",
      env: "ANTHROPIC_API_KEY",
      ok: !!process.env.ANTHROPIC_API_KEY,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" /> {t("integrationStatus")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checks.map((c) => (
            <div
              key={c.env}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <c.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.env}</p>
                </div>
              </div>
              <Badge variant={c.ok ? "default" : "destructive"}>
                {c.ok ? t("configured") : t("missing")}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("about")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t("aboutText")}</p>
          <p>{t("aboutDescription")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
