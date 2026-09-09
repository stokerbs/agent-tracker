"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { logAudit } from "@/lib/audit";
import { getStudioAdmin } from "@/lib/studio/auth";
import { CONTENT_STATUS_META } from "@/lib/studio/constants";
import type { ActionResult, ContentStatus } from "@/lib/studio/types";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SCHEDULE_TIME, buildBangkokISO, isDayKey, isTimeString, shiftToDay } from "./date-utils";

/**
 * Calendar scheduling actions. Only approved/scheduled masters may be placed
 * on the calendar; drafts must go through review + approval first so the
 * privacy gate is never bypassed by "just scheduling it".
 */

const UNAUTHORIZED = "ไม่มีสิทธิ์ใช้งาน Creative Studio";
const SCHEDULABLE: readonly string[] = ["approved", "scheduled"];

const uuidSchema = z.uuid("รหัสคอนเทนต์ไม่ถูกต้อง");
const dayKeySchema = z.string().refine(isDayKey, "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)");
const timeSchema = z.string().refine(isTimeString, "รูปแบบเวลาไม่ถูกต้อง (HH:mm)");
const isoSchema = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "รูปแบบเวลาไม่ถูกต้อง");

export interface ScheduledResult {
  id: string;
  scheduled_at: string;
  status: ContentStatus;
}

function revalidateCalendar() {
  for (const p of ["/studio", "/studio/calendar", "/studio/content"]) revalidatePath(p);
}

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
}

function refuseStatus(status: string): string {
  const label = CONTENT_STATUS_META[status as ContentStatus]?.label ?? status;
  return `ตั้งเวลาได้เฉพาะคอนเทนต์ที่อนุมัติแล้วเท่านั้น (สถานะปัจจุบัน: ${label}) — ส่งตรวจและอนุมัติก่อน`;
}

async function loadMaster(id: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("studio_content_masters")
    .select("id, title, status, scheduled_at")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[studio:calendar] load master failed:", error.message);
    return { sb, master: null, error: "โหลดคอนเทนต์ไม่สำเร็จ" };
  }
  if (!data) return { sb, master: null, error: "ไม่พบคอนเทนต์นี้" };
  return { sb, master: data, error: null };
}

async function applySchedule(id: string, scheduledAt: string, actorId: string, action: string): Promise<ActionResult<ScheduledResult>> {
  const { sb, master, error } = await loadMaster(id);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์นี้" };
  if (!SCHEDULABLE.includes(master.status)) return { ok: false, error: refuseStatus(master.status) };

  const { error: updErr } = await sb
    .from("studio_content_masters")
    .update({ scheduled_at: scheduledAt, status: "scheduled" })
    .eq("id", id);
  if (updErr) {
    console.error("[studio:calendar] schedule update failed:", updErr.message);
    return { ok: false, error: "บันทึกเวลาไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  await logAudit({
    actorId,
    action,
    entity: "studio_content_masters",
    entityId: id,
    metadata: { from: master.scheduled_at, to: scheduledAt },
  });
  revalidateCalendar();
  return { ok: true, data: { id, scheduled_at: scheduledAt, status: "scheduled" } };
}

/** Drag-and-drop / time edit: move a master to a new instant. */
export async function rescheduleMaster(id: string, newISO: string): Promise<ActionResult<ScheduledResult>> {
  const admin = await getStudioAdmin();
  if (!admin) return { ok: false, error: UNAUTHORIZED };
  const parsed = z.object({ id: uuidSchema, newISO: isoSchema }).safeParse({ id, newISO });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return applySchedule(parsed.data.id, new Date(parsed.data.newISO).toISOString(), admin.id, "studio.content.reschedule");
}

/** Drag from the unscheduled list / "create on this day" picker onto a day. */
export async function scheduleMasterToDay(id: string, day: string, time: string = DEFAULT_SCHEDULE_TIME): Promise<ActionResult<ScheduledResult>> {
  const admin = await getStudioAdmin();
  if (!admin) return { ok: false, error: UNAUTHORIZED };
  const parsed = z.object({ id: uuidSchema, day: dayKeySchema, time: timeSchema }).safeParse({ id, day, time });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return applySchedule(parsed.data.id, buildBangkokISO(parsed.data.day, parsed.data.time), admin.id, "studio.content.schedule");
}

/** Drop onto another day keeping the original Bangkok time-of-day. */
export async function moveMasterToDay(id: string, day: string): Promise<ActionResult<ScheduledResult>> {
  const admin = await getStudioAdmin();
  if (!admin) return { ok: false, error: UNAUTHORIZED };
  const parsed = z.object({ id: uuidSchema, day: dayKeySchema }).safeParse({ id, day });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { master, error } = await loadMaster(parsed.data.id);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์นี้" };
  if (!SCHEDULABLE.includes(master.status)) return { ok: false, error: refuseStatus(master.status) };
  const target = master.scheduled_at ? shiftToDay(master.scheduled_at, parsed.data.day) : buildBangkokISO(parsed.data.day);
  return applySchedule(parsed.data.id, target, admin.id, "studio.content.reschedule");
}

/** Take a scheduled master off the calendar: back to approved, no date. */
export async function unscheduleMaster(id: string): Promise<ActionResult<{ id: string; status: ContentStatus }>> {
  const admin = await getStudioAdmin();
  if (!admin) return { ok: false, error: UNAUTHORIZED };
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { sb, master, error } = await loadMaster(parsed.data);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์นี้" };
  if (master.status !== "scheduled") {
    const label = CONTENT_STATUS_META[master.status as ContentStatus]?.label ?? master.status;
    return { ok: false, error: `เอาออกจากปฏิทินได้เฉพาะคอนเทนต์ที่ตั้งเวลาแล้ว (สถานะปัจจุบัน: ${label})` };
  }

  const { error: updErr } = await sb
    .from("studio_content_masters")
    .update({ scheduled_at: null, status: "approved" })
    .eq("id", parsed.data);
  if (updErr) {
    console.error("[studio:calendar] unschedule failed:", updErr.message);
    return { ok: false, error: "เอาออกจากปฏิทินไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  await logAudit({
    actorId: admin.id,
    action: "studio.content.unschedule",
    entity: "studio_content_masters",
    entityId: parsed.data,
    metadata: { from: master.scheduled_at },
  });
  revalidateCalendar();
  return { ok: true, data: { id: parsed.data, status: "approved" } };
}

/**
 * "สร้างใหม่" from a day cell: a draft master pre-dated to that day. It stays
 * a draft (not on the live calendar as scheduled) until approved — the editor
 * takes over from here.
 */
export async function createDraftOnDay(input: { day: string; time?: string; title?: string }): Promise<ActionResult<{ id: string }>> {
  const admin = await getStudioAdmin();
  if (!admin) return { ok: false, error: UNAUTHORIZED };
  const parsed = z
    .object({
      day: dayKeySchema,
      time: timeSchema.default(DEFAULT_SCHEDULE_TIME),
      title: z.string().trim().max(200, "ชื่อยาวเกิน 200 ตัวอักษร").optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const scheduledAt = buildBangkokISO(parsed.data.day, parsed.data.time);
  const title = parsed.data.title?.length ? parsed.data.title : `คอนเทนต์ใหม่ ${parsed.data.day}`;

  const sb = await createClient();
  const { data, error } = await sb
    .from("studio_content_masters")
    .insert({ title, status: "draft", scheduled_at: scheduledAt, created_by: admin.id })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[studio:calendar] create draft failed:", error?.message);
    return { ok: false, error: "สร้างคอนเทนต์ไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  revalidateCalendar();
  return { ok: true, data: { id: data.id } };
}
