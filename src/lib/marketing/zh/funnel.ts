import { funnelStep, isLeadStage, type LeadStage } from "./pipeline";

/**
 * Funnel aggregation for /marketing-insights (docs/china-market/12).
 * Pure: takes lead rows, returns the primary metrics. Visitor counts live in
 * GA4; everything from CONTACT onward is computed here from the DB.
 */
export interface FunnelLeadRow {
  locale: string;
  source: string;
  stage: string | null;
  quoted_value: number | string | null;
  final_revenue: number | string | null;
  converted_at: string | null;
  service: string | null;
  utm_source: string | null;
}

export interface FunnelBreakdown {
  key: string;
  leads: number;
  paid: number;
  revenue: number;
}

export interface FunnelMetrics {
  leads: number;
  qualified: number;
  quoted: number;
  paid: number;
  /** quoted / qualified (0–1), null when no qualified leads. */
  leadToQuote: number | null;
  /** paid / quoted (0–1), null when no quotes. */
  quoteToPaid: number | null;
  revenue: number;
  quotedTotal: number;
  revenuePerLead: number | null;
  avgCaseValue: number | null;
  bySource: FunnelBreakdown[];
  byService: FunnelBreakdown[];
  byStage: { stage: LeadStage; count: number }[];
}

const num = (v: number | string | null): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function breakdown(rows: FunnelLeadRow[], keyOf: (r: FunnelLeadRow) => string): FunnelBreakdown[] {
  const map = new Map<string, FunnelBreakdown>();
  for (const r of rows) {
    const key = keyOf(r);
    const b = map.get(key) ?? { key, leads: 0, paid: 0, revenue: 0 };
    b.leads += 1;
    if (r.converted_at) b.paid += 1;
    b.revenue += num(r.final_revenue);
    map.set(key, b);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue || b.leads - a.leads || a.key.localeCompare(b.key));
}

export function computeFunnel(rows: FunnelLeadRow[]): FunnelMetrics {
  let qualified = 0, quoted = 0, paid = 0, revenue = 0, quotedTotal = 0;
  const stageCounts = new Map<LeadStage, number>();
  for (const r of rows) {
    const stage: LeadStage = isLeadStage(r.stage) ? r.stage : "new";
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
    const step = funnelStep(stage);
    if (step === "qualified" || step === "quote" || step === "paid") qualified += 1;
    if (step === "quote" || step === "paid") quoted += 1;
    if (step === "paid" || r.converted_at) paid += 1;
    revenue += num(r.final_revenue);
    quotedTotal += num(r.quoted_value);
  }
  const leads = rows.length;
  return {
    leads,
    qualified,
    quoted,
    paid,
    leadToQuote: qualified ? quoted / qualified : null,
    quoteToPaid: quoted ? paid / quoted : null,
    revenue,
    quotedTotal,
    revenuePerLead: leads ? revenue / leads : null,
    avgCaseValue: paid ? revenue / paid : null,
    bySource: breakdown(rows, (r) => (r.utm_source?.trim() ? `${r.source} / ${r.utm_source.trim()}` : r.source)),
    byService: breakdown(rows, (r) => r.service?.trim() || "unspecified"),
    byStage: [...stageCounts.entries()].map(([stage, count]) => ({ stage, count })),
  };
}
