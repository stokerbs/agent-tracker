import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { isAiAvailable, resolveAiConfig } from "@/lib/studio/ai";
import { PageHeader } from "@/components/shared/page-header";
import { AiUnavailableBanner } from "@/components/studio/ai-status";
import { PillarBadge, PlatformChips } from "@/components/studio/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DirectorPanel } from "./director-panel";

export const metadata: Metadata = { title: "Creative Director" };
export const dynamic = "force-dynamic";
// Campaign generation (Opus, high effort) can take up to a minute.
export const maxDuration = 120;

interface RecentCampaign {
  id: string;
  title: string;
  pillar: string | null;
  platforms: string[];
  post_count: number | null;
  status: string;
  created_at: string;
  idea_count: number;
}

async function loadRecentCampaigns(): Promise<RecentCampaign[]> {
  const supabase = await createClient();
  const { data: campaigns, error } = await supabase
    .from("studio_campaigns")
    .select("id, title, pillar, platforms, post_count, status, created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) {
    console.error("[studio:director] recent campaigns failed:", error.message);
    return [];
  }
  const ids = (campaigns ?? []).map((c) => c.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: ideas } = await supabase.from("studio_ideas").select("campaign_id").in("campaign_id", ids);
    for (const i of ideas ?? []) if (i.campaign_id) counts.set(i.campaign_id, (counts.get(i.campaign_id) ?? 0) + 1);
  }
  return (campaigns ?? []).map((c) => ({ ...c, idea_count: counts.get(c.id) ?? 0 }));
}

export default async function CreativeDirectorPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole(["admin"]);
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q.slice(0, 2000) : "";

  const [{ provider, model }, recent] = await Promise.all([resolveAiConfig(), loadRecentCampaigns()]);
  const aiAvailable = isAiAvailable(provider);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Creative Director"
        description="พิมพ์บรีฟสั้น ๆ แล้วให้ระบบเสนอแคมเปญทั้งชุด — ตีความบรีฟ จัดสัดส่วนเสาหลัก และร่างไอเดียจากคลังความรู้ของ Detective Pulse"
      >
        <span className="hidden text-xs text-muted-foreground sm:inline">
          model: <span className="font-mono">{model}</span>
        </span>
      </PageHeader>

      {!aiAvailable && <AiUnavailableBanner reason={provider === "openai" ? "provider OpenAI ยังไม่รองรับใน V1 — เปลี่ยนเป็น Anthropic ในตั้งค่าสตูดิโอ" : undefined} />}

      <DirectorPanel initialQuery={initialQuery} aiAvailable={aiAvailable} />

      <section className="pt-2">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              แคมเปญล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">ยังไม่มีแคมเปญ — สร้างแคมเปญแรกจากบรีฟด้านบน</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {recent.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/studio/ideas?campaign=${c.id}`}
                      className="flex flex-col gap-2 px-5 py-3 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(c.created_at)}</span>
                          <span>·</span>
                          <span>{c.idea_count} ไอเดีย</span>
                          {c.post_count ? (
                            <>
                              <span>·</span>
                              <span>เป้า {c.post_count} ชิ้น</span>
                            </>
                          ) : null}
                          {c.pillar && <PillarBadge pillar={c.pillar} />}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <PlatformChips platforms={c.platforms} max={4} />
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
