import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  ContentClaim,
  ContentMaster,
  ContentReview,
  ContentSource,
  ContentStatus,
  ContentVariant,
  CreativePlan,
  Pillar,
  Platform,
  PrivacyCheck,
  PrivacyFinding,
  PrivacyStatus,
} from "@/lib/studio/types";

/**
 * Server-side loaders for the Content module. Other studio modules
 * (calendar/dashboard) may import from here — keep exported names stable.
 * All reads go through the RLS client (admin-only policies).
 */

export interface ContentListRow {
  id: string;
  title: string;
  pillar: string;
  status: string;
  primary_platform: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  estimated_duration_sec: number | null;
  target_duration_sec: number | null;
  updated_at: string;
  created_at: string;
  privacy_status: PrivacyStatus | null;
  variant_count: number;
}

export interface ContentListFilters {
  pillar?: Pillar | null;
  platform?: Platform | null;
  status?: ContentStatus | null;
  q?: string | null;
}

export interface ContentSourceWithCase extends ContentSource {
  /** For case insights: parent studio case id so the link opens the case page. */
  case_id: string | null;
}

export interface ContentReviewWithName extends ContentReview {
  reviewer_name: string | null;
}

export interface MasterWithRelations {
  master: ContentMaster;
  variants: ContentVariant[];
  sources: ContentSourceWithCase[];
  claims: ContentClaim[];
  /** Newest first. */
  privacyChecks: PrivacyCheck[];
  /** Newest first. */
  reviews: ContentReviewWithName[];
  approvedByName: string | null;
}

function asCreativePlan(v: unknown): CreativePlan | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Partial<CreativePlan>;
  return {
    shots: Array.isArray(p.shots) ? p.shots : [],
    broll: Array.isArray(p.broll) ? p.broll : [],
    text_overlays: Array.isArray(p.text_overlays) ? p.text_overlays : [],
    subtitle_style: p.subtitle_style ?? null,
    voiceover_notes: p.voiceover_notes ?? null,
    thumbnail_concept: p.thumbnail_concept ?? null,
    music_mood: p.music_mood ?? null,
  };
}

function asFindings(v: unknown): PrivacyFinding[] {
  return Array.isArray(v) ? (v as PrivacyFinding[]) : [];
}

/** Latest privacy status per master id (one query, newest wins). */
export async function getLatestPrivacyStatuses(masterIds: string[]): Promise<Map<string, PrivacyStatus>> {
  const out = new Map<string, PrivacyStatus>();
  if (!masterIds.length) return out;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("studio_privacy_checks")
    .select("master_id, status, created_at")
    .in("master_id", masterIds)
    .order("created_at", { ascending: false })
    .limit(masterIds.length * 5);
  if (error) {
    console.error("[studio:content] privacy status load failed:", error.message);
    return out;
  }
  for (const row of data ?? []) {
    if (!out.has(row.master_id)) out.set(row.master_id, row.status as PrivacyStatus);
  }
  return out;
}

export async function listContentMasters(filters: ContentListFilters = {}): Promise<ContentListRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("studio_content_masters")
    .select(
      "id, title, pillar, status, primary_platform, scheduled_at, published_at, estimated_duration_sec, target_duration_sec, updated_at, created_at, studio_content_variants(id)",
    )
    .neq("status", "idea")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (filters.pillar) q = q.eq("pillar", filters.pillar);
  if (filters.platform) q = q.eq("primary_platform", filters.platform);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.q?.trim()) {
    const term = filters.q.trim().replace(/[%_,()]/g, "");
    if (term) q = q.ilike("title", `%${term}%`);
  }
  const { data, error } = await q;
  if (error) {
    console.error("[studio:content] list failed:", error.message);
    throw new Error("โหลดรายการคอนเทนต์ไม่สำเร็จ");
  }
  const rows = data ?? [];
  const privacy = await getLatestPrivacyStatuses(rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    pillar: r.pillar,
    status: r.status,
    primary_platform: r.primary_platform,
    scheduled_at: r.scheduled_at,
    published_at: r.published_at,
    estimated_duration_sec: r.estimated_duration_sec,
    target_duration_sec: r.target_duration_sec,
    updated_at: r.updated_at,
    created_at: r.created_at,
    privacy_status: privacy.get(r.id) ?? null,
    variant_count: Array.isArray(r.studio_content_variants) ? r.studio_content_variants.length : 0,
  }));
}

/** Counts per status for the board strip (unfiltered). */
export async function countContentByStatus(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("studio_content_masters").select("status").neq("status", "idea").limit(2000);
  if (error) {
    console.error("[studio:content] count failed:", error.message);
    return {};
  }
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.status] = (out[r.status] ?? 0) + 1;
  return out;
}

/**
 * Loads a master with every relation the editor needs. Returns null when the
 * row does not exist or is not accessible under RLS.
 */
export async function getMasterWithRelations(id: string): Promise<MasterWithRelations | null> {
  const supabase = await createClient();
  const { data: masterRow, error: masterErr } = await supabase.from("studio_content_masters").select("*").eq("id", id).maybeSingle();
  if (masterErr) {
    console.error("[studio:content] master load failed:", masterErr.message);
    throw new Error("โหลดคอนเทนต์ไม่สำเร็จ");
  }
  if (!masterRow) return null;

  const [variantsRes, sourcesRes, claimsRes, checksRes, reviewsRes] = await Promise.all([
    supabase.from("studio_content_variants").select("*").eq("master_id", id).order("created_at", { ascending: true }),
    supabase.from("studio_content_sources").select("*").eq("master_id", id).order("created_at", { ascending: true }),
    supabase.from("studio_content_claims").select("*").eq("master_id", id).order("created_at", { ascending: true }),
    supabase.from("studio_privacy_checks").select("*").eq("master_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("studio_content_reviews").select("*").eq("master_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  for (const r of [variantsRes, sourcesRes, claimsRes, checksRes, reviewsRes]) {
    if (r.error) console.error("[studio:content] relation load failed:", r.error.message);
  }

  const sources = sourcesRes.data ?? [];
  const insightIds = sources.filter((s) => s.source_kind === "case_insight" && s.source_id).map((s) => s.source_id as string);
  const insightCase = new Map<string, string>();
  if (insightIds.length) {
    const { data: insights } = await supabase.from("studio_case_insights").select("id, case_id").in("id", insightIds);
    for (const i of insights ?? []) insightCase.set(i.id, i.case_id);
  }

  const reviews = reviewsRes.data ?? [];
  const profileIds = Array.from(
    new Set([...reviews.map((r) => r.reviewer_id), masterRow.approved_by].filter((x): x is string => !!x)),
  );
  const names = new Map<string, string | null>();
  if (profileIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
    for (const p of profiles ?? []) names.set(p.id, p.full_name);
  }

  return {
    master: { ...masterRow, creative_plan: asCreativePlan(masterRow.creative_plan) },
    variants: (variantsRes.data ?? []).map((v) => ({ ...v, creative_plan: asCreativePlan(v.creative_plan) })),
    sources: sources.map((s) => ({ ...s, case_id: s.source_id ? insightCase.get(s.source_id) ?? null : null })),
    claims: claimsRes.data ?? [],
    privacyChecks: (checksRes.data ?? []).map((c) => ({ ...c, findings: asFindings(c.findings) })),
    reviews: reviews.map((r) => ({ ...r, reviewer_name: r.reviewer_id ? names.get(r.reviewer_id) ?? null : null })),
    approvedByName: masterRow.approved_by ? names.get(masterRow.approved_by) ?? null : null,
  };
}
