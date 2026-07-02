import type { Metadata } from "next";
import { Users, MessageSquare, UserPlus, FileText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { LeadsChart, type WeeklyPoint } from "@/components/marketing/insights-chart";

export const metadata: Metadata = { title: "Marketing Insights" };
export const dynamic = "force-dynamic";

const WEEKS = 12;
const DAY = 24 * 60 * 60 * 1000;

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function MarketingInsightsPage() {
  await requireRole(["admin"]);
  const svc = createServiceClient();
  const since = new Date(Date.now() - WEEKS * 7 * DAY);

  const [leadsRes, careersRes, articlesRes] = await Promise.all([
    svc.from("marketing_leads").select("created_at, source").gte("created_at", since.toISOString()),
    svc.from("recruitment_applications").select("created_at").gte("created_at", since.toISOString()),
    svc.from("marketing_articles").select("status, published_at"),
  ]);
  const leads = (leadsRes.data as Array<{ created_at: string; source: string }>) ?? [];
  const careers = (careersRes.data as Array<{ created_at: string }>) ?? [];
  const articles = (articlesRes.data as Array<{ status: string; published_at: string | null }>) ?? [];

  // Build 12 weekly buckets (oldest → newest).
  const buckets: WeeklyPoint[] = [];
  const bucketStart: number[] = [];
  const base = Date.now() - (WEEKS - 1) * 7 * DAY;
  for (let i = 0; i < WEEKS; i++) {
    const start = base + i * 7 * DAY;
    bucketStart.push(start);
    buckets.push({ week: weekLabel(new Date(start)), form: 0, chat: 0 });
  }
  const idxFor = (ts: number) => {
    const i = Math.floor((ts - bucketStart[0]!) / (7 * DAY));
    return i >= 0 && i < WEEKS ? i : -1;
  };
  for (const l of leads) {
    const i = idxFor(new Date(l.created_at).getTime());
    if (i < 0) continue;
    if (l.source === "assistant") buckets[i]!.chat += 1;
    else buckets[i]!.form += 1;
  }

  const now = Date.now();
  const inLast = (rows: Array<{ created_at: string }>, days: number) =>
    rows.filter((r) => now - new Date(r.created_at).getTime() <= days * DAY).length;

  const leadsWeek = inLast(leads, 7);
  const leadsMonth = inLast(leads, 30);
  const leadsFromChat = leads.filter((l) => l.source === "assistant").length;
  const published = articles.filter((a) => a.status === "published").length;
  const drafts = articles.filter((a) => a.status === "draft").length;

  const stats = [
    { Icon: Users, label: "ลูกค้าใหม่ (7 วัน)", value: leadsWeek, sub: `30 วัน: ${leadsMonth}` },
    { Icon: MessageSquare, label: "มาจากแชท AI", value: leadsFromChat, sub: `${WEEKS} สัปดาห์` },
    { Icon: UserPlus, label: "ผู้สมัครงาน", value: inLast(careers, 30), sub: "30 วัน" },
    { Icon: FileText, label: "บทความ AI", value: published, sub: drafts > 0 ? `รออนุมัติ: ${drafts}` : "เผยแพร่แล้ว" },
  ];

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <PageHeader title="สรุปการตลาด" description="ภาพรวมลูกค้าที่เข้ามา บทความ และผู้สมัครงาน — จากเว็บ detectivepulse.com" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <s.Icon className="h-5 w-5 text-primary" />
              <div className="mt-2 text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground/70">{s.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardContent className="p-4 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold">ลูกค้าติดต่อเข้ามารายสัปดาห์ ({WEEKS} สัปดาห์)</h2>
          <LeadsChart data={buckets} />
        </CardContent>
      </Card>
    </div>
  );
}
