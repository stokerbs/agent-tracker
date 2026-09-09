"use server";

/**
 * Idea Bank — server actions.
 *
 * CRUD on studio_ideas (status, edit, duplicate, owner-authored), AI idea
 * suggestions, and the bridge into the editor: generateContentFromIdea()
 * creates the studio_content_masters draft (+ sources / claims / privacy
 * check) and returns its id so the client can router.push to the editor.
 *
 * RLS client only — the admin role passes is_admin() policies. Every AI error
 * is returned to the caller; a failed script generation still leaves a usable
 * draft row (returned with `aiError`).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStudioAdmin } from "@/lib/studio/auth";
import { logAudit } from "@/lib/audit";
import { FORMAT_META, PILLARS, PLATFORMS, SOURCE_KIND_META } from "@/lib/studio/constants";
import type { ActionResult, ContentFormat, Pillar, Platform, SourceKind, SourceRef, TargetDuration } from "@/lib/studio/types";
import { TARGET_DURATIONS } from "@/lib/studio/types";
import { generateIdeas, generateScript, isAiAvailable, resolveAiConfig, runPrivacyCheck, type GeneratedIdea } from "@/lib/studio/ai";

// ─── Schemas ─────────────────────────────────────────────────────────────────
const PILLAR_ENUM = z.enum(PILLARS as [Pillar, ...Pillar[]]);
const PLATFORM_ENUM = z.enum(PLATFORMS as [Platform, ...Platform[]]);
const FORMAT_ENUM = z.enum(Object.keys(FORMAT_META) as [ContentFormat, ...ContentFormat[]]);
const SOURCE_KIND_ENUM = z.enum(Object.keys(SOURCE_KIND_META) as [SourceKind, ...SourceKind[]]);
const UUID = z.string().uuid("รหัสไม่ถูกต้อง");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(12)
  .default([])
  .transform((t) => Array.from(new Set(t)));

const ideaFieldsSchema = z.object({
  title: z.string().trim().min(3, "ชื่อไอเดียสั้นเกินไป").max(200, "ชื่อไอเดียยาวเกิน 200 ตัวอักษร"),
  hook: z.string().trim().max(1000).default(""),
  description: z.string().trim().max(4000).default(""),
  pillar: PILLAR_ENUM,
  platforms: z.array(PLATFORM_ENUM).max(8).default([]),
  format: FORMAT_ENUM.nullable().default(null),
  tags: tagsSchema,
});

const statusSchema = z.object({
  id: UUID,
  status: z.enum(["new", "saved", "rejected", "archived"]),
});

const idSchema = z.object({ id: UUID });

const updateSchema = ideaFieldsSchema.extend({ id: UUID });

const suggestSchema = z.object({
  brief: z.string().trim().min(8, "บรีฟสั้นเกินไป — บอกหัวข้อหรือมุมที่อยากได้").max(2000),
  pillar: PILLAR_ENUM.nullable().default(null),
  count: z.number().int().min(1).max(10).default(5),
});

const generatedIdeaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  hook: z.string().max(1000).default(""),
  description: z.string().max(4000).default(""),
  pillar: PILLAR_ENUM,
  platforms: z.array(PLATFORM_ENUM).max(8).default([]),
  format: FORMAT_ENUM,
  source_refs: z
    .array(z.object({ kind: SOURCE_KIND_ENUM, id: z.string().uuid().nullable(), label: z.string().min(1).max(300) }))
    .max(30)
    .default([]),
  ai_scores: z.object({
    hook: z.number().min(0).max(5),
    educational: z.number().min(0).max(5),
    conversion: z.number().min(0).max(5),
    originality: z.number().min(0).max(5),
    rationale: z.string().max(1500).optional(),
  }),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});

const saveSuggestedSchema = z.object({
  ideas: z.array(generatedIdeaSchema).min(1, "เลือกอย่างน้อย 1 ไอเดีย").max(10),
  generationId: z.string().uuid().nullable().optional(),
});

const generateContentSchema = z.object({
  ideaId: UUID,
  platform: PLATFORM_ENUM.optional(),
  targetSeconds: z
    .number()
    .int()
    .refine((n): n is TargetDuration => (TARGET_DURATIONS as number[]).includes(n), "ความยาวต้องเป็น 15/30/45/60/90 วินาที")
    .optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const AI_OFF = "AI ยังใช้งานไม่ได้ — ตรวจสอบ ANTHROPIC_API_KEY และ provider ในตั้งค่าสตูดิโอ";

async function aiReady(): Promise<boolean> {
  const { provider } = await resolveAiConfig();
  return isAiAvailable(provider);
}

function firstIssue(err: z.ZodError, fallback: string): string {
  return err.issues[0]?.message || fallback;
}

function revalidateIdeas() {
  revalidatePath("/studio/ideas");
  revalidatePath("/studio");
}

function asSourceRefs(raw: unknown): SourceRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .filter((r) => typeof r.kind === "string" && typeof r.label === "string")
    .map((r) => ({
      kind: r.kind as SourceKind,
      id: typeof r.id === "string" && UUID_RE.test(r.id) ? r.id : null,
      label: String(r.label),
    }));
}

function dedupeRefs(refs: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  const out: SourceRef[] = [];
  for (const r of refs) {
    const key = `${r.kind}:${r.id ?? r.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

// ─── Status / CRUD ───────────────────────────────────────────────────────────

/** บันทึก / ปัดตก / เก็บถาวร / กลับเป็นใหม่ */
export async function setIdeaStatus(input: unknown): Promise<ActionResult<{ id: string; status: string }>> {
  const profile = await requireStudioAdmin();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "ข้อมูลไม่ถูกต้อง") };
  const { id, status } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.from("studio_ideas").update({ status }).eq("id", id).select("id").maybeSingle();
  if (error) {
    console.error("[studio:ideas] status update failed:", error.message);
    return { ok: false, error: "อัปเดตสถานะไม่สำเร็จ" };
  }
  if (!data) return { ok: false, error: "ไม่พบไอเดียนี้" };
  console.info(`[studio:ideas] ${id} → ${status} by ${profile.id}`);
  revalidateIdeas();
  return { ok: true, data: { id, status } };
}

/** ทำสำเนา — new row, status 'new', same origin, title + " (สำเนา)". */
export async function duplicateIdea(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requireStudioAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "ข้อมูลไม่ถูกต้อง") };

  const supabase = await createClient();
  const { data: src, error: readErr } = await supabase.from("studio_ideas").select("*").eq("id", parsed.data.id).maybeSingle();
  if (readErr) return { ok: false, error: "อ่านไอเดียไม่สำเร็จ" };
  if (!src) return { ok: false, error: "ไม่พบไอเดียนี้" };

  const { data, error } = await supabase
    .from("studio_ideas")
    .insert({
      title: `${src.title} (สำเนา)`.slice(0, 200),
      hook: src.hook,
      description: src.description,
      pillar: src.pillar,
      platforms: src.platforms,
      format: src.format,
      origin: src.origin,
      source_refs: src.source_refs as never,
      ai_scores: src.ai_scores as never,
      status: "new",
      tags: src.tags,
      campaign_id: src.campaign_id,
      generation_id: src.generation_id,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[studio:ideas] duplicate failed:", error?.message);
    return { ok: false, error: "ทำสำเนาไม่สำเร็จ" };
  }
  revalidateIdeas();
  return { ok: true, data: { id: data.id } };
}

/** แก้ไข — title/hook/description/pillar/platforms/format/tags. */
export async function updateIdea(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requireStudioAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "ข้อมูลไม่ถูกต้อง") };
  const { id, title, hook, description, pillar, platforms, format, tags } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("studio_ideas")
    .update({ title, hook: hook || null, description: description || null, pillar, platforms, format, tags })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[studio:ideas] update failed:", error.message);
    return { ok: false, error: "บันทึกการแก้ไขไม่สำเร็จ" };
  }
  if (!data) return { ok: false, error: "ไม่พบไอเดียนี้" };
  console.info(`[studio:ideas] ${id} edited by ${profile.id}`);
  revalidateIdeas();
  return { ok: true, data: { id } };
}

/** เพิ่มไอเดียเอง — origin 'owner', status 'saved'. */
export async function createOwnerIdea(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requireStudioAdmin();
  const parsed = ideaFieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "ข้อมูลไม่ถูกต้อง") };
  const { title, hook, description, pillar, platforms, format, tags } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("studio_ideas")
    .insert({
      title,
      hook: hook || null,
      description: description || null,
      pillar,
      platforms,
      format,
      origin: "owner",
      status: "saved",
      source_refs: [] as never,
      ai_scores: null,
      tags,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[studio:ideas] owner insert failed:", error?.message);
    return { ok: false, error: "เพิ่มไอเดียไม่สำเร็จ" };
  }
  console.info(`[studio:ideas] owner idea ${data.id} by ${profile.id}`);
  revalidateIdeas();
  return { ok: true, data: { id: data.id } };
}

// ─── AI suggestions ──────────────────────────────────────────────────────────

/** ให้ AI แนะนำไอเดีย — preview only; nothing is persisted until saveSuggestedIdeas. */
export async function suggestIdeas(input: unknown): Promise<ActionResult<{ ideas: GeneratedIdea[]; knowledge_gaps: string[]; generationId: string | null; model: string }>> {
  const profile = await requireStudioAdmin();
  const parsed = suggestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "ข้อมูลไม่ถูกต้อง") };
  if (!(await aiReady())) return { ok: false, error: AI_OFF };

  const { brief, pillar, count } = parsed.data;
  const res = await generateIdeas({ brief, count, pillar, userId: profile.id });
  if (!res.ok) return { ok: false, error: res.error };
  console.info(`[studio:ideas] suggested ${res.data.ideas.length} ideas by ${profile.id}`);
  return { ok: true, data: { ideas: res.data.ideas, knowledge_gaps: res.data.knowledge_gaps, generationId: res.generationId, model: res.model } };
}

/** Persist selected AI suggestions as origin 'ai', status 'new'. */
export async function saveSuggestedIdeas(input: unknown): Promise<ActionResult<{ ids: string[] }>> {
  const profile = await requireStudioAdmin();
  const parsed = saveSuggestedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "ข้อมูลไม่ถูกต้อง") };
  const { ideas, generationId } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("studio_ideas")
    .insert(
      ideas.map((i) => ({
        title: i.title,
        hook: i.hook || null,
        description: i.description || null,
        pillar: i.pillar,
        platforms: i.platforms,
        format: i.format,
        origin: "ai",
        source_refs: i.source_refs as never,
        ai_scores: i.ai_scores as never,
        status: "new",
        tags: i.tags,
        generation_id: generationId ?? null,
        created_by: profile.id,
      })),
    )
    .select("id");
  if (error) {
    console.error("[studio:ideas] save suggestions failed:", error.message);
    return { ok: false, error: "บันทึกไอเดียไม่สำเร็จ" };
  }
  revalidateIdeas();
  return { ok: true, data: { ids: (data ?? []).map((r) => r.id) } };
}

// ─── Bridge → Content editor ─────────────────────────────────────────────────

export interface GenerateContentResult {
  id: string;
  /** Set when the draft row exists but AI script generation failed. */
  aiError?: string;
}

/**
 * สร้างคอนเทนต์จากไอเดีย — creates the content master draft and (when AI is
 * available) writes the first script, sources, fact claims and a deterministic
 * privacy check. On AI failure the draft is kept and `aiError` is returned so
 * the owner lands in the editor with a warning instead of losing the row.
 */
export async function generateContentFromIdea(input: unknown): Promise<ActionResult<GenerateContentResult>> {
  const profile = await requireStudioAdmin();
  const parsed = generateContentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "ข้อมูลไม่ถูกต้อง") };
  const { ideaId } = parsed.data;

  const supabase = await createClient();
  const { data: idea, error: ideaErr } = await supabase.from("studio_ideas").select("*").eq("id", ideaId).maybeSingle();
  if (ideaErr) return { ok: false, error: "อ่านไอเดียไม่สำเร็จ" };
  if (!idea) return { ok: false, error: "ไม่พบไอเดียนี้" };

  const ideaPlatforms = (idea.platforms as string[]).filter((p): p is Platform => (PLATFORMS as string[]).includes(p));
  const platform: Platform = parsed.data.platform ?? ideaPlatforms[0] ?? "tiktok";
  const targetSeconds: TargetDuration = parsed.data.targetSeconds ?? 45;
  const pillar = (PILLARS as string[]).includes(idea.pillar) ? (idea.pillar as Pillar) : "detective_knowledge";
  const ideaRefs = asSourceRefs(idea.source_refs);

  // 1. Draft master
  const { data: master, error: mErr } = await supabase
    .from("studio_content_masters")
    .insert({
      idea_id: idea.id,
      campaign_id: idea.campaign_id,
      title: idea.title,
      pillar,
      status: "draft",
      hook: idea.hook,
      primary_platform: platform,
      target_duration_sec: targetSeconds,
      tags: idea.tags ?? [],
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (mErr || !master) {
    console.error("[studio:ideas] master insert failed:", mErr?.message);
    return { ok: false, error: "สร้างร่างคอนเทนต์ไม่สำเร็จ" };
  }
  const masterId = master.id;

  // 2. Sources inherited from the idea
  if (ideaRefs.length) {
    const { error } = await supabase
      .from("studio_content_sources")
      .insert(ideaRefs.map((r) => ({ master_id: masterId, source_kind: r.kind, source_id: r.id, label: r.label, note: "จากไอเดีย" })));
    if (error) console.error("[studio:ideas] idea sources insert failed:", error.message);
  }

  // 3. AI script (optional — draft survives failure)
  let aiError: string | undefined;
  if (await aiReady()) {
    const script = await generateScript({
      title: idea.title,
      hook: idea.hook,
      description: idea.description,
      pillar,
      platform,
      targetSeconds,
      searchHint: (idea.tags ?? []).join(" "),
      userId: profile.id,
    });

    if (!script.ok) {
      aiError = script.error;
    } else {
      const s = script.data;
      const { error: uErr } = await supabase
        .from("studio_content_masters")
        .update({
          hook: s.hook || idea.hook,
          script: s.script,
          caption: s.caption,
          cta: s.cta,
          estimated_duration_sec: s.estimated_duration_sec,
          ai_notes: s.ai_notes,
        })
        .eq("id", masterId);
      if (uErr) {
        console.error("[studio:ideas] master script update failed:", uErr.message);
        aiError = "AI เขียนสคริปต์แล้ว แต่บันทึกลงร่างไม่สำเร็จ — ลองสร้างสคริปต์ใหม่ในตัวแก้ไข";
      } else {
        // Replace sources with idea ∪ script refs (deduped)
        const merged = dedupeRefs([...ideaRefs, ...s.source_refs]);
        await supabase.from("studio_content_sources").delete().eq("master_id", masterId);
        if (merged.length) {
          const { error } = await supabase
            .from("studio_content_sources")
            .insert(merged.map((r) => ({ master_id: masterId, source_kind: r.kind, source_id: r.id, label: r.label })));
          if (error) console.error("[studio:ideas] sources insert failed:", error.message);
        }

        if (s.claims.length) {
          const { error } = await supabase.from("studio_content_claims").insert(
            s.claims.map((c) => ({
              master_id: masterId,
              claim: c.claim,
              support_status: c.support_status,
              source_kind: c.source?.kind ?? null,
              source_id: c.source?.id && UUID_RE.test(c.source.id) ? c.source.id : null,
            })),
          );
          if (error) console.error("[studio:ideas] claims insert failed:", error.message);
        }

        const check = await runPrivacyCheck({
          fields: { hook: s.hook, script: s.script, caption: s.caption, cta: s.cta },
          useAi: false,
          userId: profile.id,
          masterId,
        });
        const { error: pErr } = await supabase.from("studio_privacy_checks").insert({
          master_id: masterId,
          status: check.status,
          findings: check.findings as never,
          checked_by: "deterministic",
          model: null,
          created_by: profile.id,
        });
        if (pErr) console.error("[studio:ideas] privacy check insert failed:", pErr.message);
      }
    }
  } else {
    aiError = AI_OFF;
  }

  // 5. Mark idea as generated, audit, revalidate
  const { error: sErr } = await supabase.from("studio_ideas").update({ status: "generated" }).eq("id", ideaId);
  if (sErr) console.error("[studio:ideas] idea status → generated failed:", sErr.message);

  await logAudit({
    actorId: profile.id,
    action: "STUDIO_CONTENT_CREATE",
    entity: "studio_content_masters",
    entityId: masterId,
    metadata: { idea_id: ideaId, platform, target_duration_sec: targetSeconds, ai_ok: !aiError },
  });
  console.info(`[studio:ideas] content ${masterId} from idea ${ideaId} (${platform}/${targetSeconds}s) ai=${aiError ? "failed" : "ok"} by ${profile.id}`);

  revalidatePath("/studio/ideas");
  revalidatePath("/studio/content");
  revalidatePath("/studio");
  return { ok: true, data: aiError ? { id: masterId, aiError } : { id: masterId } };
}
