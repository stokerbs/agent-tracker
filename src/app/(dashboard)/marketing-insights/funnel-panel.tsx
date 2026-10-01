import { AlertTriangle, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LEAD_STAGE_LABELS } from "@/lib/marketing/zh/pipeline";
import type { FunnelMetrics } from "@/lib/marketing/zh/funnel";

const THB = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const money = (v: number | null) => (v === null ? "—" : THB.format(v));

/**
 * Lead → qualified → quote → paid funnel with the primary metrics from
 * docs/china-market/12. Two columns: every lead vs the Chinese market only.
 * Server component; states: error banner, empty (no leads yet), data.
 */
export function FunnelPanel({ all, zh, error }: { all: FunnelMetrics; zh: FunnelMetrics; error: boolean }) {
  const rows: { label: string; a: string; z: string }[] = [
    { label: "ลีดทั้งหมด (contact)", a: String(all.leads), z: String(zh.leads) },
    { label: "ผ่านคัดกรอง (qualified)", a: String(all.qualified), z: String(zh.qualified) },
    { label: "ส่งใบเสนอราคา (quote)", a: String(all.quoted), z: String(zh.quoted) },
    { label: "ชำระแล้ว (paid)", a: String(all.paid), z: String(zh.paid) },
    { label: "Lead → Quote", a: pct(all.leadToQuote), z: pct(zh.leadToQuote) },
    { label: "Quote → Paid", a: pct(all.quoteToPaid), z: pct(zh.quoteToPaid) },
    { label: "รายได้รวม", a: money(all.revenue), z: money(zh.revenue) },
    { label: "รายได้ต่อลีด", a: money(all.revenuePerLead), z: money(zh.revenuePerLead) },
    { label: "มูลค่าเฉลี่ยต่อเคส", a: money(all.avgCaseValue), z: money(zh.avgCaseValue) },
  ];

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Funnel: ลีด → ใบเสนอราคา → ชำระ</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">จาก stage ใน /leads (ทั้งหมด vs ตลาดจีน) — ยอดผู้เข้าชมดูใน GA4</p>

        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>โหลดข้อมูล funnel ไม่สำเร็จ ลองรีเฟรชอีกครั้ง</span>
          </div>
        ) : all.leads === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">ยังไม่มีลีดในระบบ — ตัวเลขจะแสดงเมื่อมีลูกค้าติดต่อเข้ามา</p>
        ) : (
          <div className="mt-4 grid gap-6 md:grid-cols-[1fr_auto]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-normal">ตัวชี้วัด</th>
                  <th className="pb-2 text-right font-normal">ทั้งหมด</th>
                  <th className="pb-2 text-right font-normal">ตลาดจีน (zh)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-border/60">
                    <td className="py-1.5">{r.label}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums">{r.a}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums text-primary">{r.z}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="min-w-[14rem] space-y-4 text-xs">
              <div>
                <div className="mb-1.5 font-medium">รายได้ตามแหล่งที่มา</div>
                {all.bySource.slice(0, 5).map((b) => (
                  <div key={b.key} className="flex justify-between gap-3 border-t border-border/60 py-1">
                    <span className="truncate">{b.key}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{b.leads} ลีด · {money(b.revenue)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1.5 font-medium">ลีดจีนตาม stage</div>
                {zh.byStage.length === 0 && <p className="border-t border-border/60 py-1 text-muted-foreground">ยังไม่มีลีดจีน</p>}
                {zh.byStage.map((s) => (
                  <div key={s.stage} className="flex justify-between gap-3 border-t border-border/60 py-1">
                    <span>{LEAD_STAGE_LABELS[s.stage].th}</span>
                    <span className="tabular-nums text-muted-foreground">{s.count}</span>
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
