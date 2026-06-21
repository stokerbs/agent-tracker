import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  Car,
  Clock,
  Crosshair,
  FolderLock,
  MapPin,
  MessageSquare,
  Phone,
  Radio,
  Receipt,
  Smartphone,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/constants";
import { decryptField } from "@/lib/security/encryption";
import { PageHeader } from "@/components/shared/page-header";
import {
  CasePriorityBadge,
  CaseStatusBadge,
} from "@/components/shared/status-badges";
import { StatCard } from "@/components/shared/stat-card";
import { CaseTimelineClient } from "@/components/cases/case-timeline-client";
import { AssignAgentControl } from "@/components/cases/assign-agent-control";
import { EditCaseDialog } from "@/components/cases/edit-case-dialog";
import { EvidenceUploader } from "@/components/evidence/evidence-uploader";
import { EvidenceGallery } from "@/components/evidence/evidence-gallery";
import { CaseExpenseSheet } from "@/components/expenses/case-expense-sheet";
import { ExpenseRowActions } from "@/components/expenses/expense-row-actions";
import { CreateInvoiceDialog } from "@/components/invoices/create-invoice-dialog";
import { CloseCaseDialog } from "@/components/cases/close-case-dialog";
import { GpsDeviceCard } from "@/components/cases/gps-device-card";
import { CaseTabShell } from "@/components/cases/case-tab-shell";
import { CollapsibleCard } from "@/components/shared/collapsible-card";
import { CaseFieldOpsPanel } from "@/components/field/case-field-ops-panel";
import { ImportFromGps903Dialog } from "@/components/gps903/import-from-gps903-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { IntelligenceTab, IntelligenceTabSkeleton } from "./intelligence-tab";
import { CaseMessagesClient } from "@/components/messages/case-messages-client";
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
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Agent, Case, CaseMessageWithSender, Client, Evidence, Expense, GpsDevice, LinkedEvidence, TimelineEntry } from "@/lib/types";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const validTabs = ["timeline", "evidence", "expenses", "payroll", "messages"];
  // Timeline is the most-used module — default to it (mobile + desktop) unless
  // a specific tab is deep-linked via ?tab=.
  const initialTab = tab && validTabs.includes(tab) ? tab : "timeline";
  const profile = await requireProfile();
  const t = await getTranslations("cases.detail");
  const tCommon = await getTranslations("common");
  const tInvoices = await getTranslations("invoices");
  const tExpenses = await getTranslations("expenses");
  const tPayroll  = await getTranslations("payroll");
  const tIntel    = await getTranslations("intelligence");
  const tMsgs     = await getTranslations("messages");
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
  const targetAlias   = (c as any).target_alias_enc   ? decryptField((c as any).target_alias_enc)   : null;
  const targetNotes   = (c as any).target_notes_enc   ? decryptField((c as any).target_notes_enc)   : null;

  const [
    { data: caseAgentRows },
    { data: rawTimeline },
    { data: evidence },
    { data: expenses },
    { data: clientRaw },
    invoiceCountRes,
    { data: gpsDevicesRaw },
    { data: paymentsRaw },
    { data: messagesRaw },
    { data: myView },
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
      .select("*, gps903_credentials(device_name, imei, phone_number, provider)")
      .eq("case_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("agent_payments")
      .select("*, agents(full_name), profiles!agent_payments_paid_by_fkey(full_name)")
      .eq("case_id", id)
      .order("work_date", { ascending: false }),
    // Most recent 50; reversed to ascending below. Older pages load on demand.
    supabase
      .from("case_messages")
      .select("*, profiles(id, full_name, role)")
      .eq("case_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("case_message_views")
      .select("last_seen_at")
      .eq("case_id", id)
      .eq("profile_id", profile.id)
      .maybeSingle(),
  ]);

  // Enrich timeline entries with linked evidence + server-signed URLs
  type RawEntry = TimelineEntry & { agents?: { full_name: string; nickname?: string | null } | null };
  const rawTimelineTyped = (rawTimeline ?? []) as RawEntry[];
  const entryIds = rawTimelineTyped.map((e) => e.id);
  const evidenceByEntryId = new Map<string, LinkedEvidence[]>();

  if (entryIds.length > 0) {
    const { data: linkedRows } = await supabase
      .from("evidence")
      .select("id, case_id, type, category, storage_path, file_name, file_size, mime_type, notes, uploaded_by, uploaded_at, timeline_entry_id")
      .in("timeline_entry_id", entryIds);

    if (linkedRows && linkedRows.length > 0) {
      const paths = linkedRows.map((r) => r.storage_path);
      const { data: signedData } = await supabase.storage
        .from(BUCKETS.evidence)
        .createSignedUrls(paths, 3600);
      const signedUrlMap: Record<string, string> = {};
      (signedData ?? []).forEach((su, i) => { signedUrlMap[paths[i]] = su.signedUrl ?? ""; });

      for (const ev of linkedRows) {
        if (!ev.timeline_entry_id) continue;
        const list = evidenceByEntryId.get(ev.timeline_entry_id) ?? [];
        list.push({
          id: ev.id, case_id: ev.case_id, type: ev.type, category: ev.category,
          storage_path: ev.storage_path, file_name: ev.file_name, file_size: ev.file_size,
          mime_type: ev.mime_type, notes: ev.notes, uploaded_by: ev.uploaded_by,
          uploaded_at: ev.uploaded_at, signedUrl: signedUrlMap[ev.storage_path] ?? "",
        });
        evidenceByEntryId.set(ev.timeline_entry_id, list);
      }
    }
  }

  const caseClient = clientRaw as Client | null;
  const hasInvoice = (invoiceCountRes?.count ?? 0) > 0;

  const [allAgents, allClients, fieldAgentRaw] = await Promise.all([
    staff
      ? supabase.from("agents").select("*").order("full_name").then((r) => (r.data as Agent[] ?? []))
      : Promise.resolve([] as Agent[]),
    staff
      ? supabase.from("clients").select("id, name").order("name").then((r) => (r.data as Pick<Client, "id" | "name">[] ?? []))
      : Promise.resolve([] as Pick<Client, "id" | "name">[]),
    // Field ops panel: fetch current user's agent record if they're an agent role.
    profile.role === "agent"
      ? supabase.from("agents").select("*").eq("profile_id", profile.id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);
  const fieldAgent = fieldAgentRaw as Agent | null;

  const assignedAgents = ((caseAgentRows ?? []) as unknown as { agents: Agent }[])
    .map((r) => r.agents)
    .filter(Boolean);

  const timelineEntries = rawTimelineTyped.map((e) => ({
    ...e,
    linked_evidence: evidenceByEntryId.get(e.id) ?? [],
  }));
  const caseEvidence  = (evidence  ?? []) as Evidence[];
  const caseExpenses  = (expenses  ?? []) as (Expense & { agents?: { full_name: string } | null })[];

  const totalExpenses = caseExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const casePayments  = ((paymentsRaw ?? []) as any[]).map((p) => ({
    ...p,
    paid_by_name: (p.profiles as { full_name: string | null } | null)?.full_name ?? null,
  }));
  const totalPayroll  = casePayments.reduce((s: number, p: any) => s + Number(p.amount), 0);

  const gpsDevices = (gpsDevicesRaw ?? []) as GpsDevice[];

  const isAdmin = profile.role === "admin";
  const isSupervisor = profile.role === "supervisor";
  const canInsert = profile.role !== "client";

  // Group timeline entries by date DESC, entries ASC within each day.
  // timelineEntries arrives sorted DESC — first-seen date is newest.
  const todayBKK = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const dateMap = new Map<string, typeof timelineEntries>();
  for (const e of timelineEntries) {
    if (!dateMap.has(e.entry_date)) dateMap.set(e.entry_date, []);
    dateMap.get(e.entry_date)!.push(e);
  }
  const dateGroups = Array.from(dateMap.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // dates DESC
    .map(([date, entries]) => ({
      date,
      entries: [...entries].reverse(), // time ASC within day
    }));

  // Messages + unread count (fetched newest-first; reverse to chronological)
  const caseMessages = [...((messagesRaw ?? []) as CaseMessageWithSender[])].reverse();
  const lastSeen = myView?.last_seen_at ? new Date(myView.last_seen_at) : null;
  const unreadMessageCount = caseMessages.filter(
    (m) => m.sender_id !== profile.id && (!lastSeen || new Date(m.created_at) > lastSeen),
  ).length;

  return (
    // Bottom padding on mobile clears the fixed bottom nav (md+ has no bottom bar).
    <div className="space-y-6 pb-24 md:pb-0">
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
            label={t("stats.expenses")}
            value={formatCurrency(totalExpenses)}
            icon={<Receipt className="h-4 w-4" />}
            accentBar={totalExpenses > 0 ? "warning" : undefined}
          />
        </div>
      </FadeUp>

      <FadeUp delay={0.07}>
        <div className="grid gap-3 lg:gap-6 lg:grid-cols-3">
          {/* Case info — collapsed by default on mobile */}
          <CollapsibleCard
            title={t("caseFile")}
            icon={<User className="h-4 w-4" />}
          >
            <div className="space-y-3 text-sm">
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
            </div>
          </CollapsibleCard>

          {/* Assigned agents — collapsed by default on mobile */}
          <CollapsibleCard
            title={t("assignedAgents")}
            icon={<Users className="h-4 w-4" />}
            count={assignedAgents.length > 0 ? assignedAgents.length : undefined}
          >
            <AssignAgentControl
              caseId={id}
              assigned={assignedAgents}
              available={allAgents}
              canManage={staff}
            />
          </CollapsibleCard>

          {/* Quick actions — collapsed by default on mobile */}
          <CollapsibleCard title={t("reporting")}>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {timelineEntries.length === 1
                  ? t("reportingHint", { count: timelineEntries.length })
                  : t("reportingHintPlural", { count: timelineEntries.length })}
              </p>
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
                  hasInvoice={hasInvoice}
                />
              )}
            </div>
          </CollapsibleCard>
        </div>
      </FadeUp>

      {/* GPS Tracker Information — visible to staff + assigned agents, hidden from clients */}
      {!profile.role.startsWith("client") && (gpsDevices.length > 0 || staff) && (
        <FadeUp delay={0.09}>
          <CollapsibleCard
            title={t("gpsSection.title")}
            icon={<Radio className="h-4 w-4 text-emerald-500" />}
            count={gpsDevices.length > 0 ? gpsDevices.length : undefined}
            headerAction={isAdmin ? <ImportFromGps903Dialog caseId={id} /> : undefined}
          >
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
                    agents={allAgents}
                  />
                ))}
              </div>
            )}
          </CollapsibleCard>
        </FadeUp>
      )}

      {/* Field Operations — agent-only: GPS broadcasting, status selector, SOS */}
      {fieldAgent && (
        <FadeUp delay={0.10}>
          <CollapsibleCard
            title="Field Operations"
            icon={<Smartphone className="h-4 w-4" />}
          >
            <CaseFieldOpsPanel agent={fieldAgent} />
          </CollapsibleCard>
        </FadeUp>
      )}

      {/* Target Intelligence — streamed independently; always in page, never a separate tab */}
      <FadeUp delay={0.11}>
        <CollapsibleCard
          title={tIntel("section")}
          icon={<Crosshair className="h-4 w-4" />}
        >
          <Suspense fallback={<IntelligenceTabSkeleton />}>
            <IntelligenceTab
              caseId={id}
              staff={staff}
              targetProfile={{
                name: targetName,
                alias: targetAlias,
                phone: targetPhone,
                gender: (c as any).target_gender ?? null,
                age: (c as any).target_age ?? null,
                notes: targetNotes,
              }}
            />
          </Suspense>
        </CollapsibleCard>
      </FadeUp>

      {/* Tabs */}
      <FadeUp delay={0.11}>
        <CaseTabShell
          defaultValue={initialTab}
          counts={{
            timeline: timelineEntries.length,
            evidence: caseEvidence.length,
            messagesUnread: unreadMessageCount,
          }}
          staff={staff}
          canInsert={canInsert}
        >
          {/* Desktop/tablet: top tab strip. Mobile uses the fixed bottom nav. */}
          <TabsList className="hidden md:inline-flex">
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
            <TabsTrigger value="expenses">
              <Receipt className="mr-1 h-4 w-4" />
              {t("tabs.expenses")}
              <TabCount n={caseExpenses.length} />
            </TabsTrigger>
            {staff && (
              <TabsTrigger value="payroll">
                <Wallet className="mr-1 h-4 w-4" />
                {tPayroll("title")}
                <TabCount n={casePayments.length} />
              </TabsTrigger>
            )}
            <TabsTrigger value="messages" className="relative">
              <MessageSquare className="mr-1 h-4 w-4" />
              {tMsgs("tab")}
              {unreadMessageCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {unreadMessageCount}
                </span>
              ) : (
                <TabCount n={caseMessages.length} />
              )}
            </TabsTrigger>
          </TabsList>

          {/* Timeline */}
          <TabsContent value="timeline" className="space-y-2">
            {dateGroups.length === 0 ? (
              <EmptyState
                icon={<Clock className="h-6 w-6" />}
                title={t("noTimeline")}
                description={t("noTimelineDescription")}
              />
            ) : (
              <CaseTimelineClient
                caseId={id}
                dateGroups={dateGroups}
                canInsert={canInsert}
                canEdit={staff}
                isAdmin={isAdmin}
                todayBangkok={todayBKK}
              />
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

          {/* Expenses */}
          <TabsContent value="expenses" className="space-y-4">
            {canInsert && (
              <div className="flex justify-end">
                <CaseExpenseSheet caseId={id} />
              </div>
            )}
            {caseExpenses.length === 0 ? (
              <EmptyState
                icon={<Receipt className="h-6 w-6" />}
                title="No expenses recorded"
                description="No expenses have been recorded for this case yet."
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="hidden sm:table-cell">{t("expenseTable.date")}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t("expenseTable.agent")}</TableHead>
                        <TableHead>{t("expenseTable.category")}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t("expenseTable.notes")}</TableHead>
                        <TableHead className="text-right">{t("expenseTable.amount")}</TableHead>
                        <TableHead>Status</TableHead>
                        {staff && <TableHead className="w-10" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {caseExpenses.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="hidden whitespace-nowrap text-sm sm:table-cell">
                            {formatDate(e.expense_date)}
                          </TableCell>
                          <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                            {e.agents?.full_name ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {CATEGORY_LABELS[e.category] ?? e.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden max-w-xs truncate text-sm text-muted-foreground sm:table-cell">
                            {e.notes ?? "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right font-medium">
                            {formatCurrency(Number(e.amount))}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-xs font-medium",
                                e.status === "paid"
                                  ? "border-success/20 bg-success/10 text-success"
                                  : e.status === "reimbursed"
                                    ? "border-blue-500/20 bg-blue-500/10 text-blue-500"
                                    : e.status === "cancelled"
                                      ? "border-border bg-muted text-muted-foreground"
                                      : "border-amber-500/20 bg-amber-500/10 text-amber-500",
                              )}
                            >
                              {e.status === "paid"
                                ? "Paid"
                                : e.status === "reimbursed"
                                  ? "Reimbursed"
                                  : e.status === "cancelled"
                                    ? "Cancelled"
                                    : "Pending"}
                            </span>
                          </TableCell>
                          {staff && (
                            <TableCell className="p-1">
                              <ExpenseRowActions
                                expenseId={e.id}
                                currentStatus={e.status}
                              />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-medium">
                        <TableCell className="hidden sm:table-cell" />
                        <TableCell className="hidden sm:table-cell" />
                        <TableCell className="text-sm">{t("expenseTable.total")}</TableCell>
                        <TableCell className="hidden sm:table-cell" />
                        <TableCell className="whitespace-nowrap text-right text-sm text-primary">
                          {formatCurrency(totalExpenses)}
                        </TableCell>
                        <TableCell />
                        {staff && <TableCell />}
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Messages */}
          <TabsContent value="messages">
            <CaseMessagesClient
              caseId={id}
              messages={caseMessages}
              currentProfileId={profile.id}
              currentUserName={profile.full_name ?? "Staff"}
              isStaff={staff}
            />
          </TabsContent>

          {/* Payroll */}
          {staff && (
            <TabsContent value="payroll" className="space-y-4">
              {/* Cost summary */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="py-3 px-4">
                    <p className="text-xs text-muted-foreground">{tPayroll("caseSection.payrollTotal")}</p>
                    <p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(totalPayroll)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 px-4">
                    <p className="text-xs text-muted-foreground">{tPayroll("caseSection.expensesTotal")}</p>
                    <p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(totalExpenses)}</p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardContent className="py-3 px-4">
                    <p className="text-xs text-muted-foreground">{tPayroll("caseSection.totalCost")}</p>
                    <p className="mt-0.5 font-semibold tabular-nums text-primary">{formatCurrency(totalPayroll + totalExpenses)}</p>
                  </CardContent>
                </Card>
              </div>

              {casePayments.length === 0 ? (
                <EmptyState
                  icon={<Wallet className="h-6 w-6" />}
                  title={tPayroll("noTitle")}
                  description={tPayroll("noDescription")}
                />
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tPayroll("table.date")}</TableHead>
                          <TableHead>{tPayroll("table.agent")}</TableHead>
                          <TableHead>{tPayroll("table.notes")}</TableHead>
                          <TableHead>{tPayroll("table.status")}</TableHead>
                          <TableHead className="text-right">{tPayroll("table.amount")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {casePayments.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm whitespace-nowrap">{p.work_date}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {p.agents?.full_name ?? "—"}
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
                        <TableRow className="bg-muted/30 font-medium">
                          <TableCell colSpan={4} className="text-sm">
                            {tPayroll("table.total")}
                          </TableCell>
                          <TableCell className="text-right text-sm text-primary">
                            {formatCurrency(totalPayroll)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

        </CaseTabShell>
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
