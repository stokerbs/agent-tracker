import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Clock,
  Crosshair,
  FolderLock,
  MessageSquare,
  Radio,
  Receipt,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/constants";
import { decryptField } from "@/lib/security/encryption";
import { parseSocials } from "@/lib/socials";
import { PageHeader } from "@/components/shared/page-header";
import {
  CasePriorityBadge,
  CaseStatusBadge,
} from "@/components/shared/status-badges";
import { CaseTimelineClient } from "@/components/cases/case-timeline-client";
import { EditCaseDialog } from "@/components/cases/edit-case-dialog";
import { CaseChat } from "@/components/cases/case-chat";
import { EvidenceUploader } from "@/components/evidence/evidence-uploader";
import { EvidenceGallery } from "@/components/evidence/evidence-gallery";
import { CaseExpenseSheet } from "@/components/expenses/case-expense-sheet";
import { ExpenseRowActions } from "@/components/expenses/expense-row-actions";
import { CreateInvoiceDialog } from "@/components/invoices/create-invoice-dialog";
import { CloseCaseDialog } from "@/components/cases/close-case-dialog";
import { GpsDeviceCard } from "@/components/cases/gps-device-card";
import { AssignCaseButton } from "@/components/cases/assign-case-button";
import { AssignedTeamCard, type TeamMember } from "@/components/cases/assigned-team-card";
import { BoardPanel } from "@/components/cases/board-panel";
import { listPendingClaims } from "@/app/(dashboard)/cases/board-actions";
import { CaseTabShell } from "@/components/cases/case-tab-shell";
import { CollapsibleCard } from "@/components/shared/collapsible-card";
import { ImportFromGps903Dialog } from "@/components/gps903/import-from-gps903-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { IntelligenceTab, IntelligenceTabSkeleton } from "./intelligence-tab";
import { IntelligenceOverview, IntelligenceOverviewSkeleton } from "./intelligence-overview";
import { CaseMessagesClient } from "@/components/messages/case-messages-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { FadeUp } from "@/components/shared/motion";
import { bangkokDateKey, cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Agent, Case, CaseMessageWithSender, Client, Evidence, Expense, GpsDevice, LinkedEvidence, TimelineEntry } from "@/lib/types";

export const dynamic = "force-dynamic";


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
  const validTabs = ["timeline", "evidence", "messages"];
  const initialTab = tab && validTabs.includes(tab) ? tab : "timeline";
  const profile = await requireProfile();
  const t = await getTranslations("cases.detail");
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

  const targetName  = c.target_name_enc  ? decryptField(c.target_name_enc)  : null;
  const targetPhone = c.target_phone_enc ? decryptField(c.target_phone_enc) : null;
  const targetAlias = (c as any).target_alias_enc ? decryptField((c as any).target_alias_enc) : null;
  const targetNotes = (c as any).target_notes_enc ? decryptField((c as any).target_notes_enc) : null;
  const targetDob   = c.target_dob_enc   ? decryptField(c.target_dob_enc)   : null;
  const targetEmail = c.target_email_enc ? decryptField(c.target_email_enc) : null;
  const { map: targetSocials } = parseSocials(
    c.target_socials_enc ? decryptField(c.target_socials_enc) : null,
  );

  const [
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
      ? supabase.from("clients").select("*").eq("id", c.client_id).maybeSingle()
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

  const [allAgents, allClients] = await Promise.all([

    staff
      ? supabase.from("agents").select("*").order("full_name").then((r) => (r.data as Agent[] ?? []))
      : Promise.resolve([] as Agent[]),
    staff
      ? supabase.from("clients").select("id, name").order("name").then((r) => (r.data as Pick<Client, "id" | "name">[] ?? []))
      : Promise.resolve([] as Pick<Client, "id" | "name">[]),
  ]);

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

  // Assigned team for this case (single source of truth = case_agents).
  const { data: teamRaw } = await supabase
    .from("case_agents")
    .select("agents(id, full_name, agent_code, photo_url, status)")
    .eq("case_id", id);
  const assignedTeam = ((teamRaw ?? []) as unknown as { agents: TeamMember | TeamMember[] | null }[])
    .flatMap((r) => (Array.isArray(r.agents) ? r.agents : r.agents ? [r.agents] : []))
    .filter((a): a is TeamMember => !!a);

  const pendingClaims = staff && c.on_board ? await listPendingClaims(id) : [];

  const isAdmin = profile.role === "admin";
  const isSupervisor = profile.role === "supervisor";
  const canInsert = profile.role !== "client";

  const todayBKK = bangkokDateKey();
  const todayEntryCount = timelineEntries.filter((e) => e.entry_date === todayBKK).length;
  const dateMap = new Map<string, typeof timelineEntries>();
  for (const e of timelineEntries) {
    if (!dateMap.has(e.entry_date)) dateMap.set(e.entry_date, []);
    dateMap.get(e.entry_date)!.push(e);
  }
  const dateGroups = Array.from(dateMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => ({
      date,
      entries: [...entries].reverse(),
    }));

  const caseMessages = [...((messagesRaw ?? []) as CaseMessageWithSender[])].reverse();
  const lastSeen = myView?.last_seen_at ? new Date(myView.last_seen_at) : null;
  const unreadMessageCount = caseMessages.filter(
    (m) => m.sender_id !== profile.id && (!lastSeen || new Date(m.created_at) > lastSeen),
  ).length;

  return (
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
          {staff && <CaseChat caseId={id} />}
          {staff && <AssignCaseButton caseId={id} />}
          {staff && <EditCaseDialog caseRecord={c} clients={allClients} />}
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
        </PageHeader>
      </FadeUp>

      {/* Assigned team */}
      <FadeUp delay={0.03}>
        <AssignedTeamCard members={assignedTeam} />
      </FadeUp>

      {/* Job board (staff: post + review claims) */}
      {staff && (
        <FadeUp delay={0.035}>
          <BoardPanel
            caseId={id}
            onBoard={c.on_board}
            slots={c.board_slots}
            pendingClaims={pendingClaims}
          />
        </FadeUp>
      )}

      {/* Intelligence summary cards */}
      <FadeUp delay={0.04}>
        <Suspense fallback={<IntelligenceOverviewSkeleton />}>
          <IntelligenceOverview
            caseId={id}
            targetName={targetName}
            gpsDevices={gpsDevices}
            todayEntryCount={todayEntryCount}
            unreadMessageCount={unreadMessageCount}
          />
        </Suspense>
      </FadeUp>

      {/* Target Intelligence — collapsed by default */}
      <FadeUp delay={0.05}>
        <CollapsibleCard
          title={tIntel("section")}
          icon={<Crosshair className="h-4 w-4" />}
          triggerId="intelligence"
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
                dob: targetDob,
                nationality: c.target_nationality ?? null,
                occupation: c.target_occupation ?? null,
                email: targetEmail,
                socials: targetSocials,
              }}
            />
          </Suspense>
        </CollapsibleCard>
      </FadeUp>

      {/* GPS Devices — collapsed by default */}
      {!profile.role.startsWith("client") && (gpsDevices.length > 0 || staff) && (
        <FadeUp delay={0.07}>
          <CollapsibleCard
            title={t("gpsSection.title")}
            icon={<Radio className="h-4 w-4 text-emerald-500" />}
            count={gpsDevices.length > 0 ? gpsDevices.length : undefined}
            headerAction={isAdmin ? <ImportFromGps903Dialog caseId={id} /> : undefined}
            triggerId="gps"
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

      {/* Finance — expenses + payroll + invoice creation, collapsed by default */}
      {!profile.role.startsWith("client") && (
        <FadeUp delay={0.09}>
          <CollapsibleCard
            title={t("finance")}
            icon={<Receipt className="h-4 w-4" />}
            count={caseExpenses.length > 0 ? caseExpenses.length : undefined}
            headerAction={canInsert ? <CaseExpenseSheet caseId={id} /> : undefined}
          >
            <div className="space-y-6">
              {/* Cost summary — staff only */}
              {staff && (
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
              )}

              {/* Expenses */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5" /> {tExpenses("title")}
                </p>
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
                            <TableHead className="hidden sm:table-cell">{t("expenseTable.date")}</TableHead>
                            <TableHead className="hidden sm:table-cell">{t("expenseTable.agent")}</TableHead>
                            <TableHead>{t("expenseTable.category")}</TableHead>
                            <TableHead className="hidden sm:table-cell">{t("expenseTable.notes")}</TableHead>
                            <TableHead className="text-right">{t("expenseTable.amount")}</TableHead>
                            <TableHead>{t("expenseTable.status")}</TableHead>
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
                                  {tExpenses(`categories.${e.category}` as any)}
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
                                  {tExpenses(`status.${e.status}` as any)}
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
              </div>

              {/* Payroll — staff only */}
              {staff && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" /> {tPayroll("title")}
                  </p>
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
                </div>
              )}

              {/* Invoice creation — staff + client exists */}
              {staff && caseClient && c.client_id && (
                <div className="pt-1">
                  <CreateInvoiceDialog
                    clients={[caseClient]}
                    cases={[c]}
                    defaultClientId={c.client_id}
                    defaultCaseId={c.id}
                    trigger={
                      <Button variant="outline" size="sm" className="gap-2">
                        <Banknote className="h-4 w-4" />
                        {tInvoices("createFromCase")}
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          </CollapsibleCard>
        </FadeUp>
      )}

      {/* Tabs — Timeline, Evidence, Messages */}
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
