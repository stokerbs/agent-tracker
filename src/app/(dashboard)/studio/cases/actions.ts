"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStudioAdmin } from "@/lib/studio/auth";
import { logAudit } from "@/lib/audit";
import { handleDbError } from "@/lib/errors";
import { extractCaseInsights, isAiAvailable } from "@/lib/studio/ai";
import { scrubText } from "@/lib/studio/privacy/scrub";
import { PILLARS, STUDIO_SETTINGS_ID } from "@/lib/studio/constants";
import type { ActionResult, Pillar, PrivacyFinding, PrivacyRules, SourceRef, StudioCase } from "@/lib/studio/types";
import { CASE_TEXT_FIELDS, CASE_TYPES, type CaseTextField } from "./case-types";

/**
 * Case Insights server actions — studio_cases + studio_case_insights.
 *
 * studio_cases is a hand-written, generalised knowledge record. It is NOT the
 * operations `cases` table and nothing here reads it; `linked_case_id` is an
 * opaque pointer. Every action: zod → requireStudioAdmin() → RLS client →
 * deterministic privacy scan where text is saved → logAudit → revalidatePath.
 */

const CASES_PATH = "/studio/cases";
const idSchema = z.string().uuid();
const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .default([])
  .transform((tags) => Array.from(new Set(tags)));

const caseSchema = z.object({
  case_code: z
    .string()
    .trim()
    .min(1, "กรุณาระบุรหัสเคส")
    .max(40, "รหัสเคสยาวเกิน 40 ตัวอักษร")
    .regex(/^[A-Za-z0-9._-]+$/, "รหัสเคสใช้ได้เฉพาะ A-Z 0-9 . _ -")
    .transform((v) => v.toUpperCase()),
  case_type: z.enum(CASE_TYPES as [string, ...string[]]),
  title: z.string().trim().min(1, "กรุณาระบุชื่อเคส").max(200, "ชื่อเคสยาวเกิน 200 ตัวอักษร"),
  situation: optText(10_000),
  objective: optText(5_000),
  method: optText(10_000),
  observations: optText(10_000),
  outcome: optText(5_000),
  lessons: optText(5_000),
  interesting_insight: optText(5_000),
  content_potential: z.enum(["low", "medium", "high"]).default("medium"),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]).default("confidential"),
  anonymized_version: optText(10_000),
  approved_for_content: z.boolean().default(false),
  tags: tagsSchema,
  linked_case_id: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.string().uuid().safeParse(v).success, "linked_case_id ต้องเป็น UUID"),
});
export type CaseInput = z.input<typeof caseSchema>;

const insightSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุชื่อบทเรียน").max(200),
  insight: z.string().trim().min(1, "กรุณาระบุบทเรียน").max(5_000),
  lesson: optText(5_000),
  content_angle: optText(2_000),
  pillar: z.enum(PILLARS as [Pillar, ...Pillar[]]).nullable().default(null),
  privacy_status: z.enum(["safe", "review_required", "blocked"]).default("review_required"),
});
export type InsightInput = z.input<typeof insightSchema>;

export interface CaseSaveData {
  id: string;
  findings: PrivacyFinding[];
  /** True when approved_for_content was requested but refused because of high-severity findings. */
  approvalDowngraded: boolean;
}

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
}

async function loadPrivacyRules(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Partial<PrivacyRules> | null> {
  const { data, error } = await supabase.from("studio_settings").select("privacy_rules").eq("id", STUDIO_SETTINGS_ID).maybeSingle();
  if (error) {
    console.error("[studio:cases] privacy_rules load failed:", error.message);
    return null;
  }
  return (data?.privacy_rules as Partial<PrivacyRules> | null) ?? null;
}

function scanCase(fields: Partial<Record<CaseTextField, string | null | undefined>>, rules: Partial<PrivacyRules> | null): PrivacyFinding[] {
  const subset: Record<string, string | null | undefined> = {};
  for (const f of CASE_TEXT_FIELDS) subset[f] = fields[f];
  return scrubText({ fields: subset, rules });
}

const hasHigh = (findings: PrivacyFinding[]) => findings.some((f) => f.severity === "high");

// ─── Cases ───────────────────────────────────────────────────────────────────

export async function createCase(input: unknown): Promise<ActionResult<CaseSaveData>> {
  const profile = await requireStudioAdmin();
  const parsed = caseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: dupe, error: dupeErr } = await supabase.from("studio_cases").select("id").eq("case_code", parsed.data.case_code).maybeSingle();
  if (dupeErr) return { ok: false, error: handleDbError(dupeErr, "studio:createCase:dupe") };
  if (dupe) return { ok: false, error: `รหัสเคส ${parsed.data.case_code} มีอยู่แล้ว` };

  const rules = await loadPrivacyRules(supabase);
  const findings = scanCase(parsed.data, rules);
  const approvalDowngraded = parsed.data.approved_for_content && hasHigh(findings);
  const approved = parsed.data.approved_for_content && !approvalDowngraded;

  const { data, error } = await supabase
    .from("studio_cases")
    .insert({ ...parsed.data, approved_for_content: approved, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: handleDbError(error ?? { message: "insert returned no row" }, "studio:createCase") };

  if (approved) {
    await logAudit({ actorId: profile.id, action: "STUDIO_CASE_APPROVE", entity: "studio_cases", entityId: data.id, metadata: { approved: true, via: "create" } });
  }
  console.info(`[studio:cases] created ${data.id} (${parsed.data.case_code}) findings=${findings.length} by ${profile.id}`);
  revalidatePath(CASES_PATH);
  return { ok: true, data: { id: data.id, findings, approvalDowngraded } };
}

export async function updateCase(id: string, input: unknown): Promise<ActionResult<CaseSaveData>> {
  const profile = await requireStudioAdmin();
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "รหัสไม่ถูกต้อง" };
  const parsed = caseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: existing, error: readErr } = await supabase.from("studio_cases").select("id, approved_for_content").eq("id", idParsed.data).maybeSingle();
  if (readErr) return { ok: false, error: handleDbError(readErr, "studio:updateCase:read") };
  if (!existing) return { ok: false, error: "ไม่พบเคสนี้" };

  const { data: dupe, error: dupeErr } = await supabase.from("studio_cases").select("id").eq("case_code", parsed.data.case_code).neq("id", idParsed.data).maybeSingle();
  if (dupeErr) return { ok: false, error: handleDbError(dupeErr, "studio:updateCase:dupe") };
  if (dupe) return { ok: false, error: `รหัสเคส ${parsed.data.case_code} ถูกใช้โดยเคสอื่นแล้ว` };

  const rules = await loadPrivacyRules(supabase);
  const findings = scanCase(parsed.data, rules);
  const approvalDowngraded = parsed.data.approved_for_content && hasHigh(findings);
  const approved = parsed.data.approved_for_content && !approvalDowngraded;

  const { error } = await supabase.from("studio_cases").update({ ...parsed.data, approved_for_content: approved }).eq("id", idParsed.data);
  if (error) return { ok: false, error: handleDbError(error, "studio:updateCase") };

  if (existing.approved_for_content !== approved) {
    await logAudit({ actorId: profile.id, action: "STUDIO_CASE_APPROVE", entity: "studio_cases", entityId: idParsed.data, metadata: { approved, via: "edit" } });
  }
  console.info(`[studio:cases] updated ${idParsed.data} findings=${findings.length} by ${profile.id}`);
  revalidatePath(CASES_PATH);
  revalidatePath(`${CASES_PATH}/${idParsed.data}`);
  return { ok: true, data: { id: idParsed.data, findings, approvalDowngraded } };
}

export async function deleteCase(id: string): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "รหัสไม่ถูกต้อง" };

  const supabase = await createClient();
  const { error } = await supabase.from("studio_cases").delete().eq("id", idParsed.data);
  if (error) return { ok: false, error: handleDbError(error, "studio:deleteCase") };

  await logAudit({ actorId: profile.id, action: "STUDIO_CASE_DELETE", entity: "studio_cases", entityId: idParsed.data });
  console.info(`[studio:cases] deleted ${idParsed.data} by ${profile.id}`);
  revalidatePath(CASES_PATH);
  return { ok: true };
}

/** Approve toggle. Refuses to approve while the deterministic scan finds high-severity identifiers. */
export async function setCaseApproved(id: string, approved: boolean): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const parsed = z.object({ id: idSchema, approved: z.boolean() }).safeParse({ id, approved });
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };

  const supabase = await createClient();
  if (parsed.data.approved) {
    const { data: row, error: readErr } = await supabase.from("studio_cases").select("*").eq("id", parsed.data.id).maybeSingle();
    if (readErr) return { ok: false, error: handleDbError(readErr, "studio:setCaseApproved:read") };
    if (!row) return { ok: false, error: "ไม่พบเคสนี้" };
    const rules = await loadPrivacyRules(supabase);
    const findings = scanCase(row as StudioCase, rules);
    if (hasHigh(findings)) {
      return { ok: false, error: `ยังพบข้อมูลระบุตัวตนระดับสูง ${findings.filter((f) => f.severity === "high").length} จุด — แก้ไขเคสให้ generalise ก่อนจึงอนุมัติได้` };
    }
  }

  const { error } = await supabase.from("studio_cases").update({ approved_for_content: parsed.data.approved }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: handleDbError(error, "studio:setCaseApproved") };

  await logAudit({ actorId: profile.id, action: "STUDIO_CASE_APPROVE", entity: "studio_cases", entityId: parsed.data.id, metadata: { approved: parsed.data.approved } });
  revalidatePath(CASES_PATH);
  revalidatePath(`${CASES_PATH}/${parsed.data.id}`);
  return { ok: true };
}

// ─── AI: extract insights ────────────────────────────────────────────────────

export async function extractInsightsForCase(caseId: string): Promise<ActionResult<{ inserted: number; anonymizedUpdated: boolean }>> {
  const profile = await requireStudioAdmin();
  const idParsed = idSchema.safeParse(caseId);
  if (!idParsed.success) return { ok: false, error: "รหัสไม่ถูกต้อง" };
  if (!isAiAvailable()) return { ok: false, error: "AI ยังใช้งานไม่ได้ — ตรวจสอบ ANTHROPIC_API_KEY ในตั้งค่าสตูดิโอ" };

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase.from("studio_cases").select("*").eq("id", idParsed.data).maybeSingle();
  if (readErr) return { ok: false, error: handleDbError(readErr, "studio:extractInsights:read") };
  if (!row) return { ok: false, error: "ไม่พบเคสนี้" };
  const studioCase = row as StudioCase;

  const result = await extractCaseInsights({ studioCase, userId: profile.id });
  if (!result.ok) return { ok: false, error: result.error };

  const rules = await loadPrivacyRules(supabase);
  const rows = result.data.insights.map((i) => {
    // Belt and braces: the deterministic scan can only tighten the AI's own verdict.
    const det = scrubText({ fields: { insight: i.insight, lesson: i.lesson, content_angle: i.content_angle, title: i.title }, rules });
    const privacy_status = hasHigh(det) ? "blocked" : det.length > 0 && i.privacy_status === "safe" ? "review_required" : i.privacy_status;
    return {
      case_id: studioCase.id,
      title: i.title.trim().slice(0, 200),
      insight: i.insight.trim().slice(0, 5000),
      lesson: i.lesson?.trim().slice(0, 5000) || null,
      content_angle: i.content_angle?.trim().slice(0, 2000) || null,
      pillar: (PILLARS as string[]).includes(i.pillar) ? i.pillar : null,
      privacy_status,
      approved_for_content: false,
      generated_by: "ai" as const,
      generation_id: result.generationId,
      created_by: profile.id,
    };
  });

  let inserted = 0;
  if (rows.length) {
    const { data: ins, error: insErr } = await supabase.from("studio_case_insights").insert(rows).select("id");
    if (insErr) return { ok: false, error: handleDbError(insErr, "studio:extractInsights:insert") };
    inserted = ins?.length ?? rows.length;
  }

  let anonymizedUpdated = false;
  if (!studioCase.anonymized_version?.trim() && result.data.anonymized_version?.trim()) {
    const { error: upErr } = await supabase.from("studio_cases").update({ anonymized_version: result.data.anonymized_version.trim().slice(0, 10_000) }).eq("id", studioCase.id);
    if (upErr) console.error("[studio:cases] anonymized_version update failed:", upErr.message);
    else anonymizedUpdated = true;
  }

  await logAudit({
    actorId: profile.id,
    action: "STUDIO_CASE_INSIGHTS_EXTRACT",
    entity: "studio_cases",
    entityId: studioCase.id,
    metadata: { inserted, anonymizedUpdated, generation_id: result.generationId, model: result.model },
  });
  console.info(`[studio:cases] extracted ${inserted} insights for ${studioCase.id} model=${result.model} by ${profile.id}`);
  revalidatePath(`${CASES_PATH}/${studioCase.id}`);
  revalidatePath(CASES_PATH);
  return { ok: true, data: { inserted, anonymizedUpdated } };
}

// ─── Insights ────────────────────────────────────────────────────────────────

export async function updateInsight(id: string, input: unknown): Promise<ActionResult<{ privacy_status: string; findings: PrivacyFinding[] }>> {
  const profile = await requireStudioAdmin();
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "รหัสไม่ถูกต้อง" };
  const parsed = insightSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: existing, error: readErr } = await supabase.from("studio_case_insights").select("id, case_id, approved_for_content").eq("id", idParsed.data).maybeSingle();
  if (readErr) return { ok: false, error: handleDbError(readErr, "studio:updateInsight:read") };
  if (!existing) return { ok: false, error: "ไม่พบบทเรียนนี้" };

  const rules = await loadPrivacyRules(supabase);
  const findings = scrubText({ fields: { title: parsed.data.title, insight: parsed.data.insight, lesson: parsed.data.lesson, content_angle: parsed.data.content_angle }, rules });
  const privacy_status = hasHigh(findings) ? "blocked" : parsed.data.privacy_status;
  const approved_for_content = privacy_status === "blocked" ? false : existing.approved_for_content;

  const { error } = await supabase
    .from("studio_case_insights")
    .update({ ...parsed.data, privacy_status, approved_for_content })
    .eq("id", idParsed.data);
  if (error) return { ok: false, error: handleDbError(error, "studio:updateInsight") };

  if (existing.approved_for_content && !approved_for_content) {
    await logAudit({ actorId: profile.id, action: "STUDIO_INSIGHT_APPROVE", entity: "studio_case_insights", entityId: idParsed.data, metadata: { approved: false, reason: "blocked_after_edit" } });
  }
  revalidatePath(`${CASES_PATH}/${existing.case_id}`);
  return { ok: true, data: { privacy_status, findings } };
}

export async function deleteInsight(id: string): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "รหัสไม่ถูกต้อง" };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("studio_case_insights").select("case_id").eq("id", idParsed.data).maybeSingle();
  const { error } = await supabase.from("studio_case_insights").delete().eq("id", idParsed.data);
  if (error) return { ok: false, error: handleDbError(error, "studio:deleteInsight") };

  await logAudit({ actorId: profile.id, action: "STUDIO_INSIGHT_DELETE", entity: "studio_case_insights", entityId: idParsed.data });
  if (existing?.case_id) revalidatePath(`${CASES_PATH}/${existing.case_id}`);
  revalidatePath(CASES_PATH);
  return { ok: true };
}

/** Approve toggle for an insight. Approving is refused while privacy_status === 'blocked'. */
export async function setInsightApproved(id: string, approved: boolean): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const parsed = z.object({ id: idSchema, approved: z.boolean() }).safeParse({ id, approved });
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase
    .from("studio_case_insights")
    .select("id, case_id, privacy_status, title, insight, lesson, content_angle")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (readErr) return { ok: false, error: handleDbError(readErr, "studio:setInsightApproved:read") };
  if (!row) return { ok: false, error: "ไม่พบบทเรียนนี้" };

  if (parsed.data.approved) {
    if (row.privacy_status === "blocked") {
      return { ok: false, error: "บทเรียนนี้ถูกบล็อกด้านความเป็นส่วนตัว — แก้ไขให้ generalise แล้วเปลี่ยนสถานะก่อนจึงอนุมัติได้" };
    }
    const rules = await loadPrivacyRules(supabase);
    const findings = scrubText({ fields: { title: row.title, insight: row.insight, lesson: row.lesson, content_angle: row.content_angle }, rules });
    if (hasHigh(findings)) {
      await supabase.from("studio_case_insights").update({ privacy_status: "blocked", approved_for_content: false }).eq("id", row.id);
      revalidatePath(`${CASES_PATH}/${row.case_id}`);
      return { ok: false, error: "ตรวจพบข้อมูลระบุตัวตนระดับสูงในบทเรียนนี้ — ระบบเปลี่ยนสถานะเป็นบล็อกแล้ว" };
    }
  }

  const { error } = await supabase.from("studio_case_insights").update({ approved_for_content: parsed.data.approved }).eq("id", row.id);
  if (error) return { ok: false, error: handleDbError(error, "studio:setInsightApproved") };

  await logAudit({ actorId: profile.id, action: "STUDIO_INSIGHT_APPROVE", entity: "studio_case_insights", entityId: row.id, metadata: { approved: parsed.data.approved, case_id: row.case_id } });
  revalidatePath(`${CASES_PATH}/${row.case_id}`);
  revalidatePath(CASES_PATH);
  return { ok: true };
}

/** Seeds an Idea Bank row from an insight (origin 'case', pillar from the insight). */
export async function createIdeaFromInsight(insightId: string): Promise<ActionResult<{ ideaId: string }>> {
  const profile = await requireStudioAdmin();
  const idParsed = idSchema.safeParse(insightId);
  if (!idParsed.success) return { ok: false, error: "รหัสไม่ถูกต้อง" };

  const supabase = await createClient();
  const { data: ins, error: readErr } = await supabase
    .from("studio_case_insights")
    .select("id, case_id, title, insight, lesson, content_angle, pillar, privacy_status")
    .eq("id", idParsed.data)
    .maybeSingle();
  if (readErr) return { ok: false, error: handleDbError(readErr, "studio:createIdeaFromInsight:read") };
  if (!ins) return { ok: false, error: "ไม่พบบทเรียนนี้" };
  if (ins.privacy_status === "blocked") return { ok: false, error: "บทเรียนที่ถูกบล็อกด้านความเป็นส่วนตัวไม่สามารถนำไปสร้างไอเดียได้" };

  const pillar: Pillar = (PILLARS as string[]).includes(ins.pillar ?? "") ? (ins.pillar as Pillar) : "case_story";
  const sourceRefs: SourceRef[] = [{ kind: "case_insight", id: ins.id, label: ins.title }];
  const description = [ins.insight, ins.lesson ? `บทเรียน: ${ins.lesson}` : null].filter(Boolean).join("\n\n");

  const { data, error } = await supabase
    .from("studio_ideas")
    .insert({
      title: ins.title.slice(0, 200),
      hook: ins.content_angle ? ins.content_angle.slice(0, 500) : null,
      description: description || null,
      pillar,
      platforms: [],
      origin: "case",
      source_refs: sourceRefs as unknown as never,
      status: "new",
      tags: [],
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: handleDbError(error ?? { message: "insert returned no row" }, "studio:createIdeaFromInsight") };

  console.info(`[studio:cases] idea ${data.id} created from insight ${ins.id} by ${profile.id}`);
  revalidatePath("/studio/ideas");
  return { ok: true, data: { ideaId: data.id } };
}
