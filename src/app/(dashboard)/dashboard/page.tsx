import type { Metadata } from "next";
import Link from "next/link";
import {
  UserCheck,
  Radio,
  Briefcase,
  CheckCircle2,
  Siren,
  Clock,
  ArrowRight,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { decryptField } from "@/lib/security/encryption";
import {
  getActiveAgents,
  getActiveAlerts,
  getActiveCases,
  getChartData,
  getDashboardStats,
  getRecentTimeline,
} from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { LiveMap } from "@/components/map/live-map";
import { AgentAvailabilityBoard } from "@/components/dashboard/availability-board";
import {
  CasesTrendChart,
  CaseStatusChart,
  AgentWorkloadChart,
  RevenueTrendChart,
} from "@/components/dashboard/charts";
import { FadeUp } from "@/components/shared/motion";
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
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Operations Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const staff = isStaff(profile.role);
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");

  const [stats, activeAgents, alerts, timeline, activeMissions, charts] = await Promise.all([
    getDashboardStats(),
    staff ? getActiveAgents() : Promise.resolve([]),
    staff ? getActiveAlerts() : Promise.resolve([]),
    getRecentTimeline(7),
    getActiveCases(5),
    staff ? getChartData() : Promise.resolve(null),
  ]);

  const firstName = profile.full_name?.split(" ")[0] ?? t("operative");

  return (
    <div className="space-y-6">
      <FadeUp>
        <PageHeader
          title={t("title", { name: firstName })}
          description={t("description")}
        />
      </FadeUp>

      {/* Stat row — agent counts visible to staff only */}
      <FadeUp delay={0.05}>
        <div className={cn("grid gap-3", staff ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2")}>
          <StatCard label={t("stats.openCases")} value={stats.openCases} icon={<Briefcase className="h-4 w-4" />} accent="text-primary" accentBar="primary" />
          <StatCard label={t("stats.closedCases")} value={stats.closedCases} icon={<CheckCircle2 className="h-4 w-4" />} accent="text-success" accentBar="success" />
          {staff && (
            <>
              <StatCard label={t("stats.activeAgents")} value={stats.activeAgents} icon={<Radio className="h-4 w-4" />} accent="text-primary" />
              <StatCard label={t("stats.availableAgents")} value={stats.availableAgents} icon={<UserCheck className="h-4 w-4" />} accent="text-success" />
            </>
          )}
        </div>
      </FadeUp>

      {/* Emergency banner — staff only */}
      {staff && stats.emergencyAlerts > 0 && (
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

      {/* Analytics charts — staff only */}
      {staff && charts && (
        <FadeUp delay={0.1}>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Cases trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {t("charts.casesTrend")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {charts.casesTrend.every((p) => p.cases === 0) ? (
                  <p className="py-12 text-center text-xs text-muted-foreground">
                    {t("charts.noData")}
                  </p>
                ) : (
                  <CasesTrendChart data={charts.casesTrend} />
                )}
              </CardContent>
            </Card>

            {/* Case status breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {t("charts.caseStatus")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {charts.caseStatus.length === 0 ? (
                  <p className="py-12 text-center text-xs text-muted-foreground">
                    {t("charts.noData")}
                  </p>
                ) : (
                  <CaseStatusChart data={charts.caseStatus} />
                )}
              </CardContent>
            </Card>

            {/* Agent workload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {t("charts.agentWorkload")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {charts.agentWorkload.length === 0 ? (
                  <p className="py-12 text-center text-xs text-muted-foreground">
                    {t("charts.noData")}
                  </p>
                ) : (
                  <AgentWorkloadChart data={charts.agentWorkload} />
                )}
              </CardContent>
            </Card>

            {/* Revenue trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {t("charts.revenueTrend")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {charts.revenueTrend.every((p) => p.invoiced === 0) ? (
                  <p className="py-12 text-center text-xs text-muted-foreground">
                    {t("charts.noData")}
                  </p>
                ) : (
                  <RevenueTrendChart data={charts.revenueTrend} />
                )}
              </CardContent>
            </Card>
          </div>
        </FadeUp>
      )}

      {/* Live map + availability board — staff only */}
      {staff && (
        <div className="grid gap-6 lg:grid-cols-3">
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
              <LiveMap
                initialAgents={activeAgents}
                initialGeofences={[]}
                emergencyAlerts={[]}
                isAdmin={false}
              />
            </CardContent>
          </Card>

          <AgentAvailabilityBoard
            stats={{
              total: stats.totalAgents,
              available: stats.availableAgents,
              active: stats.activeAgents,
              offline: stats.offlineAgents,
            }}
          />
        </div>
      )}

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

      {/* Active alerts list — staff only */}
      {staff && (alerts as any[]).length > 0 && (
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
