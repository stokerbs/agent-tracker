"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStudioAdmin } from "@/lib/studio/auth";
import { handleDbError } from "@/lib/errors";
import { PLATFORMS } from "@/lib/studio/constants";
import type { ActionResult } from "@/lib/studio/types";

/**
 * Studio Analytics — V1 foundation = MANUAL metric entry.
 *
 * recordMetrics() inserts one studio_analytics snapshot (source = 'manual')
 * for a published content master. Every number is validated server-side
 * (non-negative ints, completion_rate 0–100); the DB CHECK constraint on
 * completion_rate is the second line of defence. created_by is always the
 * server session's user id.
 */

const ANALYTICS_PATH = "/studio/analytics";

/** "" / null / undefined → null, otherwise coerce to a number the inner schema validates. */
const optionalNumber = (inner: z.ZodNumber) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v) : v), inner.nullable());

const nonNegInt = optionalNumber(z.number().int("ต้องเป็นจำนวนเต็ม").min(0, "ต้องไม่ติดลบ").max(1_000_000_000, "ค่าใหญ่เกินไป"));

const metricsSchema = z.object({
  master_id: z.string().uuid("รหัสคอนเทนต์ไม่ถูกต้อง"),
  platform: z.enum(PLATFORMS as [string, ...string[]], { message: "แพลตฟอร์มไม่ถูกต้อง" }),
  recorded_at: z
    .string()
    .min(1, "กรุณาระบุเวลาที่บันทึก")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "รูปแบบเวลาไม่ถูกต้อง")
    .refine((v) => new Date(v).getTime() <= Date.now() + 5 * 60_000, "เวลาที่บันทึกต้องไม่อยู่ในอนาคต"),
  views: nonNegInt,
  reach: nonNegInt,
  likes: nonNegInt,
  comments: nonNegInt,
  shares: nonNegInt,
  saves: nonNegInt,
  avg_watch_sec: optionalNumber(z.number().min(0, "ต้องไม่ติดลบ").max(100_000, "ค่าใหญ่เกินไป")),
  completion_rate: optionalNumber(z.number().min(0, "completion rate ต้องอยู่ระหว่าง 0–100").max(100, "completion rate ต้องอยู่ระหว่าง 0–100")),
  profile_visits: nonNegInt,
  dms: nonNegInt,
  leads: nonNegInt,
  qualified_leads: nonNegInt,
  conversions: nonNegInt,
  note: z
    .string()
    .trim()
    .max(1000, "หมายเหตุยาวเกิน 1000 ตัวอักษร")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});
export type MetricsInput = z.input<typeof metricsSchema>;

function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "ข้อมูลไม่ถูกต้อง";
  const field = issue.path[0];
  return field ? `${String(field)}: ${issue.message}` : issue.message;
}

export async function recordMetrics(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requireStudioAdmin();
  const parsed = metricsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;

  const supabase = await createClient();

  // The master must exist and be published — metrics on drafts make no sense.
  const { data: master, error: mErr } = await supabase.from("studio_content_masters").select("id, status").eq("id", d.master_id).maybeSingle();
  if (mErr) {
    console.error(`[studio:analytics] master lookup failed actor=${profile.id} master=${d.master_id}`, mErr);
    return { ok: false, error: handleDbError(mErr, "studio_analytics:lookup") };
  }
  if (!master) return { ok: false, error: "ไม่พบคอนเทนต์นี้" };
  if (master.status !== "published") return { ok: false, error: "บันทึกผลได้เฉพาะคอนเทนต์ที่เผยแพร่แล้ว" };

  const { data, error } = await supabase
    .from("studio_analytics")
    .insert({
      master_id: d.master_id,
      platform: d.platform,
      recorded_at: new Date(d.recorded_at).toISOString(),
      views: d.views,
      reach: d.reach,
      likes: d.likes,
      comments: d.comments,
      shares: d.shares,
      saves: d.saves,
      avg_watch_sec: d.avg_watch_sec,
      completion_rate: d.completion_rate,
      profile_visits: d.profile_visits,
      dms: d.dms,
      leads: d.leads,
      qualified_leads: d.qualified_leads,
      conversions: d.conversions,
      source: "manual",
      note: d.note,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error(`[studio:analytics] recordMetrics failed actor=${profile.id} master=${d.master_id}`, error);
    return { ok: false, error: error ? handleDbError(error, "studio_analytics:insert") : "บันทึกไม่สำเร็จ" };
  }

  console.info(`[studio:analytics] snapshot recorded id=${data.id} master=${d.master_id} platform=${d.platform} actor=${profile.id}`);
  revalidatePath(ANALYTICS_PATH);
  revalidatePath("/studio");
  return { ok: true, data: { id: data.id } };
}
