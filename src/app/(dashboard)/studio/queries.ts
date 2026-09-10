import "server-only";

import { computeMixFlags, isAiAvailable } from "@/lib/studio/ai";
import { PILLARS, PILLAR_META } from "@/lib/studio/constants";
import { DEFAULT_AUTOPILOT, getStudioSettings } from "@/lib/studio/settings";
import type { AiScores, AutopilotSettings, Pillar, PillarConfig } from "@/lib/studio/types";
import { createClient } from "@/lib/supabase/server";

export interface PipelineCounts {
  ideas: number;
  draft: number;
  review: number;
  approved: number;
  scheduled: number;
  published30d: number;
}

export interface DashboardIdea {
  id: string;
  title: string;
  hook: string | null;
  pillar: string;
  ai_scores: AiScores | null;
  created_at: string;
}

export interface UpcomingItem {
  id: string;
  title: string;
  pillar: string;
  status: string;
  primary_platform: string | null;
  scheduled_at: string;
}

export interface MixSnapshot {
  counts: Record<Pillar, number>;
  total: number;
  targets: PillarConfig[];
  flags: string[];
  windowDays: number;
}

export interface UnusedKnowledge {
  count: number;
  totalApproved: number;
  examples: { id: string; title: string }[];
}

export interface StudioDashboardData {
  counts: PipelineCounts;
  aiIdeas: DashboardIdea[];
  upcoming: UpcomingItem[];
  mix: MixSnapshot;
  unusedKnowledge: UnusedKnowledge;
  aiAvailable: boolean;
  /** Config only — the dashboard shows a one-line reminder when it is on. */
  autopilot: AutopilotSettings;
}

const MIX_WINDOW_DAYS = 14;
const PUBLISHED_WINDOW_DAYS = 30;

/** Run a query, log + fall back on failure — one broken tile must not take the page down. */
async function safe<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[studio:dashboard] ${label} failed:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

function must<T>(label: string, res: { data: T | null; error: { message: string } | null }): T | null {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data;
}

export async function getStudioDashboardData(): Promise<StudioDashboardData> {
  const sb = await createClient();
  const now = new Date();
  const nowISO = now.toISOString();
  const since14 = new Date(now.getTime() - MIX_WINDOW_DAYS * 86_400_000).toISOString();
  const since30 = new Date(now.getTime() - PUBLISHED_WINDOW_DAYS * 86_400_000).toISOString();

  const count = (label: string, build: () => PromiseLike<{ count: number | null; error: { message: string } | null }>) =>
    safe(label, 0, async () => {
      const res = await build();
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    });

  const masters = () => sb.from("studio_content_masters").select("id", { count: "exact", head: true });

  const [settings, ideas, draft, review, approved, scheduled, published30d, aiIdeas, upcoming, mixRows, knowledge] = await Promise.all([
    safe("settings", null, () => getStudioSettings()),
    count("ideas", () => sb.from("studio_ideas").select("id", { count: "exact", head: true }).in("status", ["new", "saved"])),
    count("draft", () => masters().eq("status", "draft")),
    count("review", () => masters().eq("status", "review")),
    count("approved", () => masters().eq("status", "approved")),
    count("scheduled", () => masters().eq("status", "scheduled")),
    count("published30d", () => masters().eq("status", "published").gte("published_at", since30)),
    safe("aiIdeas", [] as DashboardIdea[], async () => {
      const rows = must(
        "aiIdeas",
        await sb
          .from("studio_ideas")
          .select("id, title, hook, pillar, ai_scores, created_at")
          .eq("origin", "ai")
          .eq("status", "new")
          .order("created_at", { ascending: false })
          .limit(4),
      );
      return (rows ?? []).map((r) => ({ ...r, ai_scores: (r.ai_scores as AiScores | null) ?? null }));
    }),
    safe("upcoming", [] as UpcomingItem[], async () => {
      const rows = must(
        "upcoming",
        await sb
          .from("studio_content_masters")
          .select("id, title, pillar, status, primary_platform, scheduled_at")
          .in("status", ["scheduled", "approved"])
          .gte("scheduled_at", nowISO)
          .order("scheduled_at", { ascending: true })
          .limit(6),
      );
      return (rows ?? []).filter((r): r is UpcomingItem => typeof r.scheduled_at === "string");
    }),
    safe("mix", [] as { pillar: string }[], async () => {
      const rows = must(
        "mix",
        await sb
          .from("studio_content_masters")
          .select("pillar")
          .in("status", ["approved", "scheduled", "published"])
          .or(`published_at.gte.${since14},scheduled_at.gte.${since14}`)
          .limit(500),
      );
      return rows ?? [];
    }),
    safe("knowledge", { approved: [] as { id: string; title: string }[], used: new Set<string>() }, async () => {
      const [approvedRes, usedRes] = await Promise.all([
        sb.from("studio_knowledge_sources").select("id, title").eq("approved_for_content", true).is("superseded_by", null).order("updated_at", { ascending: false }).limit(500),
        sb.from("studio_content_sources").select("source_id").eq("source_kind", "knowledge").not("source_id", "is", null).limit(2000),
      ]);
      const approvedRows = must("knowledge.approved", approvedRes) ?? [];
      const usedRows = must("knowledge.used", usedRes) ?? [];
      return { approved: approvedRows, used: new Set(usedRows.map((u) => u.source_id).filter((x): x is string => !!x)) };
    }),
  ]);

  const mixCounts = Object.fromEntries(PILLARS.map((p) => [p, 0])) as Record<Pillar, number>;
  for (const row of mixRows) {
    if (row.pillar in mixCounts) mixCounts[row.pillar as Pillar] += 1;
  }
  const targets = settings?.pillars ?? [];
  const labels = Object.fromEntries(PILLARS.map((p) => [p, PILLAR_META[p].label])) as Record<Pillar, string>;

  const unused = knowledge.approved.filter((k) => !knowledge.used.has(k.id));

  return {
    counts: { ideas, draft, review, approved, scheduled, published30d },
    aiIdeas,
    upcoming,
    mix: {
      counts: mixCounts,
      total: mixRows.length,
      targets,
      flags: computeMixFlags(mixCounts, targets, labels),
      windowDays: MIX_WINDOW_DAYS,
    },
    unusedKnowledge: { count: unused.length, totalApproved: knowledge.approved.length, examples: unused.slice(0, 3) },
    aiAvailable: isAiAvailable((settings?.ai_provider as "anthropic" | "openai" | undefined) ?? "anthropic"),
    autopilot: settings?.autopilot ?? DEFAULT_AUTOPILOT,
  };
}
