import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { CredentialsClient } from "./credentials-client";
import type { Gps903Credential } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "GPS903 Credentials" };

export default async function Gps903CredentialsPage() {
  await requireRole(["admin", "supervisor"]);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">GPS903 Credentials</h1>
          <p className="text-sm text-muted-foreground">
            Per-device IMEI credentials for GPS903 polling. Each device logs in independently.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Devices", value: total },
          { label: "Active",        value: active },
          { label: "Last Sync OK",  value: lastOk },
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
