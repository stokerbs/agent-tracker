import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb, Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAiAvailable, resolveAiConfig } from "@/lib/studio/ai";
import { PILLARS } from "@/lib/studio/constants";
import type { AiScores, Idea, Pillar, SourceRef } from "@/lib/studio/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AiUnavailableBanner } from "@/components/studio/ai-status";
import { Button } from "@/components/ui/button";
import { IdeaCard } from "./idea-card";
import { IdeaFilters, STATUS_ACTIVE, type IdeaFilterValues } from "./idea-filters";
import { IdeaToolbar } from "./idea-toolbar";

export const metadata: Metadata = { title: "Idea Bank" };
export const dynamic = "force-dynamic";
// generateContentFromIdea runs a script generation (20–60 s) inside a server action.
export const maxDuration = 120;

const PAGE_SIZE = 60;
const IDEA_STATUSES = ["new", "saved", "rejected", "generated", "archived"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function parseFilters(sp: Search): IdeaFilterValues {
  const pillar = one(sp.pillar);
  const status = one(sp.status);
  const platform = one(sp.platform);
  const campaign = one(sp.campaign);
  return {
    pillar: (PILLARS as string[]).includes(pillar) ? (pillar as Pillar) : null,
    status: IDEA_STATUSES.includes(status) || status === "__all__" ? status : STATUS_ACTIVE,
    platform: platform || null,
    campaign: UUID_RE.test(campaign) ? campaign : null,
    q: one(sp.q).slice(0, 120),
  };
}

/** Strip characters PostgREST treats as filter syntax before using in an `or(...)` clause. */
function sanitizeQuery(q: string): string {
  return q.replace(/[,()%\\"']/g, " ").trim();
}

export default async function IdeaBankPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireRole(["admin"]);
  const filters = parseFilters(await searchParams);
  const supabase = await createClient();

  let query = supabase.from("studio_ideas").select("*").order("created_at", { ascending: false }).limit(PAGE_SIZE);
  if (filters.pillar) query = query.eq("pillar", filters.pillar);
  if (filters.status === STATUS_ACTIVE) query = query.not("status", "in", "(rejected,archived)");
  else if (filters.status !== "__all__") query = query.eq("status", filters.status);
  if (filters.platform) query = query.contains("platforms", [filters.platform]);
  if (filters.campaign) query = query.eq("campaign_id", filters.campaign);
  const q = sanitizeQuery(filters.q);
  if (q) query = query.or(`title.ilike.%${q}%,hook.ilike.%${q}%`);

  const [{ provider }, ideasRes, campaignsRes] = await Promise.all([
    resolveAiConfig(),
    query,
    supabase.from("studio_campaigns").select("id, title").order("created_at", { ascending: false }).limit(30),
  ]);
  if (ideasRes.error) {
    console.error("[studio:ideas] list failed:", ideasRes.error.message);
    throw new Error(`โหลด Idea Bank ไม่สำเร็จ: ${ideasRes.error.message}`);
  }
  const aiAvailable = isAiAvailable(provider);

  const ideas: Idea[] = (ideasRes.data ?? []).map((r) => ({
    ...r,
    ai_scores: (r.ai_scores as AiScores | null) ?? null,
    source_refs: Array.isArray(r.source_refs) ? (r.source_refs as unknown as SourceRef[]) : [],
  }));
  const campaigns = campaignsRes.data ?? [];
  const campaignTitle = new Map(campaigns.map((c) => [c.id, c.title]));

  // Pillar counts for the chip row (within current non-pillar filters, cheap client-side tally).
  const counts: Partial<Record<Pillar | "all", number>> = { all: ideas.length };
  if (!filters.pillar) for (const i of ideas) counts[i.pillar as Pillar] = (counts[i.pillar as Pillar] ?? 0) + 1;

  const isEmptyBank = ideas.length === 0 && !filters.pillar && !filters.platform && !filters.campaign && !filters.q && filters.status === STATUS_ACTIVE;
  const activeCampaign = filters.campaign ? campaignTitle.get(filters.campaign) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Idea Bank"
        description={activeCampaign ? `ไอเดียในแคมเปญ “${activeCampaign}”` : "รวมไอเดียคอนเทนต์จาก Creative Director, AI, และประสบการณ์ของคุณ — เลือก บันทึก แล้วสร้างคอนเทนต์"}
      >
        <IdeaToolbar aiAvailable={aiAvailable} defaultPillar={filters.pillar} />
      </PageHeader>

      {!aiAvailable && <AiUnavailableBanner />}

      <IdeaFilters values={filters} campaigns={campaigns} counts={counts} />

      {ideas.length === 0 ? (
        isEmptyBank ? (
          <EmptyState
            icon={<Lightbulb className="h-6 w-6" />}
            title="ยังไม่มีไอเดียใน Idea Bank"
            description="เริ่มจากบรีฟใน Creative Director ให้ระบบเสนอทั้งแคมเปญ หรือจดไอเดียจากประสบการณ์จริงของคุณเอง"
            action={
              <div className="flex flex-col items-center gap-3">
                <Button asChild variant="outline">
                  <Link href="/studio/director">
                    <Sparkles className="mr-1.5 h-4 w-4 text-violet-500" /> ไปที่ Creative Director
                  </Link>
                </Button>
                <IdeaToolbar aiAvailable={aiAvailable} variant="empty" />
              </div>
            }
          />
        ) : (
          <EmptyState icon={<Lightbulb className="h-6 w-6" />} title="ไม่พบไอเดียที่ตรงกับตัวกรอง" description="ลองเปลี่ยนเสาหลัก สถานะ แพลตฟอร์ม หรือคำค้น" />
        )
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} aiAvailable={aiAvailable} campaignTitle={idea.campaign_id && !filters.campaign ? campaignTitle.get(idea.campaign_id) ?? null : null} />
            ))}
          </div>
          {ideas.length >= PAGE_SIZE && <p className="text-center text-xs text-muted-foreground">แสดง {PAGE_SIZE} รายการล่าสุด — ใช้ตัวกรองหรือคำค้นเพื่อดูรายการอื่น</p>}
        </>
      )}
    </div>
  );
}
