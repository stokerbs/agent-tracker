import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link2, Link2Off, ScanSearch } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { SyncButton } from "@/components/gps903/sync-button";
import { DiscoveryTable } from "./discovery-table";
import type { Gps903Device } from "@/lib/types";
import type { AgentOption, CaseOption, EnrichedDevice, LinkedCase } from "./types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "GPS903 Device Discovery" };

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

export default async function Gps903DiscoveryPage({ searchParams }: Props) {
  const { filter = "all" } = await searchParams;
  await requireRole(["admin", "supervisor"]);
  const t   = await getTranslations("gps903Discovery");
  const svc = createServiceClient();

  // 1. Fetch full GPS903 device catalog
  const { data: catalogRows } = await svc
    .from("gps903_devices")
    .select("*")
    .order("gps903_device_id");

  const catalog    = (catalogRows ?? []) as Gps903Device[];
  const catalogIds = catalog.map((d) => d.gps903_device_id);

  // 2. Fetch operational links (gps_devices rows that reference catalog devices)
  const opQuery = catalogIds.length > 0
    ? await svc
        .from("gps_devices")
        .select(`
          id, gps903_device_id, case_id, agent_id, phone_number, provider,
          cases ( case_number ),
          agents ( id, full_name, agent_code )
        `)
        .in("gps903_device_id", catalogIds)
        .is("deleted_at", null)
    : { data: [] };

  const opRows = opQuery.data ?? [];

  // Build map: gps903_device_id → LinkedCase[]
  const linkedMap = new Map<number, LinkedCase[]>();
  // Build map: gps903_device_id → first-row SIM info (phone_number + provider)
  const simMap    = new Map<number, { phoneNumber: string | null; provider: string | null }>();

  for (const row of opRows) {
    const gId: number = row.gps903_device_id as number;
    const r = row as Record<string, any>;

    const entry: LinkedCase = {
      gpsDeviceId: r.id,
      caseId:      r.case_id,
      caseNumber:  r.cases?.case_number ?? "?",
      agentId:     r.agent_id ?? null,
      agentName:   r.agents?.full_name ?? null,
      agentCode:   r.agents?.agent_code ?? null,
    };
    const existing = linkedMap.get(gId) ?? [];
    existing.push(entry);
    linkedMap.set(gId, existing);

    if (!simMap.has(gId)) {
      simMap.set(gId, { phoneNumber: r.phone_number ?? null, provider: r.provider ?? null });
    }
  }

  // 3. Enrich and filter
  const enriched: EnrichedDevice[] = catalog.map((d) => ({
    id:          d.id,
    gps903Id:    d.gps903_device_id,
    deviceName:  d.device_name,
    imei:        d.imei,
    model:       d.model,
    lastSeen:    d.last_seen,
    syncedAt:    d.synced_at,
    linkedCases: linkedMap.get(d.gps903_device_id) ?? [],
    phoneNumber: simMap.get(d.gps903_device_id)?.phoneNumber ?? null,
    provider:    simMap.get(d.gps903_device_id)?.provider    ?? null,
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
  const lastSync = catalog[0]?.synced_at ?? null;

  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleString("en-GB", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : t("neverSynced");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={t("title")} description={t("description")} />
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

      {/* Filter tabs */}
      <div className="flex gap-1">
        {(["all", "linked", "unlinked"] as const).map((f) => (
          <a
            key={f}
            href={`?filter=${f}`}
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
