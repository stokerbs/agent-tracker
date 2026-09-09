"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStudioAdmin } from "@/lib/studio/auth";
import {
  generateCTA,
  generateCreativePlan,
  generateHooks,
  generateScript,
  repurposeContent,
  rewriteContent,
  type GeneratedScript,
  type GeneratedVariant,
  type RewriteMode,
} from "@/lib/studio/ai";
import { PLATFORMS, VIDEO_PLATFORMS } from "@/lib/studio/constants";
import type { ActionResult, CreativePlan, Pillar, Platform, PrivacyFinding, PrivacyStatus, TargetDuration } from "@/lib/studio/types";
import { revalidateContentPaths, runAndStorePrivacyCheck } from "./privacy-check";

/**
 * AI server actions for the Content Editor. Each one loads the master under
 * RLS, calls the studio AI layer and returns a PREVIEW — nothing is written
 * until the owner confirms (except the creative plan and privacy check, which
 * are additive records). Every RunResult.error is passed through verbatim.
 */

const UNAUTHORIZED = "ไม่มีสิทธิ์ดำเนินการ";
const idSchema = z.string().uuid();
const platformSchema = z.enum(PLATFORMS as [string, ...string[]]);

async function loadMaster(masterId: string) {
  const rls = await createClient();
  const { data, error } = await rls
    .from("studio_content_masters")
    .select("id, title, pillar, primary_platform, target_duration_sec, hook, script, caption, cta, notes, status")
    .eq("id", masterId)
    .maybeSingle();
  if (error) {
    console.error("[studio:ai-actions] master load failed:", error.message);
    return { rls, master: null, error: "โหลดคอนเทนต์ไม่สำเร็จ" };
  }
  if (!data) return { rls, master: null, error: "ไม่พบคอนเทนต์" };
  return { rls, master: data, error: null };
}

export interface AiPreview<T> {
  data: T;
  model: string;
  generationId: string | null;
}

// ─── generate full script ────────────────────────────────────────────────────
const scriptSchema = z.object({
  masterId: idSchema,
  tone: z.string().trim().max(200).nullable().optional(),
  useExisting: z.boolean().optional(),
});

export async function aiGenerateScript(input: unknown): Promise<ActionResult<AiPreview<GeneratedScript>>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = scriptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const { master, error } = await loadMaster(parsed.data.masterId);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };

  const platform = (master.primary_platform ?? "tiktok") as Platform;
  const targetSeconds = (master.target_duration_sec ?? 45) as TargetDuration;
  const res = await generateScript({
    title: master.title,
    hook: master.hook,
    description: master.notes,
    pillar: master.pillar as Pillar,
    platform,
    targetSeconds,
    tone: parsed.data.tone ?? null,
    existingScript: parsed.data.useExisting === false ? null : master.script,
    userId: profile.id,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: { data: res.data, model: res.model, generationId: res.generationId } };
}

// ─── hooks ───────────────────────────────────────────────────────────────────
export async function aiGenerateHooks(input: unknown): Promise<ActionResult<AiPreview<{ hooks: { text: string; angle: string; why: string }[] }>>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const { master, error } = await loadMaster(parsed.data);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };

  const res = await generateHooks({
    title: master.title,
    pillar: master.pillar as Pillar,
    description: master.script?.slice(0, 600) ?? master.notes,
    currentHook: master.hook,
    userId: profile.id,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: { data: res.data, model: res.model, generationId: res.generationId } };
}

// ─── CTA options ─────────────────────────────────────────────────────────────
export async function aiGenerateCTA(input: unknown): Promise<ActionResult<AiPreview<{ options: { text: string; style: string }[] }>>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const { master, error } = await loadMaster(parsed.data);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };

  const res = await generateCTA({
    title: master.title,
    pillar: master.pillar as Pillar,
    platform: (master.primary_platform as Platform | null) ?? null,
    script: master.script,
    userId: profile.id,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: { data: res.data, model: res.model, generationId: res.generationId } };
}

// ─── rewrite ─────────────────────────────────────────────────────────────────
const REWRITE_MODES: RewriteMode[] = ["rewrite_hook", "shorten", "more_viral", "more_professional", "more_natural_thai", "alternative_version", "custom"];
const rewriteSchema = z.object({
  masterId: idSchema,
  mode: z.enum(REWRITE_MODES as [RewriteMode, ...RewriteMode[]]),
  field: z.enum(["hook", "script", "caption", "cta"]),
  /** Current editor text (may be unsaved) — the AI rewrites what the owner sees. */
  text: z.string().max(65000),
  customInstruction: z.string().trim().max(1000).nullable().optional(),
});

export async function aiRewrite(input: unknown): Promise<ActionResult<AiPreview<{ text: string; change_note: string }>>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = rewriteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const d = parsed.data;
  if (!d.text.trim()) return { ok: false, error: "ยังไม่มีข้อความให้เขียนใหม่ — พิมพ์หรือสร้างสคริปต์ก่อน" };
  if (d.mode === "custom" && !d.customInstruction?.trim()) return { ok: false, error: "กรุณาพิมพ์คำสั่งที่ต้องการ" };
  const { master, error } = await loadMaster(d.masterId);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };

  const res = await rewriteContent({
    mode: d.mode,
    field: d.field,
    text: d.text,
    title: master.title,
    pillar: master.pillar as Pillar,
    platform: (master.primary_platform as Platform | null) ?? null,
    customInstruction: d.customInstruction ?? null,
    userId: profile.id,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: { data: res.data, model: res.model, generationId: res.generationId } };
}

// ─── repurpose to platforms (preview; upsertVariants writes) ────────────────
const repurposeSchema = z.object({ masterId: idSchema, platforms: z.array(platformSchema).min(1).max(8) });

export async function aiRepurpose(input: unknown): Promise<ActionResult<AiPreview<{ variants: GeneratedVariant[] }>>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = repurposeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const { master, error } = await loadMaster(parsed.data.masterId);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };
  if (!master.script?.trim() && !master.caption?.trim()) return { ok: false, error: "ต้องมีสคริปต์หรือแคปชันต้นฉบับก่อนสร้างเวอร์ชันแพลตฟอร์ม" };

  const res = await repurposeContent({
    title: master.title,
    pillar: master.pillar,
    master: { hook: master.hook, script: master.script, caption: master.caption, cta: master.cta },
    targetPlatforms: parsed.data.platforms as Platform[],
    userId: profile.id,
  });
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.data.variants.length) return { ok: false, error: "AI ไม่ได้ส่งเวอร์ชันสำหรับแพลตฟอร์มที่เลือกกลับมา — ลองใหม่อีกครั้ง" };
  return { ok: true, data: { data: res.data, model: res.model, generationId: res.generationId } };
}

// ─── creative plan (generates AND saves — additive) ──────────────────────────
export async function aiCreativePlan(input: unknown): Promise<ActionResult<AiPreview<CreativePlan>>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const { rls, master, error } = await loadMaster(parsed.data);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };
  if (!master.script?.trim()) return { ok: false, error: "ต้องมีสคริปต์ก่อนสร้างแผนวิดีโอ" };

  const platform = (master.primary_platform && VIDEO_PLATFORMS.includes(master.primary_platform as Platform) ? master.primary_platform : "tiktok") as Platform;
  const res = await generateCreativePlan({
    title: master.title,
    pillar: master.pillar,
    platform,
    script: master.script,
    targetSeconds: master.target_duration_sec,
    userId: profile.id,
  });
  if (!res.ok) return { ok: false, error: res.error };

  const { error: upErr } = await rls.from("studio_content_masters").update({ creative_plan: res.data as never }).eq("id", master.id);
  if (upErr) {
    console.error("[studio:ai-actions] plan save failed:", upErr.message);
    return { ok: false, error: "สร้างแผนสำเร็จแต่บันทึกไม่ได้ — ลองใหม่อีกครั้ง" };
  }
  revalidateContentPaths(master.id);
  return { ok: true, data: { data: res.data, model: res.model, generationId: res.generationId } };
}

// ─── privacy check (always inserts a row) ────────────────────────────────────
export interface PrivacyCheckActionResult {
  status: PrivacyStatus;
  findings: PrivacyFinding[];
  summary: string;
  suggestions: string[];
  checked_by: "deterministic" | "ai";
  model: string | null;
  ai_error?: string;
}

export async function runContentPrivacyCheck(input: unknown): Promise<ActionResult<PrivacyCheckActionResult>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = z.object({ masterId: idSchema, useAi: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };

  const rls = await createClient();
  const check = await runAndStorePrivacyCheck(rls, parsed.data.masterId, { useAi: parsed.data.useAi, userId: profile.id });
  if (!check.ok) return check;
  revalidateContentPaths(parsed.data.masterId);
  const r = check.check.result;
  return {
    ok: true,
    data: { status: r.status, findings: r.findings, summary: r.summary, suggestions: r.suggestions, checked_by: r.checked_by, model: r.model, ai_error: r.ai_error },
  };
}
