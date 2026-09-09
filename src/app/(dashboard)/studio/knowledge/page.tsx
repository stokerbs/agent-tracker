import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Plus, Search } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { formatDate, cn } from "@/lib/utils";
import { isAiAvailable } from "@/lib/studio/ai";
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_CATEGORY_META } from "@/lib/studio/constants";
import type { CustomerQuestion, KnowledgeCategory, KnowledgeSource } from "@/lib/studio/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApprovedBadge, Pill, SensitivityBadge } from "@/components/studio/badges";
import { ApproveSwitch } from "./approve-switch";
import { QuestionsPanel } from "./questions-panel";
import { getInboxStats, type InboxStats } from "@/lib/studio/faq-mining";
import { setKnowledgeApproved } from "./actions";

export const metadata: Metadata = { title: "คลังความรู้ · Creative Studio" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ tab?: string; q?: string; category?: string; tag?: string }>;
}

/** PostgREST `or()` filter is comma/paren delimited — strip those from user input. */
function likeTerm(q: string): string {
  return `%${q.replace(/[,()%]/g, " ").trim()}%`;
}

export default async function KnowledgePage({ searchParams }: Props) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const tab = sp.tab === "questions" ? "questions" : "knowledge";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const category = KNOWLEDGE_CATEGORIES.includes(sp.category as KnowledgeCategory) ? (sp.category as KnowledgeCategory) : null;
  const tag = (sp.tag ?? "").trim().slice(0, 40).replace(/[,()"']/g, "") || null;

  const supabase = await createClient();
  const aiAvailable = isAiAvailable();

  let knowledge: KnowledgeSource[] = [];
  let questions: CustomerQuestion[] = [];
  let totalKnowledge = 0;
  let totalQuestions = 0;

  const [{ count: kCount }, { count: qCount }] = await Promise.all([
    supabase.from("studio_knowledge_sources").select("id", { count: "exact", head: true }),
    supabase.from("studio_customer_questions").select("id", { count: "exact", head: true }),
  ]);
  totalKnowledge = kCount ?? 0;
  totalQuestions = qCount ?? 0;

  if (tab === "knowledge") {
    let query = supabase.from("studio_knowledge_sources").select("*").order("updated_at", { ascending: false }).limit(200);
    if (category) query = query.eq("category", category);
    if (tag) query = query.contains("tags", [tag]);
    if (q) {
      const like = likeTerm(q);
      query = query.or(`title.ilike.${like},content.ilike.${like}`);
    }
    const { data, error } = await query;
    if (error) throw new Error(handleDbError(error, "studio:knowledge:list"));
    knowledge = (data ?? []) as KnowledgeSource[];
  } else {
    let query = supabase.from("studio_customer_questions").select("*").order("frequency", { ascending: false }).order("updated_at", { ascending: false }).limit(300);
    if (q) query = query.ilike("question", likeTerm(q));
    const { data, error } = await query;
    if (error) throw new Error(handleDbError(error, "studio:knowledge:questions"));
    questions = (data ?? []) as CustomerQuestion[];
  }
  let inboxStats: InboxStats | null = null;
  if (tab === "questions") {
    try {
      inboxStats = await getInboxStats();
    } catch (e) {
      console.warn("[studio:knowledge] inbox stats failed:", e instanceof Error ? e.message : e);
    }
  }

  const tabHref = (t: "knowledge" | "questions") => (t === "knowledge" ? "/studio/knowledge" : "/studio/knowledge?tab=questions");
  const filterHref = (c: KnowledgeCategory | null, t: string | null = tag) => {
    const params = new URLSearchParams();
    if (c) params.set("category", c);
    if (t) params.set("tag", t);
    if (q) params.set("q", q);
    const s = params.toString();
    return `/studio/knowledge${s ? `?${s}` : ""}`;
  };
  // Review shortcuts for imported knowledge (see docs §11).
  const REVIEW_TAGS: { tag: string; label: string }[] = [
    { tag: "line-import", label: "จากแชท LINE" },
    { tag: "ต้องตรวจ privacy", label: "ต้องตรวจ privacy" },
    { tag: "case-lesson", label: "บทเรียนจากเคส" },
    { tag: "ต้องยืนยัน", label: "ต้องยืนยัน" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="คลังความรู้"
        description="ความรู้จริงของ Detective Pulse ที่ AI ใช้อ้างอิง — เฉพาะรายการที่อนุมัติเท่านั้นที่จะถูกส่งเข้า prompt"
      >
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/studio/knowledge/new">
            <Plus className="h-4 w-4" /> เพิ่มความรู้
          </Link>
        </Button>
      </PageHeader>

      {/* Tabs (URL-driven so the page stays a server component) */}
      <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
        {(
          [
            { key: "knowledge", label: "คลังความรู้", count: totalKnowledge },
            { key: "questions", label: "คำถามลูกค้า", count: totalQuestions },
          ] as const
        ).map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all",
              tab === t.key ? "bg-background text-foreground shadow" : "hover:text-foreground",
            )}
          >
            {t.label}
            <span className="rounded-full bg-muted-foreground/10 px-1.5 text-[11px] tabular-nums">{t.count}</span>
          </Link>
        ))}
      </div>

      {/* Search */}
      <form method="get" action="/studio/knowledge" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {tab === "questions" && <input type="hidden" name="tab" value="questions" />}
        {category && <input type="hidden" name="category" value={category} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder={tab === "knowledge" ? "ค้นหาชื่อเรื่องหรือเนื้อหา…" : "ค้นหาคำถาม…"} className="pl-9" maxLength={100} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" size="sm">ค้นหา</Button>
          {q && (
            <Button asChild variant="ghost" size="sm">
              <Link href={tab === "questions" ? "/studio/knowledge?tab=questions" : filterHref(category)}>ล้าง</Link>
            </Button>
          )}
        </div>
      </form>

      {tab === "knowledge" ? (
        <>
          {/* Review-tag chips (imported knowledge) */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="mr-1">แท็ก:</span>
            {REVIEW_TAGS.map((t) => (
              <Link key={t.tag} href={filterHref(category, tag === t.tag ? null : t.tag)} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", tag === t.tag ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-border text-muted-foreground hover:bg-accent")}>
                {t.label}
              </Link>
            ))}
            {tag && !REVIEW_TAGS.some((t) => t.tag === tag) && <span className="rounded-full border border-amber-500 bg-amber-500/10 px-3 py-1 text-amber-700 dark:text-amber-300">#{tag}</span>}
          </div>
          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5">
            <Link href={filterHref(null)} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", !category ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>
              ทั้งหมด
            </Link>
            {KNOWLEDGE_CATEGORIES.map((c) => (
              <Link key={c} href={filterHref(c)} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", category === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>
                {KNOWLEDGE_CATEGORY_META[c].label}
              </Link>
            ))}
          </div>

          {totalKnowledge === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title="คลังความรู้ยังว่าง"
              description="เริ่มจากความรู้จริงของบริษัท — บริการ คำถามที่พบบ่อย ประสบการณ์เฝ้าติดตาม — หรือโหลดข้อมูลตัวอย่างเพื่อดูว่าระบบทำงานอย่างไร"
              action={
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild size="sm">
                    <Link href="/studio/knowledge/new">เพิ่มความรู้แรก</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/studio/settings">โหลดข้อมูลตัวอย่าง</Link>
                  </Button>
                </div>
              }
            />
          ) : knowledge.length === 0 ? (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="ไม่พบรายการที่ตรงกับตัวกรอง"
              description="ลองเปลี่ยนหมวดหมู่หรือคำค้น"
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/studio/knowledge">ล้างตัวกรอง</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {knowledge.map((k) => (
                <KnowledgeCard key={k.id} k={k} />
              ))}
            </div>
          )}
        </>
      ) : (
        <QuestionsPanel questions={questions} aiAvailable={aiAvailable} query={q} inboxStats={inboxStats} />
      )}
    </div>
  );
}

function KnowledgeCard({ k }: { k: KnowledgeSource }) {
  const cat = KNOWLEDGE_CATEGORY_META[k.category as KnowledgeCategory];
  return (
    <Card className="flex flex-col transition-colors hover:border-border">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/studio/knowledge/${k.id}`} className="min-w-0 flex-1 text-sm font-medium leading-snug hover:underline">
            {k.title}
          </Link>
          {k.is_demo && <Pill className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">DEMO</Pill>}
        </div>
        <p className="line-clamp-3 text-xs text-muted-foreground">{k.summary ?? k.content}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill className="bg-muted text-foreground border-border">{cat?.label ?? k.category}</Pill>
          <SensitivityBadge level={k.sensitivity} />
          <ApprovedBadge approved={k.approved_for_content} />
        </div>
        {k.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {k.tags.slice(0, 5).map((t) => (
              <span key={t} className="text-[11px] text-muted-foreground">#{t}</span>
            ))}
            {k.tags.length > 5 && <span className="text-[11px] text-muted-foreground">+{k.tags.length - 5}</span>}
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <span className="text-[11px] text-muted-foreground">อัปเดต {formatDate(k.updated_at)}</span>
          <ApproveSwitch id={k.id} approved={k.approved_for_content} action={setKnowledgeApproved} />
        </div>
      </CardContent>
    </Card>
  );
}
