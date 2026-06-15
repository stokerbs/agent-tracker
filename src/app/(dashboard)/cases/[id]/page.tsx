import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Car,
  Clock,
  FileText,
  FolderLock,
  MapPin,
  Phone,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { decryptField } from "@/lib/security/encryption";
import { PageHeader } from "@/components/shared/page-header";
import {
  CasePriorityBadge,
  CaseStatusBadge,
} from "@/components/shared/status-badges";
import { AddTimelineEntry } from "@/components/cases/add-timeline-entry";
import { AssignAgentControl } from "@/components/cases/assign-agent-control";
import { GenerateReportButton } from "@/components/cases/generate-report-button";
import { EvidenceUploader } from "@/components/evidence/evidence-uploader";
import { EvidencePreview } from "@/components/evidence/evidence-preview";
import { ReportCard } from "@/components/reports/report-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";
import type { Agent, Case, Evidence, Report, TimelineEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
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
    { data: allAgents },
    { data: timeline },
    { data: evidence },
    { data: reports },
  ] = await Promise.all([
    supabase.from("case_agents").select("agents(*)").eq("case_id", id),
    supabase.from("agents").select("*").order("full_name"),
    supabase
      .from("timeline_entries")
      .select("*, agents(full_name, nickname)")
      .eq("case_id", id)
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
  ]);

  const assignedAgents = ((caseAgentRows ?? []) as unknown as { agents: Agent }[])
    .map((r) => r.agents)
    .filter(Boolean);
  const timelineEntries = (timeline ?? []) as (TimelineEntry & {
    agents?: { full_name: string } | null;
  })[];

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/cases">
          <ArrowLeft className="h-4 w-4" /> All cases
        </Link>
      </Button>

      <PageHeader
        title={`${c.case_number}`}
        description={`${c.case_type ?? "Surveillance"} · ${c.client_name ?? "Client"}`}
      >
        <CasePriorityBadge priority={c.priority} />
        <CaseStatusBadge status={c.status} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Case info */}
        <Card>
          <CardHeader>
            <CardTitle>Case File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={<User className="h-4 w-4" />} label="Target" value={targetName} />
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Target phone" value={targetPhone} />
            <InfoRow icon={<Car className="h-4 w-4" />} label="Vehicle" value={targetVehicle} />
            <InfoRow icon={<Car className="h-4 w-4" />} label="License plate" value={licensePlate} />
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={targetAddress} />
            <InfoRow icon={<Clock className="h-4 w-4" />} label="Start" value={formatDate(c.start_date)} />
            <InfoRow icon={<Clock className="h-4 w-4" />} label="End" value={c.end_date ? formatDate(c.end_date) : "Ongoing"} />
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
              <Users className="h-4 w-4" /> Assigned Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AssignAgentControl
              caseId={id}
              assigned={assignedAgents}
              available={(allAgents as Agent[]) ?? []}
              canManage={staff}
            />
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle>Reporting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate a professional AI surveillance report from the
              {" "}{timelineEntries.length} logged timeline entr
              {timelineEntries.length === 1 ? "y" : "ies"}.
            </p>
            <GenerateReportButton caseId={id} />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">
            <Clock className="mr-1 h-4 w-4" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="evidence">
            <FolderLock className="mr-1 h-4 w-4" /> Evidence
          </TabsTrigger>
          <TabsTrigger value="reports">
            <FileText className="mr-1 h-4 w-4" /> Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <AddTimelineEntry caseId={id} />
          {timelineEntries.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-6 w-6" />}
              title="No timeline entries"
              description="Add the first surveillance observation above."
            />
          ) : (
            <div className="relative space-y-1 pl-4">
              <div className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-border" />
              {timelineEntries.map((t) => (
                <div key={t.id} className="relative flex gap-4 pb-4">
                  <div className="absolute -left-[1px] mt-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                  <div className="ml-4 flex-1 rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {t.entry_date} · {t.entry_time}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {t.agents?.full_name ?? "Agent"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{t.entry}</p>
                    {t.location && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {t.location}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="evidence" className="space-y-4">
          <EvidenceUploader caseId={id} />
          {(evidence ?? []).length === 0 ? (
            <EmptyState
              icon={<FolderLock className="h-6 w-6" />}
              title="No evidence uploaded"
              description="Upload photos, videos or PDF files for this case."
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {(evidence as Evidence[]).map((e) => (
                <EvidencePreview key={e.id} item={e} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          {(reports ?? []).length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No reports yet"
              description="Use “Generate AI Report” to create one from the timeline."
            />
          ) : (
            (reports as Report[]).map((r) => (
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
      </Tabs>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p>{value || "—"}</p>
      </div>
    </div>
  );
}
