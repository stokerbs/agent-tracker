/**
 * Chinese-lead CRM pipeline (docs/china-market/11). Stored in
 * marketing_leads.stage (check constraint in migration 0124). The legacy
 * `status` column (new | contacted | closed) is derived from the stage so the
 * older /leads views and the weekly digest keep working.
 */
export const LEAD_STAGES = [
  "new",
  "contacted",
  "qualified",
  "requirements_received",
  "quotation_sent",
  "follow_up",
  "payment_pending",
  "paid",
  "case_created",
  "investigation_active",
  "report_delivered",
  "closed",
  "referral",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, { zh: string; th: string; en: string }> = {
  new:                   { zh: "新线索",       th: "ลีดใหม่",            en: "New lead" },
  contacted:             { zh: "已联系",       th: "ติดต่อแล้ว",          en: "Contacted" },
  qualified:             { zh: "已评估合格",   th: "ผ่านคัดกรอง",         en: "Qualified" },
  requirements_received: { zh: "已收需求",     th: "ได้รับรายละเอียด",     en: "Requirements received" },
  quotation_sent:        { zh: "已报价",       th: "ส่งใบเสนอราคาแล้ว",    en: "Quotation sent" },
  follow_up:             { zh: "跟进中",       th: "ติดตามผล",            en: "Follow-up" },
  payment_pending:       { zh: "待付款",       th: "รอชำระเงิน",          en: "Payment pending" },
  paid:                  { zh: "已付款",       th: "ชำระแล้ว",            en: "Paid" },
  case_created:          { zh: "已立案",       th: "สร้างเคสแล้ว",        en: "Case created" },
  investigation_active:  { zh: "调查进行中",   th: "กำลังสืบ",            en: "Investigation active" },
  report_delivered:      { zh: "已交付报告",   th: "ส่งรายงานแล้ว",       en: "Report delivered" },
  closed:                { zh: "已结案",       th: "ปิดงาน",              en: "Closed" },
  referral:              { zh: "回访/转介",    th: "ติดตาม/แนะนำต่อ",     en: "Follow-up / referral" },
};

export function isLeadStage(v: unknown): v is LeadStage {
  return typeof v === "string" && (LEAD_STAGES as readonly string[]).includes(v);
}

/** Legacy status derived from the pipeline stage. */
export function legacyStatusFor(stage: LeadStage): "new" | "contacted" | "closed" {
  if (stage === "new") return "new";
  if (stage === "closed" || stage === "referral") return "closed";
  return "contacted";
}

/** Stages at/after which a lead counts as converted (first-payment funnel step). */
export const PAID_STAGES: readonly LeadStage[] = ["paid", "case_created", "investigation_active", "report_delivered", "closed", "referral"];
export const QUOTED_STAGES: readonly LeadStage[] = ["quotation_sent", "follow_up", "payment_pending", ...PAID_STAGES];
export const QUALIFIED_STAGES: readonly LeadStage[] = ["qualified", "requirements_received", ...QUOTED_STAGES];

/** Funnel step for a stage: visitor → contact → qualified → quote → paid. */
export function funnelStep(stage: LeadStage): "contact" | "qualified" | "quote" | "paid" {
  if (PAID_STAGES.includes(stage)) return "paid";
  if (QUOTED_STAGES.includes(stage)) return "quote";
  if (QUALIFIED_STAGES.includes(stage)) return "qualified";
  return "contact";
}
