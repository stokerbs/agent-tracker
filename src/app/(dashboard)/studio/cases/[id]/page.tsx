import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { isAiAvailable } from "@/lib/studio/ai";
import { STUDIO_SETTINGS_ID } from "@/lib/studio/constants";
import type { CaseInsight, PrivacyRules, StudioCase } from "@/lib/studio/types";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApprovedBadge, Pill, SensitivityBadge } from "@/components/studio/badges";
import { ApproveSwitch } from "../../knowledge/approve-switch";
import { setCaseApproved } from "../actions";
import { CaseForm } from "../case-form";
import { CaseDetailActions } from "../case-detail-actions";
import { InsightsPanel } from "../insights-panel";
import { CASE_FIELD_LABELS, CASE_TEXT_FIELDS, CASE_TYPE_META, POTENTIAL_META } from "../case-types";

export const metadata: Metadata = { title: "เคส · Creative Studio" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudioCaseDetailPage({ params, searchParams }: Props) {
  await requireRole(["admin"]);
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: row, error }, { data: insightRows, error: insErr }, { data: settings }] = await Promise.all([
    supabase.from("studio_cases").select("*").eq("id", id).maybeSingle(),
    supabase.from("studio_case_insights").select("*").eq("case_id", id).order("created_at", { ascending: true }),
    supabase.from("studio_settings").select("privacy_rules").eq("id", STUDIO_SETTINGS_ID).maybeSingle(),
  ]);
  if (error) throw new Error(`โหลดเคสไม่สำเร็จ: ${error.message}`);
  if (!row) notFound();
  if (insErr) throw new Error(`โหลดบทเรียนไม่สำเร็จ: ${insErr.message}`);

  const studioCase = row as StudioCase;
  const insights = (insightRows ?? []) as CaseInsight[];
  const rules = (settings?.privacy_rules as Partial<PrivacyRules> | null) ?? null;
  const aiAvailable = isAiAvailable();
  const editing = sp.edit === "1";
  const pot = POTENTIAL_META[studioCase.content_potential];

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title={`แก้ไขเคส ${studioCase.case_code}`} description={studioCase.title}>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href={`/studio/cases/${studioCase.id}`}>
              <ArrowLeft className="h-4 w-4" /> ยกเลิกการแก้ไข
            </Link>
          </Button>
        </PageHeader>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <CaseForm initial={studioCase} privacyRules={rules} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const textFields = CASE_TEXT_FIELDS.filter((f) => f !== "title" && f !== "anonymized_version");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={studioCase.title} description={`${studioCase.case_code} · ${CASE_TYPE_META[studioCase.case_type]?.label ?? studioCase.case_type}`}>
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/studio/cases">
            <ArrowLeft className="h-4 w-4" /> Case Insights
          </Link>
        </Button>
        <CaseDetailActions id={studioCase.id} caseCode={studioCase.case_code} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-1.5">
        {studioCase.is_demo && <Pill className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">DEMO</Pill>}
        {pot && <Pill className={pot.badge}>{pot.label}</Pill>}
        <SensitivityBadge level={studioCase.sensitivity} />
        <ApprovedBadge approved={studioCase.approved_for_content} />
        {studioCase.tags.map((t) => (
          <Pill key={t} className="bg-muted text-muted-foreground border-border">#{t}</Pill>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">บันทึกเคส (ภายใน)</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-[130px_1fr]">
                {textFields.map((f) => {
                  const v = studioCase[f];
                  if (!v) return null;
                  return (
                    <div key={f} className="contents">
                      <dt className="text-xs text-muted-foreground">{CASE_FIELD_LABELS[f]}</dt>
                      <dd className="whitespace-pre-wrap leading-relaxed">{v}</dd>
                    </div>
                  );
                })}
                {textFields.every((f) => !studioCase[f]) && <p className="text-xs text-muted-foreground sm:col-span-2">ยังไม่มีรายละเอียด — กด “แก้ไข” เพื่อเติม</p>}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">เวอร์ชันไม่ระบุตัวตน (ใช้เป็นแหล่ง Case Story)</CardTitle>
            </CardHeader>
            <CardContent>
              {studioCase.anonymized_version ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{studioCase.anonymized_version}</p>
              ) : (
                <p className="text-xs text-muted-foreground">ยังไม่มี — AI จะร่างให้เมื่อกด “สกัดบทเรียนด้วย AI” หรือเขียนเองได้ในหน้าแก้ไข</p>
              )}
            </CardContent>
          </Card>

          <InsightsPanel caseId={studioCase.id} insights={insights} aiAvailable={aiAvailable} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">การใช้กับ AI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <ApproveSwitch id={studioCase.id} approved={studioCase.approved_for_content} action={setCaseApproved} className="w-full justify-between" />
              <p>การอนุมัติเคสเป็นสัญญาณว่าเคสนี้พร้อมใช้เป็นแหล่งข้อมูล — AI จะเห็นเฉพาะบทเรียนที่อนุมัติแล้ว ไม่ใช่บันทึกดิบ</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">รายละเอียด</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs text-muted-foreground">
              <p>รหัส: <span className="font-mono text-foreground">{studioCase.case_code}</span></p>
              <p>ประเภท: <span className="text-foreground">{CASE_TYPE_META[studioCase.case_type]?.label ?? studioCase.case_type}</span></p>
              {studioCase.linked_case_id && (
                <p className="flex items-start gap-1 break-all">
                  <Link2 className="mt-0.5 h-3 w-3 shrink-0" /> เคสจริง: <span className="font-mono">{studioCase.linked_case_id}</span>
                </p>
              )}
              <p>สร้างเมื่อ {formatDate(studioCase.created_at)}</p>
              <p>อัปเดต {formatDate(studioCase.updated_at)}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
