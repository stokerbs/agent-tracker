"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import type { Json } from "@/lib/database.types";
import { recommendContentMix, type ContentMixRecommendation } from "@/lib/studio/ai";
import { getStudioAdmin } from "@/lib/studio/auth";
import { PILLARS } from "@/lib/studio/constants";
import type { ActionResult, SourceRef } from "@/lib/studio/types";
import { createClient } from "@/lib/supabase/server";

const UNAUTHORIZED = "ไม่มีสิทธิ์ใช้งาน Creative Studio";

/**
 * Content-mix recommendation — explicitly user-triggered (button), never on
 * page load: every call costs tokens and is logged to studio_ai_generations.
 */
export async function requestMixRecommendation(days = 14): Promise<ActionResult<{ recommendation: ContentMixRecommendation; model: string }>> {
  const admin = await getStudioAdmin();
  if (!admin) return { ok: false, error: UNAUTHORIZED };
  const window = z.number().int().min(7).max(60).safeParse(days);
  if (!window.success) return { ok: false, error: "ช่วงวันต้องอยู่ระหว่าง 7–60 วัน" };

  const res = await recommendContentMix({ days: window.data, userId: admin.id });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: { recommendation: res.data, model: res.model } };
}

const sourceRefSchema = z.object({
  kind: z.enum(["knowledge", "case_insight", "customer_question", "external", "ai_general"]),
  id: z.uuid().nullable(),
  label: z.string().trim().min(1).max(200),
});

// Not exported: "use server" modules may only export async functions.
const mixSuggestionSchema = z.object({
  pillar: z.enum(PILLARS as [string, ...string[]]),
  title: z.string().trim().min(1, "ต้องมีชื่อไอเดีย").max(200, "ชื่อยาวเกิน 200 ตัวอักษร"),
  hook: z.string().trim().max(500).optional().default(""),
  reason: z.string().trim().max(1000).optional().default(""),
  source_refs: z.array(sourceRefSchema).max(20).default([]),
});
export type MixSuggestionInput = z.input<typeof mixSuggestionSchema>;

/** "บันทึกเป็นไอเดีย" on a mix suggestion → studio_ideas (origin ai, status new). */
export async function saveMixSuggestionAsIdea(input: MixSuggestionInput): Promise<ActionResult<{ id: string }>> {
  const admin = await getStudioAdmin();
  if (!admin) return { ok: false, error: UNAUTHORIZED };
  const parsed = mixSuggestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไอเดียไม่ถูกต้อง" };
  const s = parsed.data;

  const sb = await createClient();
  const { data, error } = await sb
    .from("studio_ideas")
    .insert({
      title: s.title,
      hook: s.hook || null,
      description: s.reason || null,
      pillar: s.pillar,
      origin: "ai",
      status: "new",
      source_refs: s.source_refs as SourceRef[] as unknown as Json,
      tags: ["content_mix"],
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[studio:dashboard] save mix idea failed:", error?.message);
    return { ok: false, error: "บันทึกไอเดียไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  revalidatePath("/studio");
  revalidatePath("/studio/ideas");
  return { ok: true, data: { id: data.id } };
}
