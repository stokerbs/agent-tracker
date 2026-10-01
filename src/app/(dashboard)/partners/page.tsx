import type { Metadata } from "next";
import { Handshake, AlertTriangle } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/errors";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { PartnerControls } from "./partner-controls";
import { PARTNER_STAGE_LABELS, PARTNER_TYPE_LABELS, PARTNER_SERVICE_LABELS, isPartnerStage, type PartnerStage } from "@/lib/marketing/zh/partner-pipeline";

export const metadata: Metadata = { title: "Partners" };
export const dynamic = "force-dynamic";

interface Partner {
  id: string;
  org_name: string;
  partner_type: string;
  contact_name: string;
  wechat_id: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  org_website: string | null;
  services: string[];
  expected_volume: string | null;
  message: string | null;
  referral_slug: string;
  stage: string;
  admin_notes: string | null;
  created_at: string;
}

const stageOf = (p: Partner): PartnerStage => (isPartnerStage(p.stage) ? p.stage : "new");

/**
 * B2B partner pipeline (docs/china-market/13). Lists applications from
 * /zh/partners with a stage/notes editor, each partner's referral link and the
 * number of leads attributed to it (marketing_leads.utm_source = referral_slug).
 */
export default async function PartnersPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase.from("marketing_partners").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) reportError(error, "partners:list");
  const partners = (data as Partner[]) ?? [];

  // Attributed leads per referral slug.
  const slugs = partners.map((p) => p.referral_slug);
  const { data: leadRows, error: leadsError } = slugs.length
    ? await supabase.from("marketing_leads").select("utm_source, converted_at").in("utm_source", slugs)
    : { data: [], error: null };
  if (leadsError) reportError(leadsError, "partners:leads");
  const leadsBySlug = new Map<string, { leads: number; paid: number }>();
  for (const r of leadRows ?? []) {
    if (!r.utm_source) continue;
    const e = leadsBySlug.get(r.utm_source) ?? { leads: 0, paid: 0 };
    e.leads += 1;
    if (r.converted_at) e.paid += 1;
    leadsBySlug.set(r.utm_source, e);
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <PageHeader title="พาร์ทเนอร์ B2B (ตลาดจีน)" description="ใบสมัครจาก detectivepulse.com/zh/partners · ลิงก์ referral ของแต่ละราย · จำนวนลีดที่ส่งมา" />
      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <div className="font-medium">โหลดรายชื่อพาร์ทเนอร์ไม่สำเร็จ</div>
              <p className="text-muted-foreground">ลองรีเฟรชหน้าอีกครั้ง หากยังไม่ได้ กรุณาแจ้งผู้ดูแลระบบ</p>
            </div>
          </CardContent>
        </Card>
      ) : partners.length === 0 ? (
        <EmptyState icon={<Handshake className="h-6 w-6" />} title="ยังไม่มีพาร์ทเนอร์สมัครเข้ามา" description="เมื่อมีสำนักงานกฎหมาย/ที่ปรึกษากรอกฟอร์มที่ /zh/partners รายชื่อจะแสดงที่นี่" />
      ) : (
        <div className="space-y-3">
          {leadsError && <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">นับลีดจาก referral ไม่สำเร็จ — รายชื่อแสดงได้ แต่ตัวเลขลีดอาจหายไปชั่วคราว</p>}
          {partners.map((p) => {
            const counts = leadsBySlug.get(p.referral_slug) ?? { leads: 0, paid: 0 };
            return (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold">{p.org_name}</span>
                        <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">{PARTNER_TYPE_LABELS[p.partner_type]?.th ?? p.partner_type}</span>
                        <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{PARTNER_STAGE_LABELS[stageOf(p)].th}</span>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {p.contact_name}
                        {p.wechat_id && <> · WeChat <span className="font-medium text-foreground">{p.wechat_id}</span></>}
                        {p.email && <> · <a href={`mailto:${p.email}`} className="text-primary hover:underline">{p.email}</a></>}
                        {p.phone && <> · <a href={`tel:${p.phone}`} className="text-primary hover:underline">{p.phone}</a></>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <div>{formatDate(p.created_at)}</div>
                      <div className="mt-1 font-medium text-foreground">{counts.leads} ลีด · {counts.paid} ชำระ</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    {(p.city || p.country) && <span><span className="text-muted-foreground">พื้นที่:</span> {[p.city, p.country].filter(Boolean).join(", ")}</span>}
                    {p.expected_volume && <span><span className="text-muted-foreground">ปริมาณ:</span> {p.expected_volume}</span>}
                    {p.org_website && /^https?:\/\//i.test(p.org_website) && (
                      <a href={p.org_website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">เว็บไซต์</a>
                    )}
                    <span><span className="text-muted-foreground">บริการ:</span> {p.services.map((s) => PARTNER_SERVICE_LABELS[s]?.th ?? s).join(", ")}</span>
                  </div>
                  {p.message && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{p.message}</p>}
                  <PartnerControls id={p.id} stage={stageOf(p)} adminNotes={p.admin_notes} referralSlug={p.referral_slug} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
