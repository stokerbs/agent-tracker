import type { Metadata } from "next";
import { Users, MessageSquare, UserPlus, FileText, CheckCircle2, ExternalLink, Target } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { LeadsChart, type WeeklyPoint } from "@/components/marketing/insights-chart";
import { FunnelPanel } from "./funnel-panel";
import { LocaleFunnelPanel, type ChannelRow } from "./locale-funnel-panel";
import { AdSpendImport } from "./ad-spend-import";
import { costPerLead } from "@/lib/marketing/ad-spend";
import { Download } from "lucide-react";
import { computeFunnel, type FunnelLeadRow } from "@/lib/marketing/zh/funnel";
import { reportError } from "@/lib/errors";

export const metadata: Metadata = { title: "Marketing Insights" };
export const dynamic = "force-dynamic";

const WEEKS = 12;
const DAY = 24 * 60 * 60 * 1000;

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Current site-health / SEO status (from the work shipped this cycle). Honest,
// verifiable figures — update if they change.
const HEALTH: { label: string; note?: string }[] = [
  { label: "SEO", note: "100 / 100 (Lighthouse)" },
  { label: "Accessibility", note: "100 / 100" },
  { label: "Best Practices", note: "100 / 100" },
  { label: "Performance", note: "~87 (มือถือ) · CLS 0" },
  { label: "3 ภาษา", note: "ไทย / English / 中文 + hreflang" },
  { label: "Sitemap + robots.txt", note: "ส่ง Google เก็บบทความได้" },
  { label: "Structured data", note: "ธุรกิจ · FAQ · บทความ (rich results)" },
  { label: "รองรับมือถือ + HTTPS", note: "responsive · SSL" },
  { label: "Conversion tracking", note: "GA4 + Google Ads (ตั้งโดย agency)" },
  { label: "แจ้งเตือน lead เข้า LINE", note: "ยิงเข้าไลน์ทันทีที่มีลูกค้า" },
];

const LINKS: { label: string; sub: string; href: string }[] = [
  { label: "รายงานโฆษณา (Google Ads)", sub: "ค่าใช้จ่าย / คลิก / impression — Looker Studio", href: "https://datastudio.google.com/reporting/376fce50-471f-4d42-8558-69f6555d27e0" },
  { label: "Google Search Console", sub: "อันดับ / คำค้น / การ index", href: "https://search.google.com/search-console" },
  { label: "PageSpeed Insights", sub: "วัดคะแนนความเร็ว/SEO สดๆ", href: "https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fdetectivepulse.com" },
];

export default async function MarketingInsightsPage() {
  await requireRole(["admin"]);
  const svc = createServiceClient();
  const rls = await createClient(); // admin RLS read for ad spend (migration 0128)
  const since = new Date(Date.now() - WEEKS * 7 * DAY);

  const [leadsRes, careersRes, articlesRes, funnelRes, spendRes] = await Promise.all([
    svc.from("marketing_leads").select("created_at, source, case_type").gte("created_at", since.toISOString()),
    svc.from("recruitment_applications").select("created_at").gte("created_at", since.toISOString()),
    svc.from("marketing_articles").select("status, published_at"),
    // Funnel (docs/china-market/12): all-time pipeline state, not windowed —
    // conversions lag first contact by weeks.
    svc.from("marketing_leads").select("locale, source, stage, quoted_value, final_revenue, converted_at, service, utm_source, channel, lead_quality, created_at"),
    // Imported ad cost for CPL (migration 0128); last 90 days.
    rls.from("marketing_ad_spend").select("platform, locale, cost, spend_date").gte("spend_date", new Date(Date.now() - 90 * DAY).toISOString().slice(0, 10)),
  ]);
  if (funnelRes.error) reportError(funnelRes.error, "marketing-insights:funnel");
  const funnelRows = (funnelRes.data as FunnelLeadRow[] | null) ?? [];
  const funnelAll = computeFunnel(funnelRows);
  const funnelZh = computeFunnel(funnelRows.filter((r) => r.locale === "zh"));
  // Per-locale funnel + channels + CPL (audit Days 31–90).
  type CrmRow = FunnelLeadRow & { channel: string | null; lead_quality: string | null; created_at: string };
  const crmRows = funnelRows as CrmRow[];
  const byLocale = [
    { key: "all", label: "ทั้งหมด", m: funnelAll },
    { key: "th", label: "ไทย", m: computeFunnel(crmRows.filter((r) => r.locale === "th")) },
    { key: "en", label: "อังกฤษ", m: computeFunnel(crmRows.filter((r) => r.locale === "en")) },
    { key: "zh", label: "จีน", m: funnelZh },
  ];
  const channelMap = new Map<string, ChannelRow>();
  for (const r of crmRows) {
    const key = r.channel ?? "unknown";
    const c = channelMap.get(key) ?? { channel: key, leads: 0, qualified: 0, paid: 0, revenue: 0 };
    c.leads += 1;
    if (r.lead_quality === "qualified" || r.lead_quality === "high_value" || r.converted_at) c.qualified += 1;
    if (r.converted_at) c.paid += 1;
    c.revenue += Number(r.final_revenue ?? 0) || 0;
    channelMap.set(key, c);
  }
  const channels = [...channelMap.values()].sort((a, b) => b.leads - a.leads);
  if (spendRes.error) reportError(spendRes.error, "marketing-insights:ad-spend");
  const spendRows = (spendRes.data as Array<{ platform: string; locale: string; cost: number | string; spend_date: string }> | null) ?? [];
  const cpl = costPerLead(spendRows, crmRows, { from: new Date(Date.now() - 90 * DAY), to: new Date() });
  const leads = (leadsRes.data as Array<{ created_at: string; source: string; case_type: string | null }>) ?? [];
  const careers = (careersRes.data as Array<{ created_at: string }>) ?? [];
  const articles = (articlesRes.data as Array<{ status: string; published_at: string | null }>) ?? [];

  // Weekly buckets (oldest → newest), split by source.
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

  // Top services (by case_type) — which ad topics actually convert.
  const byType = new Map<string, number>();
  for (const l of leads) {
    const t = (l.case_type ?? "").trim() || "ไม่ระบุ";
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  const topServices = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxService = topServices[0]?.[1] ?? 1;

  const now = Date.now();
  const inLast = (rows: Array<{ created_at: string }>, days: number) =>
    rows.filter((r) => now - new Date(r.created_at).getTime() <= days * DAY).length;

  const leadsFromChat = leads.filter((l) => l.source === "assistant").length;
  const published = articles.filter((a) => a.status === "published").length;
  const drafts = articles.filter((a) => a.status === "draft").length;

  const stats = [
    { Icon: Users, label: "ลูกค้าใหม่ (7 วัน)", value: inLast(leads, 7), sub: `30 วัน: ${inLast(leads, 30)}` },
    { Icon: MessageSquare, label: "มาจากแชท AI", value: leadsFromChat, sub: `${WEEKS} สัปดาห์` },
    { Icon: UserPlus, label: "ผู้สมัครงาน", value: inLast(careers, 30), sub: "30 วัน" },
    { Icon: FileText, label: "บทความ AI", value: published, sub: drafts > 0 ? `รออนุมัติ: ${drafts}` : "เผยแพร่แล้ว" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <PageHeader title="ภาพรวมการตลาด & สุขภาพเว็บ" description="ลูกค้าที่เข้ามา · บริการที่คนสนใจ · สถานะ SEO/คุณภาพเว็บ — จาก detectivepulse.com" />

      {/* Overview */}
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

      {/* Lead → quote → paid funnel (all leads vs Chinese market) */}
      <FunnelPanel all={funnelAll} zh={funnelZh} error={Boolean(funnelRes.error)} />
      <LocaleFunnelPanel byLocale={byLocale} channels={channels} cpl={cpl} windowDays={90} error={Boolean(funnelRes.error || spendRes.error)} />

      {/* Ad cost import + Google Ads offline conversions */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-sm font-semibold">ค่าโฆษณา & Offline conversions</h2>
          <p className="mt-1 text-xs text-muted-foreground">นำเข้าค่าใช้จ่ายโฆษณาเพื่อคำนวณ CPL/ROAS · ส่งออกไฟล์ offline conversions (ลีดที่ผ่านคัดกรอง/ชำระ พร้อม gclid) ไปอัปโหลดใน Google Ads</p>
          <div className="mt-4 grid gap-6 md:grid-cols-[1fr_auto]">
            <AdSpendImport />
            <div className="rounded-xl border border-border p-4 text-sm md:w-64">
              <div className="font-medium">Google Ads offline conversions</div>
              <p className="mt-1 text-xs text-muted-foreground">CSV รูปแบบ Conversions from clicks (Qualified lead / Paid case) จาก 90 วันล่าสุด</p>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route handler streams a CSV download, not a page */}
              <a href="/marketing-insights/offline-conversions?days=90" download className="mt-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                <Download className="h-3.5 w-3.5" /> ดาวน์โหลด CSV
              </a>
              <p className="mt-2 text-[11px] text-muted-foreground">ต้องสร้าง conversion action ชื่อเดียวกันใน Google Ads ก่อน (ดู docs/seo-growth-audit/ads-offline-conversions.md)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly leads chart */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold">ลูกค้าติดต่อเข้ามารายสัปดาห์ ({WEEKS} สัปดาห์)</h2>
          <LeadsChart data={buckets} />
        </CardContent>
      </Card>

      {/* Top services + Site health */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">บริการที่คนสนใจมากสุด</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">จากประเภทงานที่ลูกค้าเลือก ({WEEKS} สัปดาห์)</p>
            {topServices.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="mt-4 space-y-3">
                {topServices.map(([type, count]) => (
                  <div key={type}>
                    <div className="flex justify-between text-sm">
                      <span className="truncate">{type}</span>
                      <span className="ml-2 shrink-0 font-medium">{count}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(count / maxService) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">สุขภาพเว็บ & SEO</h2>
            </div>
            <ul className="mt-4 space-y-2.5">
              {HEALTH.map((h) => (
                <li key={h.label} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>
                    <span className="font-medium">{h.label}</span>
                    {h.note && <span className="text-muted-foreground"> — {h.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Deep-dive links */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-sm font-semibold">ดูข้อมูลเชิงลึก (เครื่องมือภายนอก)</h2>
          <p className="mt-1 text-xs text-muted-foreground">ค่าใช้จ่าย/คลิกของโฆษณา + อันดับ SEO อยู่ในเครื่องมือเหล่านี้</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-border p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium group-hover:text-primary">{l.label}</span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{l.sub}</p>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
