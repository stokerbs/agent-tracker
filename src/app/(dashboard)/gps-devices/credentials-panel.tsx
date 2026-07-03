import { getTranslations } from "next-intl/server";
import { createServiceClient } from "@/lib/supabase/server";
import { CredentialsClient } from "@/app/(dashboard)/gps903-credentials/credentials-client";
import type { Gps903Credential } from "@/lib/types";

/**
 * GPS903 API credentials (device_name / IMEI / device id) management.
 * Rendered as the "credentials" tab of /gps-devices.
 */
export async function CredentialsPanel() {
  const t = await getTranslations("gps903Credentials");
  const svc = createServiceClient();

  const { data } = await svc
    .from("gps903_credentials")
    .select(
      "id, device_name, imei, gps903_device_id, is_active, last_synced_at, last_sync_ok, created_by, created_at, updated_at",
    )
    .order("device_name");

  const credentials = (data ?? []) as Gps903Credential[];

  const total  = credentials.length;
  const active = credentials.filter((c) => c.is_active).length;
  const lastOk = credentials.filter((c) => c.last_sync_ok).length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("description")}</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("stats.totalDevices"), value: total },
          { label: t("stats.active"),       value: active },
          { label: t("stats.lastSyncOk"),   value: lastOk },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border/60 bg-card p-4">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <CredentialsClient credentials={credentials} />
    </div>
  );
}
