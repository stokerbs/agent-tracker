import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, FolderSearch, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate } from "@/lib/utils";
import type { StudioCase } from "@/lib/studio/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApprovedBadge, Pill, SensitivityBadge } from "@/components/studio/badges";
import { ApproveSwitch } from "../knowledge/approve-switch";
import { setCaseApproved } from "./actions";
import { CASE_TYPE_META, POTENTIAL_META, PRIVACY_NOTE } from "./case-types";

export const metadata: Metadata = { title: "Case Insights · Creative Studio" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ type?: string; approved?: string }>;
}

interface InsightCountRow {
  case_id: string;
  approved_for_content: boolean;
}

export default async function StudioCasesPage({ searchParams }: Props) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const approvedOnly = sp.approved === "1";

  const supabase = await createClient();
  const [{ data: allCases, error }, { data: insightRows, error: insErr }] = await Promise.all([
    supabase.from("studio_cases").select("*").order("updated_at", { ascending: false }).limit(300),
    supabase.from("studio_case_insights").select("case_id, approved_for_content").limit(5000),
  ]);
  if (error) throw new Error(`โหลดเคสไม่สำเร็จ: ${error.message}`);
  if (insErr) console.error("[studio:cases] insight counts failed:", insErr.message);

  const cases = (allCases ?? []) as StudioCase[];
  const typesInData = Array.from(new Set(cases.map((c) => c.case_type))).sort();
  const type = typesInData.includes(sp.type ?? "") ? (sp.type as string) : null;

  const counts = new Map<string, { total: number; approved: number }>();
  for (const r of (insightRows ?? []) as InsightCountRow[]) {
    const c = counts.get(r.case_id) ?? { total: 0, approved: 0 };
    c.total += 1;
    if (r.approved_for_content) c.approved += 1;
    counts.set(r.case_id, c);
  }

  const visible = cases.filter((c) => (!type || c.case_type === type) && (!approvedOnly || c.approved_for_content));

  const href = (opts: { type?: string | null; approved?: boolean }) => {
    const params = new URLSearchParams();
    const t = opts.type === undefined ? type : opts.type;
    const a = opts.approved === undefined ? approvedOnly : opts.approved;
    if (t) params.set("type", t);
    if (a) params.set("approved", "1");
    const s = params.toString();
    return `/studio/cases${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Case Insights" description="บันทึกเคสแบบ generalise → AI สกัดบทเรียน → อนุมัติบทเรียนที่ปลอดภัยให้ใช้สร้างคอนเทนต์">
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/studio/cases/new">
            <Plus className="h-4 w-4" /> เพิ่มเคส
          </Link>
        </Button>
      </PageHeader>

      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-medium text-amber-700 dark:text-amber-300">{PRIVACY_NOTE}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ตารางนี้เป็นคลังความรู้ของสตูดิโอ แยกจากเคสจริงในระบบปฏิบัติการ — สตูดิโอไม่อ่านข้อมูลลูกค้าหรือเป้าหมายจากเคสจริงเด็ดขาด
          </p>
        </div>
      </div>

      {cases.length === 0 ? (
        <EmptyState
          icon={<FolderSearch className="h-6 w-6" />}
          title="ยังไม่มีเคสในสตูดิโอ"
          description="เริ่มบันทึกเคสที่จบแล้วในรูปแบบ generalise เพื่อให้ AI ช่วยสกัดบทเรียน หรือโหลดเคสตัวอย่าง (DEMO) จากตั้งค่าสตูดิโอ"
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild size="sm">
                <Link href="/studio/cases/new">เพิ่มเคสแรก</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/studio/settings">โหลดข้อมูลตัวอย่าง</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              <Link href={href({ type: null })} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", !type ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>
                ทุกประเภท
              </Link>
              {typesInData.map((t) => (
                <Link key={t} href={href({ type: t })} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", type === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>
                  {CASE_TYPE_META[t]?.label ?? t}
                </Link>
              ))}
            </div>
            <Link
              href={href({ approved: !approvedOnly })}
              className={cn("inline-flex items-center gap-2 self-start rounded-full border px-3 py-1 text-xs transition-colors", approvedOnly ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border text-muted-foreground hover:bg-accent")}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", approvedOnly ? "bg-emerald-500" : "bg-muted-foreground/40")} />
              เฉพาะที่อนุมัติให้ AI ใช้
            </Link>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<FolderSearch className="h-6 w-6" />}
              title="ไม่มีเคสที่ตรงกับตัวกรอง"
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/studio/cases">ล้างตัวกรอง</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((c) => {
                const n = counts.get(c.id) ?? { total: 0, approved: 0 };
                const pot = POTENTIAL_META[c.content_potential];
                return (
                  <Card key={c.id} className="flex flex-col transition-colors hover:border-border">
                    <CardContent className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] text-muted-foreground">{c.case_code}</p>
                          <Link href={`/studio/cases/${c.id}`} className="block text-sm font-medium leading-snug hover:underline">
                            {c.title}
                          </Link>
                        </div>
                        {c.is_demo && <Pill className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">DEMO</Pill>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Pill className="bg-muted text-foreground border-border">{CASE_TYPE_META[c.case_type]?.label ?? c.case_type}</Pill>
                        {pot && <Pill className={pot.badge}>{pot.label}</Pill>}
                        <SensitivityBadge level={c.sensitivity} />
                        <ApprovedBadge approved={c.approved_for_content} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        บทเรียน: อนุมัติ <span className="font-medium text-foreground">{n.approved}</span>/{n.total}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                        <span className="text-[11px] text-muted-foreground">อัปเดต {formatDate(c.updated_at)}</span>
                        <ApproveSwitch id={c.id} approved={c.approved_for_content} action={setCaseApproved} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
