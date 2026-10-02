import { AlertTriangle, Globe2, Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { FunnelMetrics } from "@/lib/marketing/zh/funnel";
import { CHANNEL_LABELS, isChannel } from "@/lib/marketing/crm";
import type { CplRow } from "@/lib/marketing/ad-spend";

const THB = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const money = (v: number | null) => (v === null ? "—" : THB.format(v));
const PLATFORM_TH: Record<string, string> = { google_ads: "Google Ads", meta: "Meta", line: "LINE Ads", other: "อื่น ๆ" };

export interface ChannelRow { channel: string; leads: number; qualified: number; paid: number; revenue: number }

/**
 * Funnel per locale (TH / EN / ZH / all), lead channels, and cost per lead
 * from imported ad spend (audit Days 31–90). Server component; states:
 * error banner, empty, data.
 */
export function LocaleFunnelPanel({
  byLocale, channels, cpl, windowDays, error,
}: {
  byLocale: { key: string; label: string; m: FunnelMetrics }[];
  channels: ChannelRow[];
  cpl: CplRow[];
  windowDays: number;
  error: boolean;
}) {
  const metrics: { label: string; v: (m: FunnelMetrics) => string }[] = [
    { label: "ลีด", v: (m) => String(m.leads) },
    { label: "ผ่านคัดกรอง", v: (m) => String(m.qualified) },
    { label: "ส่งใบเสนอราคา", v: (m) => String(m.quoted) },
    { label: "ชำระแล้ว", v: (m) => String(m.paid) },
    { label: "Lead → Quote", v: (m) => pct(m.leadToQuote) },
    { label: "Quote → Paid", v: (m) => pct(m.quoteToPaid) },
    { label: "รายได้", v: (m) => money(m.revenue) },
    { label: "รายได้ต่อลีด", v: (m) => money(m.revenuePerLead) },
  ];
  const total = byLocale[0]?.m.leads ?? 0;
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Funnel ตามภาษา · ช่องทางที่มา · ต้นทุนต่อลีด</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">ลีดทั้งหมดตั้งแต่ต้น แยกไทย / อังกฤษ / จีน · ช่องทางจาก first-touch attribution · CPL จากค่าโฆษณาที่นำเข้า ({windowDays} วันล่าสุด)</p>

        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง</span>
          </div>
        ) : total === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">ยังไม่มีลีดในระบบ</p>
        ) : (
          <div className="mt-4 space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-normal">ตัวชี้วัด</th>
                    {byLocale.map((l) => <th key={l.key} className="pb-2 text-right font-normal">{l.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((row) => (
                    <tr key={row.label} className="border-t border-border/60">
                      <td className="py-1.5">{row.label}</td>
                      {byLocale.map((l) => <td key={l.key} className="py-1.5 text-right font-medium tabular-nums">{row.v(l.m)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="text-xs">
                <div className="mb-1.5 flex items-center gap-1.5 font-medium"><Megaphone className="h-3.5 w-3.5 text-primary" /> ลีดตามช่องทาง (ทั้งหมด)</div>
                {channels.length === 0 && <p className="border-t border-border/60 py-1 text-muted-foreground">ยังไม่มีข้อมูลช่องทาง (เริ่มเก็บหลัง migration 0128)</p>}
                {channels.map((c) => (
                  <div key={c.channel} className="flex justify-between gap-3 border-t border-border/60 py-1">
                    <span>{isChannel(c.channel) ? CHANNEL_LABELS[c.channel].th : c.channel}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{c.leads} ลีด · {c.qualified} ผ่าน · {c.paid} จ่าย · {money(c.revenue)}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs">
                <div className="mb-1.5 font-medium">ต้นทุนต่อลีด (CPL) จากค่าโฆษณาที่นำเข้า</div>
                {cpl.length === 0 ? (
                  <p className="border-t border-border/60 py-1 text-muted-foreground">ยังไม่มีค่าโฆษณาในช่วงนี้ — นำเข้า CSV ด้านล่าง</p>
                ) : cpl.map((r) => (
                  <div key={r.platform} className="border-t border-border/60 py-1.5">
                    <div className="flex justify-between gap-3"><span className="font-medium">{PLATFORM_TH[r.platform] ?? r.platform}</span><span className="tabular-nums text-muted-foreground">ใช้ไป {money(r.cost)}</span></div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-muted-foreground tabular-nums">
                      <span>{r.leads} ลีด · CPL {money(r.cpl)}</span>
                      <span>{r.qualified} ผ่าน · CPQL {money(r.cpql)}</span>
                      <span>{r.paid} จ่าย · ROAS {r.roas === null ? "—" : `${r.roas.toFixed(1)}×`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
