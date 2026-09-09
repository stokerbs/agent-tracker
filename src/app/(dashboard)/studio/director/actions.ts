"use server";

/**
 * Creative Director — server actions.
 *
 * Brief → campaign proposal (AI) → refine (more / replace one / tone) →
 * "สร้างแคมเปญ" persists a studio_campaigns row + the selected ideas into the
 * Idea Bank. Every AI call surfaces RunResult.error to the caller; nothing is
 * faked. Writes use the RLS client (admin passes is_admin() policies).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStudioAdmin } from "@/lib/studio/auth";
import { logAudit } from "@/lib/audit";
import { FORMAT_META, PILLARS, PLATFORMS, SOURCE_KIND_META } from "@/lib/studio/constants";
import type { ActionResult, ContentFormat, Pillar, Platform, SourceKind } from "@/lib/studio/types";
import {
  generateCampaign,
  generateIdeas,
  isAiAvailable,
  resolveAiConfig,
  type CampaignProposal,
  type GeneratedIdea,
} from "@/lib/studio/ai";
import { TONE_INSTRUCTIONS, TONE_KEYS } from "./tone";

// ─── Schemas ─────────────────────────────────────────────────────────────────
const PILLAR_ENUM = z.enum(PILLARS as [Pillar, ...Pillar[]]);
const PLATFORM_ENUM = z.enum(PLATFORMS as [Platform, ...Platform[]]);
const FORMAT_ENUM = z.enum(Object.keys(FORMAT_META) as [ContentFormat, ...ContentFormat[]]);
const SOURCE_KIND_ENUM = z.enum(Object.keys(SOURCE_KIND_META) as [SourceKind, ...SourceKind[]]);

const requestSchema = z.string().trim().min(8, "บรีฟสั้นเกินไป — บอกเป้าหมาย แพลตฟอร์ม และจำนวนคอนเทนต์ที่ต้องการ").max(2000, "บรีฟยาวเกิน 2,000 ตัวอักษร");

const TONE_ENUM = z.enum(TONE_KEYS);

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

const interpretationSchema = z.object({
  objective: z.string().max(1000),
  audience: z.string().max(1000),
  platforms: z.array(PLATFORM_ENUM).max(8),
  pillar_focus: z.array(PILLAR_ENUM).max(6),
  tone: z.string().max(300),
  post_count: z.number().int().min(1).max(20),
  cta: z.string().max(500),
});

const proposeSchema = z.object({
  request: requestSchema,
  refine: z
    .object({
      previousIdeas: z.array(z.string().max(200)).max(40),
      tone: TONE_ENUM,
    })
    .nullable()
    .optional(),
});

const moreSchema = z.object({
  request: requestSchema,
  existingTitles: z.array(z.string().max(200)).max(60),
  count: z.number().int().min(1).max(10).default(3),
  platforms: z.array(PLATFORM_ENUM).max(8).optional(),
  pillar: PILLAR_ENUM.nullable().optional(),
});

const replaceSchema = z.object({
  request: requestSchema,
  avoidTitle: z.string().trim().min(1).max(200),
  existingTitles: z.array(z.string().max(200)).max(60),
  pillar: PILLAR_ENUM.nullable().optional(),
  platforms: z.array(PLATFORM_ENUM).max(8).optional(),
});

const createSchema = z.object({
  request: requestSchema,
  title: z.string().trim().min(1).max(200),
  interpretation: interpretationSchema,
  mix_note: z.string().max(2000).default(""),
  knowledge_gaps: z.array(z.string().max(300)).max(20).default([]),
  ideas: z.array(generatedIdeaSchema).min(1, "เลือกอย่างน้อย 1 ไอเดีย").max(20),
  generationId: z.string().uuid().nullable().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const AI_OFF = "AI ยังใช้งานไม่ได้ — ตรวจสอบ ANTHROPIC_API_KEY และ provider ในตั้งค่าสตูดิโอ";

async function aiReady(): Promise<string | null> {
  const { provider } = await resolveAiConfig();
  return isAiAvailable(provider) ? null : AI_OFF;
}

function firstIssue(err: z.ZodError, fallback: string): string {
  return err.issues[0]?.message || fallback;
}

export interface ProposalData {
  proposal: CampaignProposal;
  generationId: string | null;
  model: string;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/** Brief → full campaign proposal. `refine.tone` re-runs with a tone instruction. */
export async function proposeCampaign(input: unknown): Promise<ActionResult<ProposalData>> {
  const profile = await requireStudioAdmin();
  const parsed = proposeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "ข้อมูลไม่ถูกต้อง") };
  const off = await aiReady();
  if (off) return { ok: false, error: off };

  const { request, refine } = parsed.data;
  const res = await generateCampaign({
    request,
    refine: refine ? { previousIdeas: refine.previousIdeas, instruction: TONE_INSTRUCTIONS[refine.tone] } : null,
    userId: profile.id,
  });
  if (!res.ok) return { ok: false, error: res.error };
  console.info(`[studio:director] proposal ok ideas=${res.data.ideas.length} refine=${refine?.tone ?? "-"} by=${profile.id}`);
  return { ok: true, data: { proposal: res.data, generationId: res.generationId, model: res.model } };
}

/** "สร้างเพิ่ม" — append more ideas for the same brief, avoiding titles already on screen. */
export async function generateMoreIdeas(input: unknown): Promise<ActionResult<{ ideas: GeneratedIdea[]; knowledge_gaps: string[]; generationId: string | null }>> {
  const profile = await requireStudioAdmin();
  const parsed = moreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "ข้อมูลไม่ถูกต้อง") };
  const off = await aiReady();
  if (off) return { ok: false, error: off };

  const { request, existingTitles, count, platforms, pillar } = parsed.data;
  const avoid = existingTitles.length ? `\n\nห้ามซ้ำกับไอเดียที่มีอยู่แล้วในแคมเปญนี้ (ทั้งหัวข้อและมุมเล่า):\n${existingTitles.map((t) => `- ${t}`).join("\n")}` : "";
  const res = await generateIdeas({
    brief: `${request}${avoid}`,
    count,
    pillar: pillar ?? null,
    platforms,
    userId: profile.id,
  });
  if (!res.ok) return { ok: false, error: res.error };
  const lower = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  const fresh = res.data.ideas.filter((i) => !lower.has(i.title.trim().toLowerCase()));
  if (!fresh.length) return { ok: false, error: "AI เสนอไอเดียซ้ำกับที่มีอยู่ทั้งหมด — ลองกดอีกครั้งหรือปรับบรีฟให้เฉพาะเจาะจงขึ้น" };
  return { ok: true, data: { ideas: fresh, knowledge_gaps: res.data.knowledge_gaps, generationId: res.generationId } };
}

/** "เปลี่ยนไอเดียนี้" — regenerate exactly one idea in the same pillar, avoiding the current title. */
export async function replaceIdea(input: unknown): Promise<ActionResult<{ idea: GeneratedIdea; generationId: string | null }>> {
  const profile = await requireStudioAdmin();
  const parsed = replaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "ข้อมูลไม่ถูกต้อง") };
  const off = await aiReady();
  if (off) return { ok: false, error: off };

  const { request, avoidTitle, existingTitles, pillar, platforms } = parsed.data;
  const avoidList = Array.from(new Set([avoidTitle, ...existingTitles]));
  const brief = `${request}\n\nต้องการไอเดียใหม่ 1 ชิ้นมาแทนที่ "${avoidTitle}" — เปลี่ยนมุมเล่าให้ต่างจากเดิมชัดเจน และห้ามซ้ำกับ:\n${avoidList.map((t) => `- ${t}`).join("\n")}`;
  const res = await generateIdeas({ brief, count: 1, pillar: pillar ?? null, platforms, userId: profile.id });
  if (!res.ok) return { ok: false, error: res.error };
  const idea = res.data.ideas[0];
  if (!idea) return { ok: false, error: "AI ไม่ได้ส่งไอเดียกลับมา — ลองใหม่อีกครั้ง" };
  return { ok: true, data: { idea, generationId: res.generationId } };
}

/** "สร้างแคมเปญ" — persist the campaign and the selected ideas into the Idea Bank. */
export async function createCampaign(input: unknown): Promise<ActionResult<{ id: string; ideaCount: number }>> {
  const profile = await requireStudioAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "ข้อมูลแคมเปญไม่ถูกต้อง") };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: campaign, error: cErr } = await supabase
    .from("studio_campaigns")
    .insert({
      title: d.title,
      objective: d.interpretation.objective || null,
      audience: d.interpretation.audience || null,
      platforms: d.interpretation.platforms,
      pillar: d.interpretation.pillar_focus[0] ?? d.ideas[0]?.pillar ?? null,
      tone: d.interpretation.tone || null,
      post_count: d.interpretation.post_count,
      cta: d.interpretation.cta || null,
      brief: {
        request: d.request,
        interpretation: d.interpretation,
        mix_note: d.mix_note,
        knowledge_gaps: d.knowledge_gaps,
        generation_id: d.generationId ?? null,
      } as never,
      status: "active",
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (cErr || !campaign) {
    console.error("[studio:director] campaign insert failed:", cErr?.message);
    return { ok: false, error: "บันทึกแคมเปญไม่สำเร็จ — ลองใหม่อีกครั้ง" };
  }

  const rows = d.ideas.map((i) => ({
    title: i.title,
    hook: i.hook || null,
    description: i.description || null,
    pillar: i.pillar,
    platforms: i.platforms.length ? i.platforms : d.interpretation.platforms,
    format: i.format,
    origin: "ai",
    source_refs: i.source_refs as never,
    ai_scores: i.ai_scores as never,
    status: "saved",
    tags: i.tags,
    campaign_id: campaign.id,
    generation_id: d.generationId ?? null,
    created_by: profile.id,
  }));
  const { error: iErr } = await supabase.from("studio_ideas").insert(rows);
  if (iErr) {
    console.error("[studio:director] ideas insert failed:", iErr.message);
    return { ok: false, error: `สร้างแคมเปญแล้ว แต่บันทึกไอเดียไม่สำเร็จ (${iErr.message}) — เปิดแคมเปญใน Idea Bank แล้วเพิ่มไอเดียใหม่ได้` };
  }

  await logAudit({
    actorId: profile.id,
    action: "STUDIO_CAMPAIGN_CREATE",
    entity: "studio_campaigns",
    entityId: campaign.id,
    metadata: { idea_count: rows.length, platforms: d.interpretation.platforms, pillar_focus: d.interpretation.pillar_focus, generation_id: d.generationId ?? null },
  });
  console.info(`[studio:director] campaign ${campaign.id} created with ${rows.length} ideas by ${profile.id}`);

  revalidatePath("/studio/director");
  revalidatePath("/studio/ideas");
  revalidatePath("/studio");
  return { ok: true, data: { id: campaign.id, ideaCount: rows.length } };
}
