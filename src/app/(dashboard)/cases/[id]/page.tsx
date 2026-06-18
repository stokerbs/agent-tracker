// AI report generation via Anthropic can take up to ~30s; raise the Vercel
// function timeout so the Server Action is not killed mid-request.
export const maxDuration = 60;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  Car,
  Clock,
  FileText,
  FolderLock,
  MapPin,
  Phone,
  Radio,
  Receipt,
  User,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { decryptField } from "@/lib/security/encryption";
import { PageHeader } from "@/components/shared/page-header";
import {
  CasePriorityBadge,
  CaseStatusBadge,
} from "@/components/shared/status-badges";
import { StatCard } from "@/components/shared/stat-card";
import { AddTimelineEntry } from "@/components/cases/add-timeline-entry";
import { TimelineEntryCard } from "@/components/cases/timeline-entry-card";
import { AssignAgentControl } from "@/components/cases/assign-agent-control";
import { GenerateReportButton } from "@/components/cases/generate-report-button";
import { EditCaseDialog } from "@/components/cases/edit-case-dialog";
import { EvidenceUploader } from "@/components/evidence/evidence-uploader";
import { EvidenceGallery } from "@/components/evidence/evidence-gallery";
import { ReportCard } from "@/components/reports/report-card";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { CreateInvoiceDialog } from "@/components/invoices/create-invoice-dialog";
import { CloseCaseDialog } from "@/components/cases/close-case-dialog";
import { GpsDeviceCard } from "@/components/cases/gps-device-card";
import { GpsDeviceFormDialog } from "@/components/cases/gps-device-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { FadeUp } from "@/components/shared/motion";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Agent, Case, Client, Evidence, Expense, GpsDevice, Report, TimelineEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  fuel: "Fuel", toll: "Toll", parking: "Parking",
  food: "Food", hotel: "Hotel", misc: "Misc",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("case_number, client_name")
    .eq("id", id)
    .single();
  return {
    title: data
      ? `${data.case_number}${data.client_name ? ` · ${data.client_name}` : ""}`
      : "Case",
  };
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const t = await getTranslations("cases.detail");
  const tCommon = await getTranslations("common");
  const tInvoices = await getTranslations("invoices");
  const tExpenses = await getTranslations("expenses");
  const supabase = await createClient();
  const staff = isStaff(profile.role);

  const { data: caseRecord } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .single();
  if (!caseRecord) notFound();
  const c = caseRecord as Case;

  const targetName    = c.target_name_enc    ? decryptField(c.target_name_enc)    : null;
  const targetPhone   = c.target_phone_enc   ? decryptField(c.target_phone_enc)   : null;
  const targetVehicle = c.target_vehicle_enc ? decryptField(c.target_vehicle_enc) : null;
  const licensePlate  = c.license_plate_enc  ? decryptField(c.license_plate_enc)  : null;
  const targetAddress = c.target_address_enc ? decryptField(c.target_address_enc) : null;

  const [
    { data: caseAgentRows },
    { data: timeline },
    { data: evidence },
    { data: reports },
    { data: expenses },
    { data: clientRaw },
    invoiceCountRes,
    { data: gpsDevicesRaw },
  ] = await Promise.all([
    supabase.from("case_agents").select("agents(*)").eq("case_id", id),
    supabase
      .from("timeline_entries")
      .select("*, agents(full_name, nickname)")
      .eq("case_id", id)
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .order("entry_time", { ascending: false }),
    supabase
      .from("evidence")
      .select("*")
      .eq("case_id", id)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("reports")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("expenses")
      .select("*, agents(full_name)")
      .eq("case_id", id)
      .order("expense_date", { ascending: false }),
    c.client_id && staff
      ? supabase.from("clients").select("*").eq("id", c.client_id).single()
      : Promise.resolve({ data: null }),
    staff
      ? supabase.from("invoices").select("id", { count: "exact", head: true }).eq("case_id", id)
      : Promise.resolve({ count: 0 }),
    supabase
      .from("gps_devices")
      .select("*")
      .eq("case_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);

  const caseClient = clientRaw as Client | null;
  const hasInvoice = (invoiceCountRes?.count ?? 0) > 0;
  const hasApprovedReport = (reports as Report[] ?? []).some((r) => r.status === "approved");

  const [allAgents, allClients] = await Promise.all([
    staff
      ? supabase.from("agents").select("*").order("full_name").then((r) => (r.data as Agent[] ?? []))
      : Promise.resolve([] as Agent[]),
    staff
      ? supabase.from("clients").select("id, name").order("name").then((r) => (r.data as Pick<Client, "id" | "name">[] ?? []))
      : Promise.resolve([] as Pick<Client, "id" | "name">[]),
  ]);

  const assignedAgents = ((caseAgentRows ?? []) as unknown as { agents: Agent }[])
    .map((r) => r.agents)
    .filter(Boolean);

  const timelineEntries = (timeline ?? []) as (TimelineEntry & {
    agents?: { full_name: string } | null;
  })[];
  const caseEvidence  = (evidence  ?? []) as Evidence[];
  const caseReports   = (reports   ?? []) as Report[];
  const caseExpenses  = (expenses  ?? []) as (Expense & { agents?: { full_name: string } | null })[];

  const totalExpenses = caseExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const gpsDevices = (gpsDevicesRaw ?? []) as GpsDevice[];

  const isAdmin = profile.role === "admin";
  const isSupervisor = profile.role === "supervisor";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/cases">
          <ArrowLeft className="h-4 w-4" /> {t("allCases")}
        </Link>
      </Button>

      <FadeUp>
        <PageHeader
          title={c.case_number}
          description={`${c.case_type ?? "Surveillance"} · ${c.client_name ?? "Client"}`}
        >
          <CasePriorityBadge priority={c.priority} />
          <CaseStatusBadge status={c.status} />
          {staff && <EditCaseDialog caseRecord={c} clients={allClients} />}
        </PageHeader>
      </FadeUp>

      {/* Stat cards */}
      <FadeUp delay={0.04}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label={t("stats.timeline")}
            value={timelineEntries.length}
            icon={<Clock className="h-4 w-4" />}
            accentBar="primary"
          />
          <StatCard
            label={t("stats.evidence")}
            value={caseEvidence.length}
            icon={<FolderLock className="h-4 w-4" />}
            accentBar={caseEvidence.length > 0 ? "success" : undefined}
          />
          <StatCard
            label={t("stats.reports")}
            value={caseReports.length}
            icon={<FileText className="h-4 w-4" />}
            accentBar={caseReports.length > 0 ? "success" : undefined}
          />
          <StatCard
            label={t("stats.expenses")}
            value={formatCurrency(totalExpenses)}
            icon={<Receipt className="h-4 w-4" />}
            accentBar={totalExpenses > 0 ? "warning" : undefined}
          />
        </div>
      </FadeUp>

      <FadeUp delay={0.07}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Case info */}
          <Card>
            <CardHeader>
              <CardTitle>{t("caseFile")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow icon={<User className="h-4 w-4" />} label={t("infoLabels.target")} value={targetName} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label={t("infoLabels.phone")} value={targetPhone} />
              <InfoRow icon={<Car className="h-4 w-4" />} label={t("infoLabels.vehicle")} value={targetVehicle} />
              <InfoRow icon={<Car className="h-4 w-4" />} label={t("infoLabels.plate")} value={licensePlate} />
              <InfoRow icon={<MapPin className="h-4 w-4" />} label={t("infoLabels.address")} value={targetAddress} />
              <InfoRow icon={<Clock className="h-4 w-4" />} label={t("infoLabels.start")} value={formatDate(c.start_date)} />
              <InfoRow
                icon={<Clock className="h-4 w-4" />}
                label={t("infoLabels.end")}
                value={c.end_date ? formatDate(c.end_date) : t("infoLabels.ongoing")}
              />
              {caseClient && c.client_id && (
                <InfoRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label={t("infoLabels.client")}
                >
                  <Link
                    href={`/clients/${c.client_id}`}
                    className="text-primary hover:underline"
                  >
                    {caseClient.company ?? caseClient.name}
                  </Link>
                </InfoRow>
              )}
              {c.description && (
                <div className="rounded-lg bg-muted/40 p-3 text-muted-foreground">
                  {c.description}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assigned agents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" /> {t("assignedAgents")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AssignAgentControl
                caseId={id}
                assigned={assignedAgents}
                available={allAgents}
                canManage={staff}
              />
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader>
              <CardTitle>{t("reporting")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {timelineEntries.length === 1
                  ? t("reportingHint", { count: timelineEntries.length })
                  : t("reportingHintPlural", { count: timelineEntries.length })}
              </p>
              <GenerateReportButton caseId={id} />
              {staff && caseClient && c.client_id && (
                <CreateInvoiceDialog
                  clients={[caseClient]}
                  cases={[c]}
                  defaultClientId={c.client_id}
                  defaultCaseId={c.id}
                  trigger={
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <Banknote className="h-4 w-4" />
                      {tInvoices("createFromCase")}
                    </Button>
                  }
                />
              )}
              {staff && c.status !== "closed" && (
                <CloseCaseDialog
                  caseId={c.id}
                  caseNumber={c.case_number}
                  clientName={c.client_name}
                  timelineCount={timelineEntries.length}
                  evidenceCount={caseEvidence.length}
                  reportCount={caseReports.length}
                  hasApprovedReport={hasApprovedReport}
                  hasInvoice={hasInvoice}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </FadeUp>

      {/* GPS Tracker Information — visible to staff + assigned agents, hidden from clients */}
      {!profile.role.startsWith("client") && (gpsDevices.length > 0 || staff) && (
        <FadeUp delay={0.09}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-emerald-500" />
                  {t("gpsSection.title")}
                </CardTitle>
                {isAdmin && <GpsDeviceFormDialog caseId={id} />}
              </div>
            </CardHeader>
            <CardContent>
              {gpsDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("gpsSection.noDevices")}</p>
              ) : (
                <div className="space-y-3">
                  {gpsDevices.map((device, i) => (
                    <GpsDeviceCard
                      key={device.id}
                      device={device}
                      index={i}
                      caseId={id}
                      canEdit={isAdmin || isSupervisor}
                      canDelete={isAdmin}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeUp>
      )}

      {/* Tabs */}
      <FadeUp delay={0.1}>
        <Tabs defaultValue="timeline">
          <TabsList>
            <TabsTrigger value="timeline">
              <Clock className="mr-1 h-4 w-4" />
              {t("tabs.timeline")}
              <TabCount n={timelineEntries.length} />
            </TabsTrigger>
            <TabsTrigger value="evidence">
              <FolderLock className="mr-1 h-4 w-4" />
              {t("tabs.evidence")}
              <TabCount n={caseEvidence.length} />
            </TabsTrigger>
            <TabsTrigger value="reports">
              <FileText className="mr-1 h-4 w-4" />
              {t("tabs.reports")}
              <TabCount n={caseReports.length} />
            </TabsTrigger>
            <TabsTrigger value="expenses">
              <Receipt className="mr-1 h-4 w-4" />
              {t("tabs.expenses")}
              <TabCount n={caseExpenses.length} />
            </TabsTrigger>
          </TabsList>

          {/* Timeline */}
          <TabsContent value="timeline" className="space-y-4">
            <AddTimelineEntry caseId={id} />
            {timelineEntries.length === 0 ? (
              <EmptyState
                icon={<Clock className="h-6 w-6" />}
                title={t("noTimeline")}
                description={t("noTimelineDescription")}
              />
            ) : (
              <div className="relative space-y-1 pl-4">
                <div className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-border" />
                {timelineEntries.map((entry) => (
                  <div key={entry.id} className="group relative flex gap-4 pb-4">
                    <div className="absolute -left-[1px] mt-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    <TimelineEntryCard entry={entry} canEdit={staff} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Evidence */}
          <TabsContent value="evidence" className="space-y-4">
            <EvidenceUploader caseId={id} />
            {caseEvidence.length === 0 ? (
              <EmptyState
                icon={<FolderLock className="h-6 w-6" />}
                title={t("noEvidence")}
                description={t("noEvidenceDescription")}
              />
            ) : (
              <EvidenceGallery
                items={caseEvidence}
                columns="grid-cols-2 sm:grid-cols-3"
              />
            )}
          </TabsContent>

          {/* Reports */}
          <TabsContent value="reports" className="space-y-4">
            {caseReports.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title={t("noReports")}
                description={t("noReportsDescription")}
              />
            ) : (
              caseReports.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  caseRecord={c}
                  subjectName={targetName}
                  canApprove={staff}
                />
              ))
            )}
          </TabsContent>

          {/* Expenses */}
          <TabsContent value="expenses" className="space-y-4">
            {staff && (
              <div className="flex justify-end">
                <AddExpenseDialog caseId={id} />
              </div>
            )}
            {caseExpenses.length === 0 ? (
              <EmptyState
                icon={<Receipt className="h-6 w-6" />}
                title={t("noExpenses")}
                description={t("noExpensesDescription")}
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("expenseTable.date")}</TableHead>
                        <TableHead>{t("expenseTable.agent")}</TableHead>
                        <TableHead>{t("expenseTable.category")}</TableHead>
                        <TableHead>{t("expenseTable.notes")}</TableHead>
                        <TableHead className="text-right">{t("expenseTable.amount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {caseExpenses.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm whitespace-nowrap">{formatDate(e.expense_date)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {e.agents?.full_name ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {CATEGORY_LABELS[e.category] ?? e.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {e.notes ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium whitespace-nowrap">
                            {formatCurrency(Number(e.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-medium">
                        <TableCell colSpan={4} className="text-sm">
                          {t("expenseTable.total")}
                        </TableCell>
                        <TableCell className="text-right text-sm text-primary">
                          {formatCurrency(totalExpenses)}
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

function TabCount({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {n}
    </span>
  );
}

function InfoRow({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {children ?? <p>{value || "—"}</p>}
      </div>
    </div>
  );
}
