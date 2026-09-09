import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Link2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { KNOWLEDGE_CATEGORY_META } from "@/lib/studio/constants";
import type { KnowledgeCategory, KnowledgeSource } from "@/lib/studio/types";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApprovedBadge, ContentStatusBadge, Pill, SensitivityBadge } from "@/components/studio/badges";
import { KnowledgeForm } from "../knowledge-form";
import { KnowledgeDetailActions } from "../knowledge-detail-actions";
import { ApproveSwitch } from "../approve-switch";
import { setKnowledgeApproved } from "../actions";

export const metadata: Metadata = { title: "ความรู้ · Creative Studio" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}

interface UsageRow {
  id: string;
  label: string;
  note: string | null;
  master_id: string;
  studio_content_masters: { id: string; title: string; status: string } | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function KnowledgeDetailPage({ params, searchParams }: Props) {
  await requireRole(["admin"]);
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: k, error }, { data: usage, error: usageErr }] = await Promise.all([
    supabase.from("studio_knowledge_sources").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("studio_content_sources")
      .select("id, label, note, master_id, studio_content_masters(id, title, status)")
      .eq("source_kind", "knowledge")
      .eq("source_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (error) throw new Error(`โหลดความรู้ไม่สำเร็จ: ${error.message}`);
  if (!k) notFound();
  if (usageErr) console.error("[studio:knowledge] usage lookup failed:", usageErr.message);

  const knowledge = k as KnowledgeSource;
  const usageRows = ((usage ?? []) as unknown as UsageRow[]).filter((u) => u.studio_content_masters);
  const editing = sp.edit === "1";
  const cat = KNOWLEDGE_CATEGORY_META[knowledge.category as KnowledgeCategory];

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="แก้ไขความรู้" description={knowledge.title}>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href={`/studio/knowledge/${knowledge.id}`}>
              <ArrowLeft className="h-4 w-4" /> ยกเลิกการแก้ไข
            </Link>
          </Button>
        </PageHeader>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <KnowledgeForm initial={knowledge} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={knowledge.title} description={knowledge.summary ?? undefined}>
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/studio/knowledge">
            <ArrowLeft className="h-4 w-4" /> คลังความรู้
          </Link>
        </Button>
        <KnowledgeDetailActions id={knowledge.id} title={knowledge.title} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-1.5">
        {knowledge.is_demo && <Pill className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">DEMO</Pill>}
        <Pill className="bg-muted text-foreground border-border">{cat?.label ?? knowledge.category}</Pill>
        <SensitivityBadge level={knowledge.sensitivity} />
        <ApprovedBadge approved={knowledge.approved_for_content} />
        {knowledge.tags.map((t) => (
          <Pill key={t} className="bg-muted text-muted-foreground border-border">#{t}</Pill>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <article className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{knowledge.content}</article>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">การใช้กับ AI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <ApproveSwitch id={knowledge.id} approved={knowledge.approved_for_content} action={setKnowledgeApproved} className="w-full justify-between" />
              <p>เมื่ออนุมัติ AI จะเห็นเนื้อหานี้เป็นบล็อกอ้างอิง [K#] เวลาสร้างไอเดียและสคริปต์</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">รายละเอียด</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs text-muted-foreground">
              <p>ประเภทแหล่งข้อมูล: <span className="text-foreground">{knowledge.source_type}</span></p>
              {knowledge.origin_ref && (
                <p className="flex items-start gap-1 break-all">
                  <Link2 className="mt-0.5 h-3 w-3 shrink-0" /> {knowledge.origin_ref}
                </p>
              )}
              <p>สร้างเมื่อ {formatDate(knowledge.created_at)}</p>
              <p>อัปเดต {formatDate(knowledge.updated_at)}</p>
              <p>{knowledge.content.length.toLocaleString()} ตัวอักษร</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">ใช้ในคอนเทนต์</CardTitle>
            </CardHeader>
            <CardContent>
              {usageRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">ยังไม่มีคอนเทนต์ที่อ้างอิงความรู้นี้</p>
              ) : (
                <ul className="space-y-2">
                  {usageRows.map((u) => (
                    <li key={u.id}>
                      <Link href={`/studio/content/${u.master_id}`} className="flex items-start gap-2 rounded-md border border-border/60 bg-card px-2.5 py-2 transition-colors hover:border-border hover:bg-accent">
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{u.studio_content_masters!.title}</span>
                          {u.note && <span className="block truncate text-[11px] text-muted-foreground">{u.note}</span>}
                        </span>
                        <ContentStatusBadge status={u.studio_content_masters!.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
