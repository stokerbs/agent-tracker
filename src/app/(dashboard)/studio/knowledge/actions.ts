"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStudioAdmin } from "@/lib/studio/auth";
import { logAudit } from "@/lib/audit";
import { handleDbError } from "@/lib/errors";
import { extractCustomerFAQs, isAiAvailable } from "@/lib/studio/ai";
import { mineLineInbox, type MineResult } from "@/lib/studio/faq-mining";
import { KNOWLEDGE_CATEGORIES } from "@/lib/studio/constants";
import type { ActionResult, SourceRef } from "@/lib/studio/types";

/**
 * Knowledge Base server actions (studio_knowledge_sources + studio_customer_questions).
 *
 * Every action: zod → requireStudioAdmin() → RLS client (admin has full access
 * via is_admin() policies) → logAudit for approval toggles / deletes → revalidatePath.
 * The service client is never imported here (see docs/CREATIVE_STUDIO.md §9).
 */

const KNOWLEDGE_PATH = "/studio/knowledge";

const SOURCE_TYPES = [
  "case",
  "customer_question",
  "investigator_knowledge",
  "owner_experience",
  "service",
  "article",
  "technology",
  "osint",
  "surveillance",
  "gps",
  "document",
  "external",
  "other",
] as const;
const SENSITIVITIES = ["public", "internal", "confidential", "restricted"] as const;
const QUESTION_SOURCES = ["line_oa", "phone", "web", "manual", "import"] as const;

const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .default([])
  .transform((tags) => Array.from(new Set(tags)));

const knowledgeSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุชื่อเรื่อง").max(200, "ชื่อเรื่องยาวเกิน 200 ตัวอักษร"),
  content: z.string().trim().min(1, "กรุณาระบุเนื้อหา").max(50_000, "เนื้อหายาวเกินไป"),
  summary: z.string().trim().max(1000).optional().nullable().transform((v) => (v ? v : null)),
  source_type: z.enum(SOURCE_TYPES),
  category: z.enum(KNOWLEDGE_CATEGORIES as [string, ...string[]]),
  tags: tagsSchema,
  sensitivity: z.enum(SENSITIVITIES),
  approved_for_content: z.boolean().default(false),
  origin_ref: z.string().trim().max(500).optional().nullable().transform((v) => (v ? v : null)),
});
export type KnowledgeInput = z.input<typeof knowledgeSchema>;

const idSchema = z.string().uuid();

const questionSchema = z.object({
  question: z.string().trim().min(1, "กรุณาระบุคำถาม").max(1000, "คำถามยาวเกินไป"),
  answer_hint: z.string().trim().max(2000).optional().nullable().transform((v) => (v ? v : null)),
  frequency: z.coerce.number().int().min(1).max(100_000).default(1),
  source: z.enum(QUESTION_SOURCES).default("manual"),
  tags: tagsSchema,
  approved_for_content: z.boolean().default(false),
});
export type QuestionInput = z.input<typeof questionSchema>;

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
}

// ─── Knowledge sources ───────────────────────────────────────────────────────

export async function createKnowledge(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requireStudioAdmin();
  const parsed = knowledgeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("studio_knowledge_sources")
    .insert({ ...parsed.data, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: handleDbError(error ?? { message: "insert returned no row" }, "studio:createKnowledge") };

  if (parsed.data.approved_for_content) {
    await logAudit({ actorId: profile.id, action: "STUDIO_KNOWLEDGE_APPROVE", entity: "studio_knowledge_sources", entityId: data.id, metadata: { approved: true, via: "create" } });
  }
  console.info(`[studio:knowledge] created ${data.id} by ${profile.id}`);
  revalidatePath(KNOWLEDGE_PATH);
  return { ok: true, data: { id: data.id } };
}

export async function updateKnowledge(id: string, input: unknown): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "รหัสไม่ถูกต้อง" };
  const parsed = knowledgeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: existing, error: readErr } = await supabase
    .from("studio_knowledge_sources")
    .select("id, approved_for_content")
    .eq("id", idParsed.data)
    .maybeSingle();
  if (readErr) return { ok: false, error: handleDbError(readErr, "studio:updateKnowledge:read") };
  if (!existing) return { ok: false, error: "ไม่พบความรู้รายการนี้" };

  const { error } = await supabase.from("studio_knowledge_sources").update(parsed.data).eq("id", idParsed.data);
  if (error) return { ok: false, error: handleDbError(error, "studio:updateKnowledge") };

  if (existing.approved_for_content !== parsed.data.approved_for_content) {
    await logAudit({ actorId: profile.id, action: "STUDIO_KNOWLEDGE_APPROVE", entity: "studio_knowledge_sources", entityId: idParsed.data, metadata: { approved: parsed.data.approved_for_content, via: "edit" } });
  }
  console.info(`[studio:knowledge] updated ${idParsed.data} by ${profile.id}`);
  revalidatePath(KNOWLEDGE_PATH);
  revalidatePath(`${KNOWLEDGE_PATH}/${idParsed.data}`);
  return { ok: true };
}

export async function deleteKnowledge(id: string): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "รหัสไม่ถูกต้อง" };

  const supabase = await createClient();
  const { error } = await supabase.from("studio_knowledge_sources").delete().eq("id", idParsed.data);
  if (error) return { ok: false, error: handleDbError(error, "studio:deleteKnowledge") };

  await logAudit({ actorId: profile.id, action: "STUDIO_KNOWLEDGE_DELETE", entity: "studio_knowledge_sources", entityId: idParsed.data });
  console.info(`[studio:knowledge] deleted ${idParsed.data} by ${profile.id}`);
  revalidatePath(KNOWLEDGE_PATH);
  return { ok: true };
}

export async function setKnowledgeApproved(id: string, approved: boolean): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const parsed = z.object({ id: idSchema, approved: z.boolean() }).safeParse({ id, approved });
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("studio_knowledge_sources")
    .update({ approved_for_content: parsed.data.approved })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: handleDbError(error, "studio:setKnowledgeApproved") };

  await logAudit({ actorId: profile.id, action: "STUDIO_KNOWLEDGE_APPROVE", entity: "studio_knowledge_sources", entityId: parsed.data.id, metadata: { approved: parsed.data.approved } });
  revalidatePath(KNOWLEDGE_PATH);
  revalidatePath(`${KNOWLEDGE_PATH}/${parsed.data.id}`);
  return { ok: true };
}

// ─── Customer questions ──────────────────────────────────────────────────────

export async function createQuestion(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requireStudioAdmin();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("studio_customer_questions")
    .insert({ ...parsed.data, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: handleDbError(error ?? { message: "insert returned no row" }, "studio:createQuestion") };

  console.info(`[studio:questions] created ${data.id} by ${profile.id}`);
  revalidatePath(KNOWLEDGE_PATH);
  return { ok: true, data: { id: data.id } };
}

export async function updateQuestion(id: string, input: unknown): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "รหัสไม่ถูกต้อง" };
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("studio_customer_questions").update(parsed.data).eq("id", idParsed.data);
  if (error) return { ok: false, error: handleDbError(error, "studio:updateQuestion") };

  console.info(`[studio:questions] updated ${idParsed.data} by ${profile.id}`);
  revalidatePath(KNOWLEDGE_PATH);
  return { ok: true };
}

export async function deleteQuestion(id: string): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "รหัสไม่ถูกต้อง" };

  const supabase = await createClient();
  const { error } = await supabase.from("studio_customer_questions").delete().eq("id", idParsed.data);
  if (error) return { ok: false, error: handleDbError(error, "studio:deleteQuestion") };

  await logAudit({ actorId: profile.id, action: "STUDIO_QUESTION_DELETE", entity: "studio_customer_questions", entityId: idParsed.data });
  revalidatePath(KNOWLEDGE_PATH);
  return { ok: true };
}

export async function setQuestionApproved(id: string, approved: boolean): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const parsed = z.object({ id: idSchema, approved: z.boolean() }).safeParse({ id, approved });
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("studio_customer_questions")
    .update({ approved_for_content: parsed.data.approved })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: handleDbError(error, "studio:setQuestionApproved") };

  await logAudit({ actorId: profile.id, action: "STUDIO_QUESTION_APPROVE", entity: "studio_customer_questions", entityId: parsed.data.id, metadata: { approved: parsed.data.approved } });
  revalidatePath(KNOWLEDGE_PATH);
  return { ok: true };
}

// ─── AI import (paste) ───────────────────────────────────────────────────────

export interface ExtractedQuestion {
  question: string;
  answer_hint: string;
  frequency: number;
  tags: string[];
  content_idea: string;
}

const extractSchema = z.object({
  text: z.string().trim().min(20, "วางข้อความอย่างน้อย 20 ตัวอักษร").max(20_000, "ข้อความยาวเกิน 20,000 ตัวอักษร"),
  source: z.enum(QUESTION_SOURCES).default("line_oa"),
});

/**
 * Pasted LINE OA / phone-note excerpts → candidate FAQs (preview only — nothing
 * is saved until the owner ticks rows in saveExtractedQuestions). The pasted
 * text is never persisted; the AI layer logs only its length.
 */
export async function extractQuestionsFromText(input: unknown): Promise<ActionResult<{ questions: ExtractedQuestion[] }>> {
  const profile = await requireStudioAdmin();
  const parsed = extractSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!isAiAvailable()) return { ok: false, error: "AI ยังใช้งานไม่ได้ — ตรวจสอบ ANTHROPIC_API_KEY ในตั้งค่าสตูดิโอ" };

  const result = await extractCustomerFAQs({ pastedText: parsed.data.text, source: parsed.data.source, userId: profile.id });
  if (!result.ok) return { ok: false, error: result.error };

  const questions: ExtractedQuestion[] = result.data.questions.map((q) => ({
    question: q.question.trim().slice(0, 1000),
    answer_hint: q.answer_hint.trim().slice(0, 2000),
    frequency: Math.max(1, Math.min(100_000, Math.round(Number(q.frequency) || 1))),
    tags: q.tags.map((t) => t.trim()).filter(Boolean).slice(0, 20),
    content_idea: q.content_idea.trim(),
  }));
  console.info(`[studio:questions] AI extracted ${questions.length} candidates (source=${parsed.data.source}) by ${profile.id}`);
  return { ok: true, data: { questions } };
}

const saveExtractedSchema = z.object({
  source: z.enum(QUESTION_SOURCES).default("line_oa"),
  questions: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(1000),
        answer_hint: z.string().trim().max(2000).optional().nullable(),
        frequency: z.coerce.number().int().min(1).max(100_000).default(1),
        tags: tagsSchema,
      }),
    )
    .min(1, "เลือกอย่างน้อย 1 คำถาม")
    .max(100),
});

/** Persists the ticked candidates. Always approved_for_content=false — the owner approves later. */
export async function saveExtractedQuestions(input: unknown): Promise<ActionResult<{ inserted: number }>> {
  const profile = await requireStudioAdmin();
  const parsed = saveExtractedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const rows = parsed.data.questions.map((q) => ({
    question: q.question,
    answer_hint: q.answer_hint ? q.answer_hint : null,
    frequency: q.frequency,
    tags: q.tags,
    source: parsed.data.source,
    approved_for_content: false,
    created_by: profile.id,
  }));
  const { data, error } = await supabase.from("studio_customer_questions").insert(rows).select("id");
  if (error) return { ok: false, error: handleDbError(error, "studio:saveExtractedQuestions") };

  const inserted = data?.length ?? rows.length;
  await logAudit({ actorId: profile.id, action: "STUDIO_QUESTION_IMPORT", entity: "studio_customer_questions", metadata: { inserted, source: parsed.data.source } });
  console.info(`[studio:questions] imported ${inserted} by ${profile.id}`);
  revalidatePath(KNOWLEDGE_PATH);
  return { ok: true, data: { inserted } };
}

// ─── Question → Idea ─────────────────────────────────────────────────────────

/** Seeds an Idea Bank row from a customer question (origin 'question', pillar detective_knowledge). */
export async function createIdeaFromQuestion(questionId: string): Promise<ActionResult<{ ideaId: string }>> {
  const profile = await requireStudioAdmin();
  const idParsed = idSchema.safeParse(questionId);
  if (!idParsed.success) return { ok: false, error: "รหัสไม่ถูกต้อง" };

  const supabase = await createClient();
  const { data: q, error: readErr } = await supabase
    .from("studio_customer_questions")
    .select("id, question, answer_hint, tags")
    .eq("id", idParsed.data)
    .maybeSingle();
  if (readErr) return { ok: false, error: handleDbError(readErr, "studio:createIdeaFromQuestion:read") };
  if (!q) return { ok: false, error: "ไม่พบคำถามนี้" };

  const sourceRefs: SourceRef[] = [{ kind: "customer_question", id: q.id, label: q.question.slice(0, 120) }];
  const { data, error } = await supabase
    .from("studio_ideas")
    .insert({
      title: q.question.slice(0, 200),
      hook: null,
      description: q.answer_hint ? `แนวคำตอบ: ${q.answer_hint}` : null,
      pillar: "detective_knowledge",
      platforms: [],
      origin: "question",
      source_refs: sourceRefs as unknown as never,
      status: "new",
      tags: q.tags ?? [],
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: handleDbError(error ?? { message: "insert returned no row" }, "studio:createIdeaFromQuestion") };

  console.info(`[studio:questions] idea ${data.id} created from question ${q.id} by ${profile.id}`);
  revalidatePath("/studio/ideas");
  revalidatePath(KNOWLEDGE_PATH);
  return { ok: true, data: { ideaId: data.id } };
}

/**
 * Owner-triggered FAQ mining of the redacted LINE OA inbox (same job as the
 * weekly cron). Admin-gated; the AI call runs server-side and every mined
 * question lands unapproved for review.
 */
export async function mineLineInboxNow(): Promise<ActionResult<MineResult>> {
  const profile = await requireStudioAdmin();
  if (!isAiAvailable()) return { ok: false, error: "AI ยังใช้งานไม่ได้ — ตั้งค่า ANTHROPIC_API_KEY ก่อน" };
  const result = await mineLineInbox({ userId: profile.id, minMessages: 1 });
  if (!result.ok) return { ok: false, error: result.error ?? "ขุดคำถามไม่สำเร็จ" };
  await logAudit({
    actorId: profile.id,
    action: "STUDIO_FAQ_MINE",
    entity: "studio_customer_questions",
    metadata: { messages: result.messages, inserted: result.inserted, merged: result.merged, purged: result.purged, generation_id: result.generationId },
  });
  console.info(`[studio:questions] manual mine by ${profile.id}: ${result.messages} msgs → +${result.inserted} / merged ${result.merged}`);
  revalidatePath(KNOWLEDGE_PATH);
  return { ok: true, data: result };
}
