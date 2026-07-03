import { getTranslations } from "next-intl/server";
import { Link2, Link2Off, ScanSearch } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { SyncButton } from "@/components/gps903/sync-button";
import { DiscoveryTable } from "@/app/(dashboard)/gps903-discovery/discovery-table";
import type {
  AgentOption,
  CaseOption,
  EnrichedDevice,
  LinkedCase,
} from "@/app/(dashboard)/gps903-discovery/types";

/**
 * GPS903 device discovery: sync from the provider and link devices to
 * agents / cases. Rendered as the "discovery" tab of /gps-devices.
 * `filter` is one of all | linked | unlinked (drives the sub-filter tabs).
 */
export async function DiscoveryPanel({ filter = "all" }: { filter?: string }) {
  const t   = await getTranslations("gps903Discovery");
  const svc = createServiceClient();

  // 1. Fetch credentials as the primary source of truth
  const { data: credRows } = await svc
    .from("gps903_credentials")
    .select("id, device_name, imei, gps903_device_id, phone_number, provider, last_synced_at, last_sync_ok")
    .order("device_name");

  const credentials = (credRows ?? []) as {
    id: string;
    device_name: string;
    imei: string;
    gps903_device_id: number | null;
    phone_number: string | null;
    provider: string | null;
    last_synced_at: string | null;
    last_sync_ok: boolean | null;
  }[];

  const credentialIds = credentials.map((c) => c.id);

  // 2. Fetch operational links (gps_devices rows that reference credentials)
  const opQuery = credentialIds.length > 0
    ? await svc
        .from("gps_devices")
        .select(`
          id, credential_id, case_id, agent_id,
          cases ( case_number ),
          agents ( id, full_name, agent_code )
        `)
        .in("credential_id", credentialIds)
        .is("deleted_at", null)
    : { data: [] };

  const opRows = opQuery.data ?? [];

  // Build map: credential_id → LinkedCase[]
  const linkedMap = new Map<string, LinkedCase[]>();

  for (const row of opRows) {
    const r = row as Record<string, any>;
    const credId: string = r.credential_id as string;

    const entry: LinkedCase = {
      gpsDeviceId: r.id,
      caseId:      r.case_id,
      caseNumber:  r.cases?.case_number ?? "?",
      agentId:     r.agent_id ?? null,
      agentName:   r.agents?.full_name ?? null,
      agentCode:   r.agents?.agent_code ?? null,
    };
    const existing = linkedMap.get(credId) ?? [];
    existing.push(entry);
    linkedMap.set(credId, existing);
  }

  // 3. Enrich and filter
  const enriched: EnrichedDevice[] = credentials.map((c) => ({
    credentialId: c.id,
    gps903Id:     c.gps903_device_id,
    deviceName:   c.device_name,
    imei:         c.imei,
    phoneNumber:  c.phone_number,
    provider:     c.provider,
    lastSynced:   c.last_synced_at,
    lastSyncOk:   c.last_sync_ok,
    linkedCases:  linkedMap.get(c.id) ?? [],
  }));

  const displayed =
    filter === "linked"
      ? enriched.filter((d) => d.linkedCases.length > 0)
      : filter === "unlinked"
        ? enriched.filter((d) => d.linkedCases.length === 0)
        : enriched;

  // 4. Cases + agents for dialogs (open cases only)
  const [{ data: casesRaw }, { data: agentsRaw }] = await Promise.all([
    svc
      .from("cases")
      .select("id, case_number")
      .not("status", "in", '("closed","cancelled")')
      .order("case_number"),
    svc.from("agents").select("id, full_name, agent_code").order("full_name"),
  ]);

  const cases:  CaseOption[]  = (casesRaw  ?? []) as CaseOption[];
  const agents: AgentOption[] = (agentsRaw ?? []) as AgentOption[];

  // Stats
  const total    = enriched.length;
  const linked   = enriched.filter((d) => d.linkedCases.length > 0).length;
  const unlinked = total - linked;
  const lastSync = credentials.reduce<string | null>((best, c) => {
    if (!c.last_synced_at) return best;
    if (!best) return c.last_synced_at;
    return c.last_synced_at > best ? c.last_synced_at : best;
  }, null);

  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleString("en-GB", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : t("neverSynced");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <SyncButton />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("stats.total"),    value: total,         icon: <ScanSearch className="h-4 w-4 text-emerald-500" /> },
          { label: t("stats.linked"),   value: linked,        icon: <Link2      className="h-4 w-4 text-sky-500"     /> },
          { label: t("stats.unlinked"), value: unlinked,      icon: <Link2Off   className="h-4 w-4 text-amber-500"   /> },
          { label: t("stats.lastSync"), value: lastSyncLabel, icon: null },
        ].map(({ label, value, icon }) => (
          <Card key={label} className="p-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              {icon}
              <span className="text-xs">{label}</span>
            </div>
            <p className={typeof value === "number" ? "text-2xl font-bold" : "text-sm font-medium"}>
              {value}
            </p>
          </Card>
        ))}
      </div>

      {/* Filter tabs (preserve the parent tab param) */}
      <div className="flex gap-1">
        {(["all", "linked", "unlinked"] as const).map((f) => (
          <a
            key={f}
            href={`?tab=discovery&filter=${f}`}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {f === "all"
              ? t("filterAll")
              : f === "linked"
                ? t("filterLinked")
                : t("filterUnlinked")}
          </a>
        ))}
      </div>

      {/* Device table */}
      {total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ScanSearch className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">{t("empty")}</p>
            <p className="max-w-sm text-xs text-muted-foreground/60">{t("emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <DiscoveryTable
          devices={displayed}
          cases={cases}
          agents={agents}
          emptyMessage={t("noResults")}
        />
      )}
    </div>
  );
}
