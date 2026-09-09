"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStudioAdmin } from "@/lib/studio/auth";
import { estimateSpokenSeconds } from "@/lib/studio/duration";
import { PILLARS, PLATFORMS } from "@/lib/studio/constants";
import { TARGET_DURATIONS, type ActionResult, type CreativePlan, type Platform, type SourceKind, type SupportStatus } from "@/lib/studio/types";
import { revalidateContentPaths, runAndStorePrivacyCheck, reopenIfApproved } from "./[id]/privacy-check";

/**
 * Non-AI mutations for the Content module: create, autosave, variants,
 * sources, claims, creative plan. Workflow transitions live in
 * [id]/workflow-actions.ts, AI calls in [id]/ai-actions.ts.
 */

const UNAUTHORIZED = "ไม่มีสิทธิ์ดำเนินการ";
const idSchema = z.string().uuid();
const pillarSchema = z.enum(PILLARS as [string, ...string[]]);
const platformSchema = z.enum(PLATFORMS as [string, ...string[]]);
const durationSchema = z.number().int().refine((n) => (TARGET_DURATIONS as number[]).includes(n), "ความยาวเป้าหมายไม่ถูกต้อง");
const text = (max: number) => z.string().max(max).nullable().optional();

// ─── create ──────────────────────────────────────────────────────────────────
const createSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุชื่อคอนเทนต์").max(200),
  pillar: pillarSchema,
  primaryPlatform: platformSchema,
  targetDurationSec: durationSchema.nullable().optional(),
  ideaId: idSchema.nullable().optional(),
  campaignId: idSchema.nullable().optional(),
  hook: text(1000),
});

export async function createContentMaster(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const d = parsed.data;

  const rls = await createClient();
  const { data, error } = await rls
    .from("studio_content_masters")
    .insert({
      title: d.title,
      pillar: d.pillar,
      primary_platform: d.primaryPlatform,
      target_duration_sec: d.targetDurationSec ?? null,
      idea_id: d.ideaId ?? null,
      campaign_id: d.campaignId ?? null,
      hook: d.hook ?? null,
      status: "draft",
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[studio:content] create failed:", error?.message);
    return { ok: false, error: "สร้างคอนเทนต์ไม่สำเร็จ" };
  }
  console.info(`[studio:content] create master=${data.id} by=${profile.id}`);
  revalidateContentPaths(data.id);
  return { ok: true, data: { id: data.id } };
}

// ─── autosave master fields ─────────────────────────────────────────────────
const saveSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1, "ชื่อคอนเทนต์ห้ามว่าง").max(200).optional(),
  pillar: pillarSchema.optional(),
  primaryPlatform: platformSchema.nullable().optional(),
  targetDurationSec: durationSchema.nullable().optional(),
  hook: text(2000),
  script: text(20000),
  caption: text(65000),
  cta: text(1000),
  notes: text(10000),
  aiNotes: text(10000),
});

export async function saveMasterFields(input: unknown): Promise<ActionResult<{ savedAt: string; estimatedDurationSec: number | null; reopened?: boolean }>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const d = parsed.data;

  const patch: Record<string, unknown> = {};
  if (d.title !== undefined) patch.title = d.title;
  if (d.pillar !== undefined) patch.pillar = d.pillar;
  if (d.primaryPlatform !== undefined) patch.primary_platform = d.primaryPlatform;
  if (d.targetDurationSec !== undefined) patch.target_duration_sec = d.targetDurationSec;
  if (d.hook !== undefined) patch.hook = d.hook;
  if (d.caption !== undefined) patch.caption = d.caption;
  if (d.cta !== undefined) patch.cta = d.cta;
  if (d.notes !== undefined) patch.notes = d.notes;
  if (d.aiNotes !== undefined) patch.ai_notes = d.aiNotes;
  let estimated: number | null = null;
  if (d.script !== undefined) {
    patch.script = d.script;
    estimated = d.script ? estimateSpokenSeconds(d.script) : null;
    patch.estimated_duration_sec = estimated;
  }
  if (!Object.keys(patch).length) return { ok: true, data: { savedAt: new Date().toISOString(), estimatedDurationSec: null } };

  const rls = await createClient();
  const { error } = await rls.from("studio_content_masters").update(patch as never).eq("id", d.id);
  if (error) {
    console.error("[studio:content] save failed:", error.message);
    return { ok: false, error: "บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง" };
  }
  // Published copy changed after approval → approval no longer describes it.
  const textChanged = ["hook", "script", "caption", "cta"].some((k) => k in patch);
  const reopened = textChanged ? await reopenIfApproved(rls, d.id, profile.id, "master_text_edit") : false;
  revalidateContentPaths(d.id);
  return { ok: true, data: { savedAt: new Date().toISOString(), estimatedDurationSec: estimated, reopened } };
}

// ─── creative plan ──────────────────────────────────────────────────────────
const shotSchema = z.object({
  start_sec: z.number().min(0).max(3600),
  end_sec: z.number().min(0).max(3600),
  voice: z.string().max(2000),
  visual: z.string().max(2000),
  text_overlay: z.string().max(500).nullable().optional(),
});
const planSchema = z.object({
  shots: z.array(shotSchema).max(60),
  broll: z.array(z.string().max(300)).max(40),
  text_overlays: z.array(z.string().max(300)).max(40),
  subtitle_style: z.string().max(500).nullable().optional(),
  voiceover_notes: z.string().max(2000).nullable().optional(),
  thumbnail_concept: z.string().max(1000).nullable().optional(),
  music_mood: z.string().max(300).nullable().optional(),
});

export async function saveCreativePlan(input: unknown): Promise<ActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = z.object({ masterId: idSchema, plan: planSchema.nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "แผนวิดีโอไม่ถูกต้อง: " + (parsed.error.issues[0]?.message ?? "") };
  const plan: CreativePlan | null = parsed.data.plan
    ? {
        shots: parsed.data.plan.shots.map((s) => ({ ...s, text_overlay: s.text_overlay ?? null })),
        broll: parsed.data.plan.broll,
        text_overlays: parsed.data.plan.text_overlays,
        subtitle_style: parsed.data.plan.subtitle_style ?? null,
        voiceover_notes: parsed.data.plan.voiceover_notes ?? null,
        thumbnail_concept: parsed.data.plan.thumbnail_concept ?? null,
        music_mood: parsed.data.plan.music_mood ?? null,
      }
    : null;

  const rls = await createClient();
  const { error } = await rls
    .from("studio_content_masters")
    .update({ creative_plan: plan as never })
    .eq("id", parsed.data.masterId);
  if (error) {
    console.error("[studio:content] plan save failed:", error.message);
    return { ok: false, error: "บันทึกแผนวิดีโอไม่สำเร็จ" };
  }
  revalidateContentPaths(parsed.data.masterId);
  return { ok: true };
}

// ─── variants ────────────────────────────────────────────────────────────────
const variantFieldsSchema = z.object({
  hook: text(2000),
  script: text(20000),
  caption: text(65000),
  cta: text(1000),
});

export async function saveVariant(input: unknown): Promise<ActionResult<{ savedAt: string }>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = variantFieldsSchema.extend({ id: idSchema, masterId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const d = parsed.data;

  const rls = await createClient();
  const { error } = await rls
    .from("studio_content_variants")
    .update({
      hook: d.hook ?? null,
      script: d.script ?? null,
      caption: d.caption ?? null,
      cta: d.cta ?? null,
      char_count: (d.caption ?? "").length,
    })
    .eq("id", d.id)
    .eq("master_id", d.masterId);
  if (error) {
    console.error("[studio:content] variant save failed:", error.message);
    return { ok: false, error: "บันทึกเวอร์ชันไม่สำเร็จ" };
  }
  await reopenIfApproved(rls, d.masterId, profile.id, "variant_text_edit");
  revalidateContentPaths(d.masterId);
  return { ok: true, data: { savedAt: new Date().toISOString() } };
}

export async function deleteVariant(input: unknown): Promise<ActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = z.object({ id: idSchema, masterId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };

  const rls = await createClient();
  const { error } = await rls.from("studio_content_variants").delete().eq("id", parsed.data.id).eq("master_id", parsed.data.masterId);
  if (error) {
    console.error("[studio:content] variant delete failed:", error.message);
    return { ok: false, error: "ลบเวอร์ชันไม่สำเร็จ" };
  }
  revalidateContentPaths(parsed.data.masterId);
  return { ok: true };
}

const FORMATS = ["short_video", "carousel", "post", "article", "story", "caption_short", "caption_long", "outline"] as const;
const upsertVariantsSchema = z.object({
  masterId: idSchema,
  generationId: z.string().uuid().nullable().optional(),
  variants: z
    .array(
      variantFieldsSchema.extend({
        platform: platformSchema,
        format: z.enum(FORMATS),
      }),
    )
    .min(1)
    .max(8),
});

/**
 * Writes AI-generated (or hand-built) platform variants. One row per platform:
 * an existing variant for the same platform is REPLACED (the UI confirms first).
 */
export async function upsertVariants(input: unknown): Promise<ActionResult<{ count: number }>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = upsertVariantsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลเวอร์ชันไม่ถูกต้อง" };
  const { masterId, variants, generationId } = parsed.data;

  const rls = await createClient();
  const platforms = variants.map((v) => v.platform);
  const { error: delErr } = await rls.from("studio_content_variants").delete().eq("master_id", masterId).in("platform", platforms);
  if (delErr) {
    console.error("[studio:content] variant replace (delete) failed:", delErr.message);
    return { ok: false, error: "แทนที่เวอร์ชันเดิมไม่สำเร็จ" };
  }
  const { error: insErr } = await rls.from("studio_content_variants").insert(
    variants.map((v) => ({
      master_id: masterId,
      platform: v.platform,
      format: v.format,
      hook: v.hook ?? null,
      script: v.script ?? null,
      caption: v.caption ?? null,
      cta: v.cta ?? null,
      char_count: (v.caption ?? "").length,
      generation_id: generationId ?? null,
    })),
  );
  if (insErr) {
    console.error("[studio:content] variant insert failed:", insErr.message);
    return { ok: false, error: "บันทึกเวอร์ชันไม่สำเร็จ" };
  }
  console.info(`[studio:content] variants upsert master=${masterId} platforms=${platforms.join(",")}`);
  await reopenIfApproved(rls, masterId, profile.id, "variants_regenerated");
  revalidateContentPaths(masterId);
  return { ok: true, data: { count: variants.length } };
}

// ─── sources ─────────────────────────────────────────────────────────────────
const SOURCE_KINDS: SourceKind[] = ["knowledge", "case_insight", "customer_question", "external", "ai_general"];
const addSourceSchema = z.object({
  masterId: idSchema,
  kind: z.enum(SOURCE_KINDS as [SourceKind, ...SourceKind[]]),
  sourceId: idSchema.nullable().optional(),
  label: z.string().trim().min(1, "กรุณาระบุชื่อแหล่งข้อมูล").max(300),
  note: z.string().trim().max(1000).nullable().optional(),
});

export async function addContentSource(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = addSourceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const d = parsed.data;
  if (d.kind !== "external" && d.kind !== "ai_general" && !d.sourceId) return { ok: false, error: "ต้องเลือกรายการจากคลังความรู้" };

  const rls = await createClient();
  if (d.sourceId) {
    const { data: dup } = await rls
      .from("studio_content_sources")
      .select("id")
      .eq("master_id", d.masterId)
      .eq("source_kind", d.kind)
      .eq("source_id", d.sourceId)
      .maybeSingle();
    if (dup) return { ok: false, error: "แหล่งข้อมูลนี้ถูกเพิ่มไว้แล้ว" };
  }
  const { data, error } = await rls
    .from("studio_content_sources")
    .insert({ master_id: d.masterId, source_kind: d.kind, source_id: d.sourceId ?? null, label: d.label, note: d.note ?? null })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[studio:content] source add failed:", error?.message);
    return { ok: false, error: "เพิ่มแหล่งข้อมูลไม่สำเร็จ" };
  }
  revalidateContentPaths(d.masterId);
  return { ok: true, data: { id: data.id } };
}

export async function removeContentSource(input: unknown): Promise<ActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = z.object({ id: idSchema, masterId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };

  const rls = await createClient();
  const { error } = await rls.from("studio_content_sources").delete().eq("id", parsed.data.id).eq("master_id", parsed.data.masterId);
  if (error) {
    console.error("[studio:content] source remove failed:", error.message);
    return { ok: false, error: "ลบแหล่งข้อมูลไม่สำเร็จ" };
  }
  revalidateContentPaths(parsed.data.masterId);
  return { ok: true };
}

export interface SourceCandidate {
  kind: SourceKind;
  id: string;
  label: string;
  case_id: string | null;
  approved: boolean;
}

/** Search knowledge / case insights / customer questions by title for the "add source" picker. */
export async function searchSourceCandidates(input: unknown): Promise<ActionResult<{ items: SourceCandidate[] }>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = z.object({ q: z.string().trim().min(1).max(100) }).safeParse(input);
  if (!parsed.success) return { ok: true, data: { items: [] } };
  const term = parsed.data.q.replace(/[%_,()]/g, "");
  if (!term) return { ok: true, data: { items: [] } };

  const rls = await createClient();
  const pattern = `%${term}%`;
  const [k, i, q] = await Promise.all([
    rls.from("studio_knowledge_sources").select("id, title, approved_for_content").ilike("title", pattern).order("updated_at", { ascending: false }).limit(8),
    rls.from("studio_case_insights").select("id, title, case_id, approved_for_content").ilike("title", pattern).order("updated_at", { ascending: false }).limit(8),
    rls.from("studio_customer_questions").select("id, question, approved_for_content").ilike("question", pattern).order("frequency", { ascending: false }).limit(8),
  ]);
  for (const r of [k, i, q]) if (r.error) console.error("[studio:content] source search failed:", r.error.message);

  const items: SourceCandidate[] = [
    ...(k.data ?? []).map((r) => ({ kind: "knowledge" as const, id: r.id, label: r.title, case_id: null, approved: r.approved_for_content })),
    ...(i.data ?? []).map((r) => ({ kind: "case_insight" as const, id: r.id, label: r.title, case_id: r.case_id, approved: r.approved_for_content })),
    ...(q.data ?? []).map((r) => ({ kind: "customer_question" as const, id: r.id, label: r.question, case_id: null, approved: r.approved_for_content })),
  ];
  return { ok: true, data: { items } };
}

// ─── claims ──────────────────────────────────────────────────────────────────
const SUPPORT: SupportStatus[] = ["supported", "partially_supported", "ai_suggestion", "needs_review", "unsupported"];
const claimSchema = z.object({
  id: idSchema,
  masterId: idSchema,
  supportStatus: z.enum(SUPPORT as [SupportStatus, ...SupportStatus[]]),
  note: z.string().trim().max(1000).nullable().optional(),
});

export async function updateClaim(input: unknown): Promise<ActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const d = parsed.data;

  const rls = await createClient();
  const { error } = await rls
    .from("studio_content_claims")
    .update({ support_status: d.supportStatus, note: d.note ?? null, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
    .eq("id", d.id)
    .eq("master_id", d.masterId);
  if (error) {
    console.error("[studio:content] claim update failed:", error.message);
    return { ok: false, error: "อัปเดต claim ไม่สำเร็จ" };
  }
  revalidateContentPaths(d.masterId);
  return { ok: true };
}

export async function deleteClaim(input: unknown): Promise<ActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = z.object({ id: idSchema, masterId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };

  const rls = await createClient();
  const { error } = await rls.from("studio_content_claims").delete().eq("id", parsed.data.id).eq("master_id", parsed.data.masterId);
  if (error) {
    console.error("[studio:content] claim delete failed:", error.message);
    return { ok: false, error: "ลบ claim ไม่สำเร็จ" };
  }
  revalidateContentPaths(parsed.data.masterId);
  return { ok: true };
}

// ─── apply an AI-generated script (after the owner confirms) ────────────────
const sourceRefSchema = z.object({
  kind: z.enum(SOURCE_KINDS as [SourceKind, ...SourceKind[]]),
  id: z.string().uuid().nullable(),
  label: z.string().max(300),
});
const applyScriptSchema = z.object({
  masterId: idSchema,
  hook: z.string().max(2000),
  script: z.string().max(20000),
  caption: z.string().max(65000),
  cta: z.string().max(1000),
  aiNotes: z.string().max(10000).nullable().optional(),
  sourceRefs: z.array(sourceRefSchema).max(30),
  claims: z
    .array(
      z.object({
        claim: z.string().max(1000),
        support_status: z.enum(SUPPORT as [SupportStatus, ...SupportStatus[]]),
        source: sourceRefSchema.nullable(),
      }),
    )
    .max(40),
});

/**
 * Replaces the master's copy with an AI-generated script, rewrites the claim
 * list, merges new source refs (no duplicates) and runs the deterministic
 * privacy check so the badge is honest immediately.
 */
export async function applyGeneratedScript(input: unknown): Promise<ActionResult<{ privacyStatus: string; estimatedDurationSec: number }>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = applyScriptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลสคริปต์ไม่ถูกต้อง" };
  const d = parsed.data;

  const rls = await createClient();
  const estimated = estimateSpokenSeconds(d.script);
  const { error: upErr } = await rls
    .from("studio_content_masters")
    .update({ hook: d.hook, script: d.script, caption: d.caption, cta: d.cta, ai_notes: d.aiNotes ?? null, estimated_duration_sec: estimated })
    .eq("id", d.masterId);
  if (upErr) {
    console.error("[studio:content] apply script failed:", upErr.message);
    return { ok: false, error: "บันทึกสคริปต์ไม่สำเร็จ" };
  }

  // Claims: replace wholesale (they describe the new script).
  const { error: delClaims } = await rls.from("studio_content_claims").delete().eq("master_id", d.masterId);
  if (delClaims) console.error("[studio:content] claims clear failed:", delClaims.message);
  if (d.claims.length) {
    const { error: insClaims } = await rls.from("studio_content_claims").insert(
      d.claims.map((c) => ({
        master_id: d.masterId,
        claim: c.claim,
        support_status: c.support_status,
        source_kind: c.source?.kind ?? null,
        source_id: c.source?.id ?? null,
      })),
    );
    if (insClaims) console.error("[studio:content] claims insert failed:", insClaims.message);
  }

  // Sources: merge (keep the owner's manual rows).
  const { data: existing } = await rls.from("studio_content_sources").select("source_kind, source_id").eq("master_id", d.masterId);
  const have = new Set((existing ?? []).map((s) => `${s.source_kind}:${s.source_id ?? ""}`));
  const fresh = d.sourceRefs.filter((r) => !have.has(`${r.kind}:${r.id ?? ""}`));
  if (fresh.length) {
    const { error: insSrc } = await rls
      .from("studio_content_sources")
      .insert(fresh.map((r) => ({ master_id: d.masterId, source_kind: r.kind, source_id: r.id, label: r.label })));
    if (insSrc) console.error("[studio:content] sources insert failed:", insSrc.message);
  }

  // Demote first: regenerated text must never stay approved, even if the scan below fails.
  await reopenIfApproved(rls, d.masterId, profile.id, "script_regenerated");
  const check = await runAndStorePrivacyCheck(rls, d.masterId, { useAi: false, userId: profile.id });
  console.info(`[studio:content] apply generated script master=${d.masterId} claims=${d.claims.length} sources=+${fresh.length}`);
  revalidateContentPaths(d.masterId);
  return { ok: true, data: { privacyStatus: check.ok ? check.check.status : "unknown", estimatedDurationSec: estimated } };
}

/** Type re-export for the client (platform union used by the variants dialog). */
export type { Platform };
