import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  FileText,
  MapPin,
  Radar,
  Tag,
} from "lucide-react";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBangkokTime } from "@/lib/maps/shared";
import { AddManualPingDialog } from "@/components/air-tags/add-manual-ping-dialog";
import { ImportCsvDialog } from "@/components/air-tags/import-csv-dialog";
import { DeleteAirTagDialog } from "@/components/air-tags/delete-air-tag-dialog";
import { AirTagPositionTable } from "@/components/air-tags/air-tag-position-table";
import { AirTagRouteReplayPanel } from "@/components/air-tags/air-tag-route-replay-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `AirTag — ${id.slice(0, 8)}` };
}

const TAB_KEYS = ["overview", "history", "replay"] as const;

type Tab = (typeof TAB_KEYS)[number];

export default async function AirTagDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = (TAB_KEYS as readonly string[]).includes(rawTab ?? "")
    ? (rawTab as Tab)
    : "overview";

  const profile = await requireProfile();
  const t = await getTranslations("airTags");
  const supabase = await createClient();

  // ── Tracker (user-scoped — RLS enforces visibility; notFound() is the only
  // response for a soft-deleted or RLS-invisible id, never leaking existence) ──
  const { data: trackerRaw } = await supabase
    .from("air_tag_trackers")
    .select("id, case_id, label, apple_serial, notes, created_by, created_at, updated_at, cases(id, case_number)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!trackerRaw) notFound();
  const tracker = trackerRaw as unknown as {
    id: string;
    case_id: string;
    label: string;
    apple_serial: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    cases: { id: string; case_number: string } | null;
  };

  const canManagePositions = profile.role === "admin" || profile.role === "agent";
  const canDelete = isStaff(profile.role);

  // ── Overview quick stats + creator name (only fetched for the Overview tab) ──
  let creatorName: string | null = null;
  let totalPings = 0;
  let lastPingAt: string | null = null;

  if (tab === "overview") {
    const [creatorRes, countRes, lastPosRes] = await Promise.all([
      tracker.created_by
        ? supabase.from("profiles").select("full_name").eq("id", tracker.created_by).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("air_tag_positions")
        .select("id", { count: "exact", head: true })
        .eq("air_tag_id", tracker.id),
      supabase
        .from("air_tag_positions")
        .select("recorded_at")
        .eq("air_tag_id", tracker.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    creatorName = (creatorRes.data as { full_name: string | null } | null)?.full_name ?? null;
    totalPings = countRes.count ?? 0;
    lastPingAt = (lastPosRes.data as { recorded_at: string } | null)?.recorded_at ?? null;
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
        <Link href={`/cases/${tracker.case_id}`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("backLink")}
        </Link>
      </Button>

      {/* Title bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 ring-1 ring-sky-500/30">
            <Tag className="h-5 w-5 text-sky-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{tracker.label}</h1>
            {tracker.apple_serial && (
              <p className="font-mono text-xs text-muted-foreground">{tracker.apple_serial}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManagePositions && (
            <>
              <AddManualPingDialog airTagId={tracker.id} />
              <ImportCsvDialog airTagId={tracker.id} />
            </>
          )}
          {canDelete && (
            <DeleteAirTagDialog
              airTagId={tracker.id}
              label={tracker.label}
              redirectTo={`/cases/${tracker.case_id}`}
            />
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/60 pb-px">
        {TAB_KEYS.map((key) => (
          <Link
            key={key}
            href={`?tab=${key}`}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`tabs.${key}`)}
          </Link>
        ))}
      </div>

      {/* ── Tab: Overview ── */}
      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Tracker info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Tag className="h-4 w-4 text-sky-500" />
                {t("detail.trackerInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label={t("detail.label")} value={tracker.label} />
              <InfoRow label={t("detail.serial")} value={tracker.apple_serial ?? t("detail.noSerial")} mono />
              <InfoRow
                label={t("detail.addedBy")}
                value={creatorName ?? t("detail.unknownUser")}
              />
              <InfoRow label={t("detail.addedOn")} value={new Date(tracker.created_at).toLocaleDateString()} />
            </CardContent>
          </Card>

          {/* Case + notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-violet-500" />
                {t("detail.notes")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {tracker.cases && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("detail.case")}</span>
                  <Link
                    href={`/cases/${tracker.case_id}`}
                    className="flex items-center gap-1 font-mono text-xs font-medium text-primary hover:underline"
                  >
                    <Briefcase className="h-3 w-3" />
                    {tracker.cases.case_number}
                  </Link>
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm text-foreground/90">
                {tracker.notes || t("detail.noNotes")}
              </p>
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Radar className="h-4 w-4 text-emerald-500" />
                {t("detail.stats.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {t("detail.stats.totalPings")}
                </span>
                <span className="font-mono text-sm font-medium">{totalPings}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" /> {t("detail.stats.lastPing")}
                </span>
                <span className="font-mono text-xs font-medium">
                  {lastPingAt ? formatBangkokTime(lastPingAt) : t("detail.stats.never")}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Position History ──
          Self-contained client component: fetches via listAirTagPositions and
          owns its own loading/error(retry)/empty/data + pagination states. */}
      {tab === "history" && (
        <Card>
          <CardContent className="pt-4">
            <AirTagPositionTable airTagId={tracker.id} />
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Route Replay ──
          Full-screen map overlay (fixed inset-0); "closing" it navigates back
          to the Overview tab since the tab itself is the open/closed state. */}
      {tab === "replay" && (
        <AirTagRouteReplayPanel
          tracker={{ id: tracker.id, label: tracker.label, created_at: tracker.created_at }}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right text-sm font-medium", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
