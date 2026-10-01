import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { LeadPipelineControls, type LeadFileSummary } from "./lead-pipeline-controls";
import { LEAD_STAGE_LABELS, isLeadStage, type LeadStage } from "@/lib/marketing/zh/pipeline";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  case_type: string | null;
  message: string | null;
  locale: string;
  source: string;
  status: string;
  created_at: string;
  // Pipeline + Chinese intake fields (migration 0124)
  lead_ref: string | null;
  wechat_id: string | null;
  country: string | null;
  target_location: string | null;
  service: string | null;
  known_info: string | null;
  objective: string | null;
  preferred_start: string | null;
  estimated_duration: string | null;
  urgency: string | null;
  budget_range: string | null;
  landing_page: string | null;
  utm_source: string | null;
  stage: string;
  estimated_value: number | null;
  quoted_value: number | null;
  final_revenue: number | null;
  admin_notes: string | null;
}

function stageOf(l: Lead): LeadStage {
  return isLeadStage(l.stage) ? l.stage : "new";
}

/** Chinese-intake qualification summary (shown only for zh_intake leads). */
function ZhDetails({ l }: { l: Lead }) {
  if (l.source !== "zh_intake") return null;
  const rows: [string, string | null][] = [
    ["WeChat", l.wechat_id], ["ประเทศ", l.country], ["พื้นที่", l.target_location], ["บริการ", l.service],
    ["เริ่ม", l.preferred_start], ["ระยะเวลา", l.estimated_duration], ["เร่งด่วน", l.urgency], ["งบ", l.budget_range],
    ["Landing", l.landing_page], ["UTM", l.utm_source],
  ];
  return (
    <div className="mt-2 space-y-1 text-xs">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <span key={k}><span className="text-muted-foreground">{k}:</span> <span className="font-medium">{v}</span></span>
        ))}
      </div>
      {l.known_info && <p className="whitespace-pre-line leading-relaxed"><span className="text-muted-foreground">ข้อมูลที่มี:</span> {l.known_info}</p>}
      {l.objective && <p className="whitespace-pre-line leading-relaxed"><span className="text-muted-foreground">เป้าหมาย:</span> {l.objective}</p>}
    </div>
  );
}

export default async function LeadsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("marketing_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  const leads = (data as Lead[]) ?? [];
  // Intake attachments (admin RLS) grouped by lead for the pipeline controls.
  const { data: fileRows } = await supabase
    .from("marketing_lead_files")
    .select("id, lead_id, file_name, size_bytes")
    .in("lead_id", leads.map((l) => l.id));
  const filesByLead = new Map<string, LeadFileSummary[]>();
  for (const f of fileRows ?? []) {
    const list = filesByLead.get(f.lead_id) ?? [];
    list.push({ id: f.id, file_name: f.file_name, size_bytes: f.size_bytes });
    filesByLead.set(f.lead_id, list);
  }
  const pipeline = (l: Lead) => (
    <LeadPipelineControls
      id={l.id}
      stage={stageOf(l)}
      estimatedValue={l.estimated_value}
      quotedValue={l.quoted_value}
      finalRevenue={l.final_revenue}
      adminNotes={l.admin_notes}
      files={filesByLead.get(l.id) ?? []}
    />
  );
  const stageBadge = (l: Lead) => (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">{LEAD_STAGE_LABELS[stageOf(l)].th}</span>
  );

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <PageHeader
        title="ลูกค้าที่ติดต่อเข้ามา"
        description="รายชื่อที่กรอกฟอร์มติดต่อจากหน้าเว็บ detectivepulse.com"
      />
      {leads.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="ยังไม่มีลูกค้าติดต่อเข้ามา"
          description="เมื่อมีคนกรอกฟอร์มบนเว็บ รายชื่อจะแสดงที่นี่"
        />
      ) : (
        <>
          {/* Mobile: readable stacked cards with clear labels */}
          <div className="space-y-3 md:hidden">
            {leads.map((l) => (
              <Card key={l.id}>
                <CardContent className="p-4">
                  {/* Contact person (who to call back) */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">ผู้ติดต่อกลับ</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold">{l.name}</span>
                        {l.source === "assistant" && (
                          <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">แชท AI</span>
                        )}
                        {l.source === "zh_intake" && (
                          <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">{l.lead_ref ?? "中文"}</span>
                        )}
                        {stageBadge(l)}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(l.created_at)}</span>
                  </div>

                  <div className="mt-3 space-y-2 text-sm">
                    {l.phone && (
                      <div className="flex gap-2">
                        <span className="w-16 shrink-0 text-muted-foreground">เบอร์</span>
                        <a href={`tel:${l.phone}`} className="font-medium text-primary hover:underline">{l.phone}</a>
                      </div>
                    )}
                    {l.email && (
                      <div className="flex gap-2">
                        <span className="w-16 shrink-0 text-muted-foreground">อีเมล</span>
                        <a href={`mailto:${l.email}`} className="break-all text-primary hover:underline">{l.email}</a>
                      </div>
                    )}
                    {l.case_type && (
                      <div className="flex gap-2">
                        <span className="w-16 shrink-0 text-muted-foreground">ประเภท</span>
                        <span className="font-medium">{l.case_type}</span>
                      </div>
                    )}
                    {l.message && l.source !== "zh_intake" && (
                      <div className="flex gap-2">
                        <span className="w-16 shrink-0 text-muted-foreground">รายละเอียด</span>
                        <p className="flex-1 whitespace-pre-line leading-relaxed">{l.message}</p>
                      </div>
                    )}
                    <ZhDetails l={l} />
                  </div>
                  {pipeline(l)}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>ติดต่อ</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>รายละเอียด</TableHead>
                    <TableHead>Pipeline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(l.created_at)}</TableCell>
                      <TableCell className="font-medium">
                        {l.name}
                        {l.source === "assistant" && (
                          <span className="ml-2 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 align-middle text-[10px] font-normal text-primary">แชท AI</span>
                        )}
                        {l.source === "zh_intake" && (
                          <span className="ml-2 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 align-middle font-mono text-[10px] font-normal text-primary">{l.lead_ref ?? "中文"}</span>
                        )}
                        <div className="mt-1">{stageBadge(l)}</div>
                      </TableCell>
                      <TableCell>
                        {l.phone && <a href={`tel:${l.phone}`} className="text-primary hover:underline">{l.phone}</a>}
                        {l.wechat_id && <span className="block text-xs">WeChat: <span className="font-medium">{l.wechat_id}</span></span>}
                        {l.email && (
                          <a href={`mailto:${l.email}`} className="mt-0.5 block text-xs text-muted-foreground hover:text-primary hover:underline">{l.email}</a>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{l.case_type ?? "—"}</TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">
                        {l.source === "zh_intake" ? <ZhDetails l={l} /> : <span className="line-clamp-2">{l.message ?? "—"}</span>}
                      </TableCell>
                      <TableCell className="min-w-[22rem]">{pipeline(l)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
