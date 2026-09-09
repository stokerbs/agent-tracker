import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Bookmark, Eye, Heart, Lightbulb, Share2, Target, UserCheck } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PILLAR_META, PILLARS, PLATFORM_META } from "@/lib/studio/constants";
import type { Pillar, Platform } from "@/lib/studio/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/studio/badges";
import { ViewsByPillarChart, ViewsByPlatformChart, type ChartPoint } from "./charts";
import { PublishedTable, type PublishedRow, type SnapshotView } from "./published-table";

export const metadata: Metadata = { title: "Studio Analytics" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;

interface MasterRow {
  id: string;
  title: string;
  pillar: string;
  primary_platform: string | null;
  published_at: string | null;
  published_url: string | null;
}

interface AnalyticsRow extends SnapshotView {
  master_id: string;
  reach: number | null;
  avg_watch_sec: number | null;
  profile_visits: number | null;
  dms: number | null;
}

const ROADMAP: { title: string; detail: string }[] = [
  { title: "Hook แบบไหนหยุดนิ้วคนได้", detail: "เทียบ completion_rate / avg_watch_sec ต่อรูปแบบ hook ใน studio_content_masters.hook" },
  { title: "หัวข้อไหนสร้าง lead จริง", detail: "leads + qualified_leads ต่อ pillar และต่อ knowledge source ที่ใช้ (studio_content_sources)" },
  { title: "แพลตฟอร์มไหนคุ้มเวลาที่สุด", detail: "views/leads ต่อชิ้น เทียบกับเวลาที่ใช้ผลิต (ยังไม่มีการเก็บเวลาผลิต)" },
  { title: "สัดส่วน pillar ที่เหมาะ", detail: "ผลจริงเทียบกับเป้าหมายในตั้งค่า → ปรับ target_pct" },
  { title: "เวลาโพสต์ที่ดีที่สุด", detail: "ต้องมีข้อมูลหลายสิบชิ้นก่อนจึงจะมีนัยสำคัญ" },
];

export default async function StudioAnalyticsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: mastersData, error: mErr } = await supabase
    .from("studio_content_masters")
    .select("id, title, pillar, primary_platform, published_at, published_url")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });
  if (mErr) {
    console.error("[studio:analytics] masters query failed:", mErr.message);
    throw new Error("Failed to load published content");
  }
  const masters = (mastersData ?? []) as MasterRow[];

  let analytics: AnalyticsRow[] = [];
  if (masters.length > 0) {
    const { data, error } = await supabase
      .from("studio_analytics")
      .select("id, master_id, platform, recorded_at, views, reach, likes, comments, shares, saves, avg_watch_sec, completion_rate, profile_visits, dms, leads, qualified_leads, conversions, note")
      .in("master_id", masters.map((m) => m.id))
      .order("recorded_at", { ascending: false })
      .limit(5000);
    if (error) {
      console.error("[studio:analytics] analytics query failed:", error.message);
      throw new Error("Failed to load analytics");
    }
    analytics = (data ?? []) as AnalyticsRow[];
  }

  // ── Latest snapshot per (master, platform). Snapshots are cumulative
  //    readings, so summing every row would double-count; we take the newest.
  const latestByKey = new Map<string, AnalyticsRow>();
  const historyByMaster = new Map<string, AnalyticsRow[]>();
  for (const row of analytics) {
    const key = `${row.master_id}:${row.platform}`;
    if (!latestByKey.has(key)) latestByKey.set(key, row); // rows are newest-first
    const h = historyByMaster.get(row.master_id) ?? [];
    h.push(row);
    historyByMaster.set(row.master_id, h);
  }

  const since = Date.now() - WINDOW_DAYS * DAY;
  const recentLatest = [...latestByKey.values()].filter((r) => new Date(r.recorded_at).getTime() >= since);
  const sum = (pick: (r: AnalyticsRow) => number | null) => recentLatest.reduce((s, r) => s + (pick(r) ?? 0), 0);

  const totals = {
    views: sum((r) => r.views),
    likes: sum((r) => r.likes),
    shares: sum((r) => r.shares),
    saves: sum((r) => r.saves),
    leads: sum((r) => r.leads),
    qualified: sum((r) => r.qualified_leads),
  };
  const withMetrics = masters.filter((m) => historyByMaster.has(m.id)).length;
  const withoutMetrics = masters.length - withMetrics;

  // ── Charts (all-time latest snapshots, grouped) ────────────────────────────
  const pillarOf = new Map(masters.map((m) => [m.id, m.pillar]));
  const byPillar = new Map<string, ChartPoint>();
  const byPlatform = new Map<string, ChartPoint>();
  for (const r of latestByKey.values()) {
    const pillar = pillarOf.get(r.master_id) ?? "other";
    const p = byPillar.get(pillar) ?? { key: pillar, label: PILLAR_META[pillar as Pillar]?.label ?? pillar, views: 0, leads: 0 };
    p.views += r.views ?? 0;
    p.leads += r.leads ?? 0;
    byPillar.set(pillar, p);
    const q = byPlatform.get(r.platform) ?? { key: r.platform, label: PLATFORM_META[r.platform as Platform]?.short ?? r.platform, views: 0, leads: 0 };
    q.views += r.views ?? 0;
    q.leads += r.leads ?? 0;
    byPlatform.set(r.platform, q);
  }
  const pillarPoints: ChartPoint[] = PILLARS.map(
    (k) => byPillar.get(k) ?? { key: k, label: PILLAR_META[k].label, views: 0, leads: 0 },
  );
  const platformPoints: ChartPoint[] = [...byPlatform.values()].sort((a, b) => b.views - a.views);
  const hasAnyMetrics = latestByKey.size > 0;

  // ── Table rows ─────────────────────────────────────────────────────────────
  const toView = (r: AnalyticsRow): SnapshotView => ({
    id: r.id,
    platform: r.platform,
    recorded_at: r.recorded_at,
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    shares: r.shares,
    saves: r.saves,
    completion_rate: r.completion_rate,
    leads: r.leads,
    qualified_leads: r.qualified_leads,
    conversions: r.conversions,
    note: r.note,
  });
  const rows: PublishedRow[] = masters.map((m) => {
    const history = historyByMaster.get(m.id) ?? [];
    return { ...m, latest: history[0] ? toView(history[0]) : null, history: history.map(toView) };
  });

  const tiles = [
    { Icon: Eye, label: "ยอดวิว", value: totals.views },
    { Icon: Heart, label: "ไลก์", value: totals.likes },
    { Icon: Share2, label: "แชร์", value: totals.shares },
    { Icon: Bookmark, label: "บันทึก", value: totals.saves },
    { Icon: Target, label: "Leads", value: totals.leads },
    { Icon: UserCheck, label: "Qualified leads", value: totals.qualified },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="สถิติคอนเทนต์"
        description="V1 = บันทึกผลด้วยมือหลังโพสต์ (ยังไม่เชื่อม API โซเชียล) — ระบบเก็บเป็นสแนปช็อต และใช้ค่าล่าสุดของแต่ละชิ้น/แพลตฟอร์มในการรวมยอด"
      >
        <Pill className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">Manual entry · V1</Pill>
      </PageHeader>

      {masters.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<BarChart3 className="h-6 w-6" />}
              title="ยังไม่มีคอนเทนต์ที่เผยแพร่"
              description="เมื่อทำเครื่องหมายคอนเทนต์เป็น 'เผยแพร่แล้ว' ในหน้าคอนเทนต์ รายการจะมาอยู่ที่นี่เพื่อบันทึกผล"
              action={
                <Button asChild size="sm">
                  <Link href="/studio/content">ไปที่คอนเทนต์</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary tiles */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">สแนปช็อตที่บันทึกใน {WINDOW_DAYS} วันล่าสุด</p>
              <p className="text-xs text-muted-foreground">
                เผยแพร่ {masters.length} ชิ้น · มีข้อมูล <span className="font-medium text-foreground">{withMetrics}</span> · ยังไม่มีข้อมูล{" "}
                <span className={withoutMetrics > 0 ? "font-medium text-amber-600 dark:text-amber-400" : ""}>{withoutMetrics}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {tiles.map((t) => (
                <Card key={t.label}>
                  <CardContent className="p-4">
                    <t.Icon className="h-4 w-4 text-primary" />
                    <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{t.value.toLocaleString("en-GB")}</div>
                    <div className="text-xs text-muted-foreground">{t.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">ยอดวิวตาม Pillar</CardTitle>
                <CardDescription>ค่าล่าสุดของแต่ละชิ้น รวมตาม pillar (ทุกช่วงเวลา)</CardDescription>
              </CardHeader>
              <CardContent>
                {hasAnyMetrics ? <ViewsByPillarChart data={pillarPoints} /> : <ChartEmpty />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">ยอดวิวตามแพลตฟอร์ม</CardTitle>
                <CardDescription>เฉพาะแพลตฟอร์มที่มีการบันทึก</CardDescription>
              </CardHeader>
              <CardContent>
                {hasAnyMetrics ? <ViewsByPlatformChart data={platformPoints} /> : <ChartEmpty />}
              </CardContent>
            </Card>
          </div>

          {/* Published table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">คอนเทนต์ที่เผยแพร่แล้ว</CardTitle>
              <CardDescription>กด &quot;บันทึกผล&quot; หลังโพสต์ 24 ชม. / 7 วัน / 30 วัน เพื่อดูแนวโน้ม — กดลูกศรเพื่อดูประวัติ</CardDescription>
            </CardHeader>
            <CardContent>
              <PublishedTable rows={rows} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Roadmap */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lightbulb className="h-4 w-4 text-amber-500" /> หลักการเรียนรู้ (roadmap)
            <Pill className="bg-muted text-muted-foreground border-border">ยังไม่อัตโนมัติ</Pill>
          </CardTitle>
          <CardDescription>สิ่งที่ข้อมูลชุดนี้จะสอนเราได้เมื่อมีมากพอ — ตอนนี้ยังต้องอ่านและตีความเอง ไม่มีโมเดลทำนาย</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ROADMAP.map((r) => (
              <li key={r.title} className="rounded-lg border bg-muted/20 p-3">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ChartEmpty() {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed text-center">
      <div>
        <p className="text-sm text-muted-foreground">ยังไม่มีสแนปช็อต</p>
        <p className="mt-1 text-xs text-muted-foreground/70">บันทึกผลจากตารางด้านล่างเพื่อให้กราฟแสดง</p>
      </div>
    </div>
  );
}
