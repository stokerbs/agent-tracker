import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  UserCheck,
  Radio,
  PowerOff,
  Briefcase,
  CheckCircle2,
  Siren,
  Clock,
  ArrowRight,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { decryptField } from "@/lib/security/encryption";
import {
  getActiveAgents,
  getActiveAlerts,
  getActiveCases,
  getDashboardStats,
  getRecentTimeline,
} from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { LiveMap } from "@/components/map/live-map";
import { AgentAvailabilityBoard } from "@/components/dashboard/availability-board";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CasePriorityBadge,
  CaseStatusBadge,
} from "@/components/shared/status-badges";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Operations Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");
  const [stats, activeAgents, alerts, timeline, activeMissions] = await Promise.all([
    getDashboardStats(),
    getActiveAgents(),
    getActiveAlerts(),
    getRecentTimeline(7),
    getActiveCases(5),
  ]);
  const firstName = profile.full_name?.split(" ")[0] ?? t("operative");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title", { name: firstName })}
        description={t("description")}
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("stats.openCases")} value={stats.openCases} icon={<Briefcase className="h-5 w-5" />} accent="text-blue-500" />
        <StatCard label={t("stats.closedCases")} value={stats.closedCases} icon={<CheckCircle2 className="h-5 w-5" />} accent="text-emerald-500" />
        <StatCard label={t("stats.activeAgents")} value={stats.activeAgents} icon={<Radio className="h-5 w-5" />} accent="text-violet-500" />
        <StatCard label={t("stats.availableAgents")} value={stats.availableAgents} icon={<UserCheck className="h-5 w-5" />} accent="text-emerald-500" />
      </div>

      {/* Emergency banner */}
      {stats.emergencyAlerts > 0 && (
        <Link href="/emergency">
          <Card className="border-destructive/40 bg-destructive/5 transition-colors hover:bg-destructive/10">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                <Siren className="h-5 w-5 animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-destructive">
                  {stats.emergencyAlerts === 1
                    ? t("emergencyBanner.one", { count: stats.emergencyAlerts })
                    : t("emergencyBanner.other", { count: stats.emergencyAlerts })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("emergencyBanner.review")}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-destructive" />
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live map */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("liveMap")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/map">
                {tCommon("fullMap")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <LiveMap initialAgents={activeAgents} />
          </CardContent>
        </Card>

        {/* Availability board */}
        <AgentAvailabilityBoard
          stats={{
            total: stats.totalAgents,
            available: stats.availableAgents,
            active: stats.activeAgents,
            offline: stats.offlineAgents,
          }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent timeline */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> {t("recentTimeline")}
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/timeline">
                {tCommon("viewAll")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {timeline.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("noTimeline")}
              </p>
            )}
            {timeline.map((t2) => (
              <div key={t2.id} className="flex gap-3 text-sm">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0">
                  <p className="truncate">{t2.entry}</p>
                  <p className="text-xs text-muted-foreground">
                    {t2.cases?.case_number ?? "Case"} ·{" "}
                    {t2.agents?.full_name ?? "Agent"} · {t2.entry_time}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Active missions */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("activeMissions")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/cases">
                {tCommon("allCases")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeMissions.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("noActiveMissions")}
              </p>
            )}
            {activeMissions.map((c) => (
              <Link
                key={c.id}
                href={`/cases/${c.id}`}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.case_number} · {c.client_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.case_type} · Target: {c.target_name_enc ? decryptField(c.target_name_enc) : "—"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CasePriorityBadge priority={c.priority} />
                  <CaseStatusBadge status={c.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Active alerts list */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Siren className="h-4 w-4" /> {t("emergencyAlerts")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(alerts as any[]).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {a.agents?.full_name ?? "Agent"} ({a.agents?.agent_code})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.notes ?? "SOS triggered"} · {timeAgo(a.created_at)}
                  </p>
                </div>
                <Badge variant="destructive">{a.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
