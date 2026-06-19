import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  Clock,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Smartphone,
  User,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { AgentRoleBadge, AgentStatusBadge, CasePriorityBadge, CaseStatusBadge } from "@/components/shared/status-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FadeUp, StaggerGrid, StaggerItem } from "@/components/shared/motion";
import { EditAgentDialog } from "@/components/agents/edit-agent-dialog";
import { batteryColor, cn, formatCurrency, formatDate, initials, timeAgo } from "@/lib/utils";
import type { Agent, Case, Expense, TimelineEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("agents").select("full_name").eq("id", id).single();
  return { title: data?.full_name ?? "Agent" };
}

const CATEGORY_LABELS: Record<string, string> = {
  fuel: "Fuel", toll: "Toll", parking: "Parking",
  food: "Food", hotel: "Hotel", misc: "Misc",
};

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("agents.detail");
  const tCase = await getTranslations("cases");
  const tPayroll = await getTranslations("payroll");
  const supabase = await createClient();

  const [{ data: agentRaw }, { data: caseAgentRows }, { data: expensesRaw }, { data: timelineRaw }, { data: paymentsRaw }] =
    await Promise.all([
      supabase.from("agents").select("*").eq("id", id).single(),
      supabase
        .from("case_agents")
        .select("cases(id,case_number,case_type,status,priority,start_date,end_date,client_name)")
        .eq("agent_id", id),
      supabase
        .from("expenses")
        .select("*")
        .eq("agent_id", id)
        .order("expense_date", { ascending: false }),
      supabase
        .from("timeline_entries")
        .select("*, cases(case_number)")
        .eq("agent_id", id)
        .order("entry_date", { ascending: false })
        .order("entry_time", { ascending: false })
        .limit(100),
      supabase
        .from("agent_payments")
        .select("*, cases(case_number), profiles!agent_payments_paid_by_fkey(full_name)")
        .eq("agent_id", id)
        .order("work_date", { ascending: false }),
    ]);

  if (!agentRaw) notFound();

  const agent = agentRaw as Agent;
  const cases = ((caseAgentRows ?? [])
    .map((r: any) => r.cases)
    .filter(Boolean)) as Case[];
  const expenses = (expensesRaw ?? []) as Expense[];
  const timeline = ((timelineRaw ?? []) as (TimelineEntry & { cases: { case_number: string } | null })[]);
  const agentPayments = ((paymentsRaw ?? []) as any[]).map((p) => ({
    ...p,
    paid_by_name: (p.profiles as { full_name: string | null } | null)?.full_name ?? null,
  }));

  const openCases = cases.filter((c) => c.status !== "closed").length;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const pendingPayroll = agentPayments.filter((p: any) => p.status === "pending").reduce((s: number, p: any) => s + Number(p.amount), 0);
  const paidPayroll    = agentPayments.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.amount), 0);
  const workDays       = agentPayments.length;
  const completionRate =
    cases.length > 0
      ? Math.round((cases.filter((c) => c.status === "closed").length / cases.length) * 100)
      : 0;

  const batteryLevel = agent.battery_pct ?? 0;

  return (
    <div className="space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </Link>

      <FadeUp>
        <PageHeader
          title={agent.full_name}
          description={[agent.position, agent.area].filter(Boolean).join(" · ") || undefined}
        >
          {agent.agent_role && <AgentRoleBadge role={agent.agent_role} />}
          <AgentStatusBadge status={agent.status} />
          <EditAgentDialog agent={agent} />
        </PageHeader>
      </FadeUp>

      {/* Stats */}
      <FadeUp delay={0.05}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={t("stats.totalCases")}
            value={cases.length}
            icon={<Briefcase className="h-4 w-4" />}
            accentBar="primary"
          />
          <StatCard
            label={t("stats.openCases")}
            value={openCases}
            icon={<Briefcase className="h-4 w-4" />}
          />
          <StatCard
            label={t("stats.totalExpenses")}
            value={formatCurrency(totalExpenses)}
            icon={<Receipt className="h-4 w-4" />}
            accentBar="warning"
          />
          <StatCard
            label={t("stats.completionRate")}
            value={`${completionRate}%`}
            icon={<User className="h-4 w-4" />}
            accentBar="success"
          />
        </div>
      </FadeUp>

      <FadeUp delay={0.08}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Identity card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-sm">
                <Avatar className="h-9 w-9">
                  {agent.photo_url && <Avatar><AvatarFallback>{initials(agent.full_name)}</AvatarFallback></Avatar>}
                  <AvatarFallback className="text-xs font-semibold">
                    {initials(agent.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-mono text-xs font-bold tracking-wider text-primary">
                    {agent.agent_code}
                  </p>
                  {agent.nickname && (
                    <p className="text-[11px] text-muted-foreground">"{agent.nickname}"</p>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {agent.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a href={`mailto:${agent.email}`} className="truncate text-primary hover:underline">
                    {agent.email}
                  </a>
                </div>
              )}
              {agent.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a href={`tel:${agent.phone}`} className="text-primary hover:underline">
                    {agent.phone}
                  </a>
                </div>
              )}
              {!agent.email && !agent.phone && (
                <p className="text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          {/* Field status card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" /> {t("fieldStatus")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {/* Battery */}
              <div className="flex items-center gap-2">
                {agent.is_charging ? (
                  <BatteryCharging className="h-4 w-4 text-success" />
                ) : batteryLevel <= 25 ? (
                  <BatteryLow className="h-4 w-4 text-destructive" />
                ) : (
                  <BatteryMedium className={cn("h-4 w-4", batteryColor(agent.battery_pct))} />
                )}
                <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      agent.is_charging
                        ? "bg-success"
                        : batteryLevel > 60
                        ? "bg-success"
                        : batteryLevel > 25
                        ? "bg-warning"
                        : "bg-destructive",
                    )}
                    style={{ width: `${batteryLevel}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {agent.battery_pct ?? "—"}%
                </span>
              </div>

              {/* GPS */}
              {agent.current_lat && agent.current_lng ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-mono">
                    {agent.current_lat.toFixed(5)}, {agent.current_lng.toFixed(5)}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("noGps")}</p>
              )}

              {/* Last active */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5 shrink-0" />
                <span>{timeAgo(agent.last_active)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Since card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("memberSince")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {new Date(agent.created_at).toLocaleDateString("en-GB", {
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(agent.created_at)}</p>
            </CardContent>
          </Card>
        </div>
      </FadeUp>

      {/* Tabs */}
      <FadeUp delay={0.1}>
        <Tabs defaultValue="cases">
          <TabsList>
            <TabsTrigger value="cases">
              <Briefcase className="mr-1.5 h-4 w-4" />
              {t("tabs.cases")} ({cases.length})
            </TabsTrigger>
            <TabsTrigger value="expenses">
              <Receipt className="mr-1.5 h-4 w-4" />
              {t("tabs.expenses")} ({expenses.length})
            </TabsTrigger>
            <TabsTrigger value="payroll">
              <Wallet className="mr-1 h-4 w-4" />
              {tPayroll("title")} ({agentPayments.length})
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <Clock className="mr-1.5 h-4 w-4" />
              {t("tabs.timeline")} ({timeline.length})
            </TabsTrigger>
          </TabsList>

          {/* Cases tab */}
          <TabsContent value="cases" className="mt-4">
            {cases.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="h-6 w-6" />}
                title={t("noCases")}
                description=""
              />
            ) : (
              <StaggerGrid>
                {cases.map((c) => (
                  <StaggerItem key={c.id}>
                    <Link
                      href={`/cases/${c.id}`}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-4 transition-colors hover:border-border hover:bg-accent/30"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-primary">
                          {c.case_number}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.client_name ?? "—"}
                          {c.case_type && (
                            <span className="text-muted-foreground/60"> · {c.case_type}</span>
                          )}
                          {c.start_date && (
                            <span> · {tCase("detail.infoLabels.start")}: {formatDate(c.start_date)}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <CasePriorityBadge priority={c.priority} />
                        <CaseStatusBadge status={c.status} />
                      </div>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerGrid>
            )}
          </TabsContent>

          {/* Expenses tab */}
          <TabsContent value="expenses" className="mt-4">
            {expenses.length === 0 ? (
              <EmptyState
                icon={<Receipt className="h-6 w-6" />}
                title={t("noExpenses")}
                description=""
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("expenseTable.date")}</TableHead>
                        <TableHead>{t("expenseTable.category")}</TableHead>
                        <TableHead>{t("expenseTable.notes")}</TableHead>
                        <TableHead className="text-right">{t("expenseTable.amount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm">{formatDate(e.expense_date)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {CATEGORY_LABELS[e.category] ?? e.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {e.notes ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Number(e.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={3} className="text-sm font-medium">
                          {t("expenseTable.total")}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-primary">
                          {formatCurrency(totalExpenses)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Timeline tab */}
          <TabsContent value="timeline" className="mt-4">
            {timeline.length === 0 ? (
              <EmptyState
                icon={<Clock className="h-6 w-6" />}
                title={t("noTimeline")}
                description=""
              />
            ) : (
              <div className="relative space-y-0 pl-5">
                {/* Vertical rule */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/60" />
                {timeline.map((entry, i) => {
                  const prev = timeline[i - 1];
                  const showDate = i === 0 || entry.entry_date !== prev?.entry_date;
                  return (
                    <div key={entry.id}>
                      {showDate && (
                        <p className={cn(
                          "relative z-10 mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                          i !== 0 && "mt-5",
                        )}>
                          {formatDate(entry.entry_date)}
                        </p>
                      )}
                      <div className="relative mb-3 flex gap-3">
                        {/* Dot */}
                        <div className="absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-border ring-1 ring-border" />

                        <div className="flex-1 rounded-lg border border-border/60 bg-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm leading-snug">{entry.entry}</p>
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
                              {entry.entry_time?.slice(0, 5)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            {entry.cases?.case_number && (
                              <Link
                                href={`/cases/${entry.case_id}`}
                                className="font-mono text-[10px] font-semibold text-primary hover:underline"
                              >
                                {entry.cases.case_number}
                              </Link>
                            )}
                            {entry.location && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <MapPin className="h-2.5 w-2.5" />
                                {entry.location}
                              </span>
                            )}
                            {entry.photo_url && (
                              <a
                                href={entry.photo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-primary hover:underline"
                              >
                                📷 Photo
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Payroll tab */}
          <TabsContent value="payroll" className="mt-4 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground">{tPayroll("stats.workDays")}</p>
                  <p className="mt-0.5 font-semibold">{workDays}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground">{tPayroll("stats.pending")}</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-amber-500">{formatCurrency(pendingPayroll)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground">{tPayroll("stats.paid")}</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-green-500">{formatCurrency(paidPayroll)}</p>
                </CardContent>
              </Card>
            </div>

            {agentPayments.length === 0 ? (
              <EmptyState
                icon={<Wallet className="h-6 w-6" />}
                title={tPayroll("noOwn")}
                description={tPayroll("noOwnDescription")}
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tPayroll("table.date")}</TableHead>
                        <TableHead>{tPayroll("table.case")}</TableHead>
                        <TableHead>{tPayroll("table.notes")}</TableHead>
                        <TableHead>{tPayroll("table.status")}</TableHead>
                        <TableHead className="text-right">{tPayroll("table.amount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agentPayments.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm whitespace-nowrap">{p.work_date}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.cases?.case_number ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {p.notes ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {tPayroll(`status.${p.status}` as any)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium whitespace-nowrap">
                            {formatCurrency(Number(p.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={4} className="text-sm font-medium">
                          {tPayroll("table.total")}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-primary">
                          {formatCurrency(pendingPayroll + paidPayroll)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </FadeUp>
    </div>
  );
}
