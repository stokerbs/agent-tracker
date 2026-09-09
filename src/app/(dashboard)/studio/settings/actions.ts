"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStudioAdmin } from "@/lib/studio/auth";
import { logAudit } from "@/lib/audit";
import { handleDbError } from "@/lib/errors";
import { PILLARS, PLATFORMS, STUDIO_MODELS, STUDIO_SETTINGS_ID } from "@/lib/studio/constants";
import { loadDemoData, removeDemoData, type SeedSummary } from "@/lib/studio/seed";
import type { ActionResult, ApprovalRules, BrandVoice, PillarConfig, PrivacyRules } from "@/lib/studio/types";
import type { KnowledgePrefs } from "./knowledge-prefs";

/**
 * Studio Settings server actions — one action per settings card.
 *
 * Every action: zod → requireStudioAdmin() (throws "Unauthorized") → RLS client
 * upsert on the singleton row (id = STUDIO_SETTINGS_ID) with updated_by =
 * profile.id → logAudit → revalidatePath. jsonb columns are cast `as never`.
 *
 * The service client is never imported here. loadDemoData / removeDemoData are
 * server-only lib functions that use it internally; they are only reachable
 * after the admin check below.
 */

const SETTINGS_PATH = "/studio/settings";

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
}

const chipList = (max: number, itemMax: number) =>
  z
    .array(z.string().trim().min(1).max(itemMax, `แต่ละรายการต้องไม่เกิน ${itemMax} ตัวอักษร`))
    .max(max, `ใส่ได้สูงสุด ${max} รายการ`)
    .transform((items) => Array.from(new Set(items)));

/** Upserts a partial patch onto the singleton row and stamps updated_by. */
async function saveSettings(
  patch: Record<string, unknown>,
  actorId: string,
  context: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("studio_settings")
    .upsert({ id: STUDIO_SETTINGS_ID, ...patch, updated_by: actorId } as never, { onConflict: "id" });
  if (error) {
    console.error(`[studio:settings] ${context} failed actor=${actorId}`, error);
    return { ok: false, error: handleDbError(error, `studio_settings:${context}`) };
  }
  console.info(`[studio:settings] ${context} saved actor=${actorId}`);
  return { ok: true };
}

// ─── 1. Brand voice ──────────────────────────────────────────────────────────

const brandVoiceSchema = z.object({
  language: z.enum(["th", "en"]),
  style: chipList(20, 40).refine((v) => v.length > 0, "ต้องมีสไตล์อย่างน้อย 1 รายการ"),
  avoid: chipList(20, 60),
  cta_default: z.string().trim().max(300, "CTA ยาวเกิน 300 ตัวอักษร"),
  custom_notes: z.string().trim().max(4000, "คำสั่งเพิ่มเติมยาวเกิน 4000 ตัวอักษร"),
});
export type BrandVoiceInput = z.input<typeof brandVoiceSchema>;

export async function updateBrandVoice(input: unknown): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const parsed = brandVoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const brandVoice: BrandVoice = parsed.data;
  const res = await saveSettings({ brand_voice: brandVoice, default_language: brandVoice.language }, profile.id, "brand_voice");
  if (!res.ok) return res;
  await logAudit({ actorId: profile.id, action: "STUDIO_SETTINGS_UPDATE", entity: "studio_settings", entityId: STUDIO_SETTINGS_ID, metadata: { section: "brand_voice" } });
  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

// ─── 2. Default platforms ────────────────────────────────────────────────────

const platformsSchema = z.object({
  platforms: z
    .array(z.enum(PLATFORMS as [string, ...string[]]))
    .min(1, "เลือกอย่างน้อย 1 แพลตฟอร์ม")
    .transform((v) => Array.from(new Set(v))),
});

export async function updateDefaultPlatforms(input: unknown): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const parsed = platformsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const res = await saveSettings({ default_platforms: parsed.data.platforms }, profile.id, "default_platforms");
  if (!res.ok) return res;
  await logAudit({ actorId: profile.id, action: "STUDIO_SETTINGS_UPDATE", entity: "studio_settings", entityId: STUDIO_SETTINGS_ID, metadata: { section: "default_platforms", platforms: parsed.data.platforms } });
  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

// ─── 3. Content pillars ──────────────────────────────────────────────────────

const pillarsSchema = z.object({
  pillars: z
    .array(
      z.object({
        key: z.enum(PILLARS as [string, ...string[]]),
        target_pct: z.coerce.number().int("เปอร์เซ็นต์ต้องเป็นจำนวนเต็ม").min(0, "เปอร์เซ็นต์ต้องไม่ติดลบ").max(100),
      }),
    )
    .refine((arr) => new Set(arr.map((p) => p.key)).size === arr.length, "มี pillar ซ้ำกัน")
    .refine((arr) => PILLARS.every((k) => arr.some((p) => p.key === k)), "ต้องระบุครบทุก pillar")
    .refine((arr) => arr.reduce((s, p) => s + p.target_pct, 0) === 100, "สัดส่วนรวมต้องเท่ากับ 100%"),
});

export async function updatePillars(input: unknown): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const parsed = pillarsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const pillars = parsed.data.pillars as PillarConfig[];
  const res = await saveSettings({ pillars }, profile.id, "pillars");
  if (!res.ok) return res;
  await logAudit({ actorId: profile.id, action: "STUDIO_SETTINGS_UPDATE", entity: "studio_settings", entityId: STUDIO_SETTINGS_ID, metadata: { section: "pillars", pillars } });
  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

// ─── 4. AI provider ──────────────────────────────────────────────────────────

const MODEL_IDS = STUDIO_MODELS.map((m) => m.id) as [string, ...string[]];

const aiProviderSchema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  model: z.enum(MODEL_IDS, { message: "โมเดลไม่อยู่ในรายการที่รองรับ" }),
});

export async function updateAiProvider(input: unknown): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const parsed = aiProviderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const res = await saveSettings({ ai_provider: parsed.data.provider, ai_model: parsed.data.model }, profile.id, "ai_provider");
  if (!res.ok) return res;
  await logAudit({ actorId: profile.id, action: "STUDIO_SETTINGS_UPDATE", entity: "studio_settings", entityId: STUDIO_SETTINGS_ID, metadata: { section: "ai_provider", ...parsed.data } });
  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

// ─── 5. Knowledge preferences (stored only — not wired into search yet) ─────

const knowledgePrefsSchema = z.object({
  prefer_case_insights: z.boolean(),
  max_context_blocks: z.coerce.number().int().min(4, "อย่างน้อย 4 บล็อก").max(12, "สูงสุด 12 บล็อก"),
  include_customer_questions: z.boolean(),
});

export async function updateKnowledgePrefs(input: unknown): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const parsed = knowledgePrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const prefs: KnowledgePrefs = parsed.data;
  const res = await saveSettings({ knowledge_prefs: prefs }, profile.id, "knowledge_prefs");
  if (!res.ok) return res;
  await logAudit({ actorId: profile.id, action: "STUDIO_SETTINGS_UPDATE", entity: "studio_settings", entityId: STUDIO_SETTINGS_ID, metadata: { section: "knowledge_prefs", ...prefs } });
  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

// ─── 6. Privacy rules ────────────────────────────────────────────────────────

const MAX_PATTERN_LEN = 200;

const privacyRulesSchema = z.object({
  denylist: chipList(200, 80),
  custom_patterns: z
    .array(z.string().trim().min(1).max(MAX_PATTERN_LEN, `regex แต่ละบรรทัดต้องไม่เกิน ${MAX_PATTERN_LEN} ตัวอักษร`))
    .max(50, "ใส่ regex ได้สูงสุด 50 บรรทัด")
    .transform((v) => Array.from(new Set(v))),
  strict_mode: z.boolean(),
});
export type PrivacyRulesInput = z.input<typeof privacyRulesSchema>;

/** Returns the first pattern that fails to compile, or null. Exported for tests. */
export async function findInvalidPattern(patterns: string[]): Promise<string | null> {
  for (const p of patterns) {
    try {
      new RegExp(p, "u");
    } catch {
      return p;
    }
  }
  return null;
}

export async function updatePrivacyRules(input: unknown): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const parsed = privacyRulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const bad = await findInvalidPattern(parsed.data.custom_patterns);
  if (bad !== null) return { ok: false, error: `รูปแบบ regex ไม่ถูกต้อง: ${bad}` };
  const rules: PrivacyRules = parsed.data;
  const res = await saveSettings({ privacy_rules: rules }, profile.id, "privacy_rules");
  if (!res.ok) return res;
  await logAudit({
    actorId: profile.id,
    action: "STUDIO_PRIVACY_RULES_UPDATE",
    entity: "studio_settings",
    entityId: STUDIO_SETTINGS_ID,
    metadata: { denylist_count: rules.denylist.length, pattern_count: rules.custom_patterns.length, strict_mode: rules.strict_mode },
  });
  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

// ─── 7. Approval rules ───────────────────────────────────────────────────────

const approvalRulesSchema = z.object({
  require_privacy_safe: z.boolean(),
  allow_override: z.boolean(),
});

export async function updateApprovalRules(input: unknown): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  const parsed = approvalRulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const rules: ApprovalRules = parsed.data;
  const res = await saveSettings({ approval_rules: rules }, profile.id, "approval_rules");
  if (!res.ok) return res;
  await logAudit({ actorId: profile.id, action: "STUDIO_APPROVAL_RULES_UPDATE", entity: "studio_settings", entityId: STUDIO_SETTINGS_ID, metadata: { ...rules } });
  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

// ─── 9. Demo data ────────────────────────────────────────────────────────────

export async function loadDemo(): Promise<ActionResult<SeedSummary>> {
  const profile = await requireStudioAdmin();
  try {
    const summary = await loadDemoData(profile.id);
    await logAudit({ actorId: profile.id, action: "STUDIO_DEMO_LOAD", entity: "studio_settings", entityId: STUDIO_SETTINGS_ID, metadata: { ...summary } });
    revalidatePath("/studio", "layout");
    return { ok: true, data: summary };
  } catch (err) {
    console.error(`[studio:settings] loadDemo failed actor=${profile.id}`, err);
    return { ok: false, error: "โหลดข้อมูลตัวอย่างไม่สำเร็จ — ตรวจสอบว่า migration 0109 ถูก apply แล้ว" };
  }
}

export async function removeDemo(): Promise<ActionResult> {
  const profile = await requireStudioAdmin();
  try {
    await removeDemoData();
    await logAudit({ actorId: profile.id, action: "STUDIO_DEMO_REMOVE", entity: "studio_settings", entityId: STUDIO_SETTINGS_ID });
    revalidatePath("/studio", "layout");
    return { ok: true };
  } catch (err) {
    console.error(`[studio:settings] removeDemo failed actor=${profile.id}`, err);
    return { ok: false, error: "ลบข้อมูลตัวอย่างไม่สำเร็จ" };
  }
}
