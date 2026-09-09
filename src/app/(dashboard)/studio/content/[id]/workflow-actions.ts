"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStudioAdmin } from "@/lib/studio/auth";
import { getStudioSettings } from "@/lib/studio/settings";
import { logAudit } from "@/lib/audit";
import type { ActionResult, ContentStatus, PrivacyStatus } from "@/lib/studio/types";
import { getLatestPrivacyCheck, revalidateContentPaths, runAndStorePrivacyCheck } from "./privacy-check";

/**
 * Content workflow: draft → review → approved → scheduled → published, with
 * the privacy approval gate. Every transition re-checks the admin role, reads
 * the current status under RLS, validates the transition and records a
 * studio_content_reviews row where a human decision was made.
 */

const idSchema = z.string().uuid();
const noteSchema = z.string().trim().max(2000);

const UNAUTHORIZED = "ไม่มีสิทธิ์ดำเนินการ";

async function loadMaster(masterId: string) {
  const rls = await createClient();
  const { data, error } = await rls
    .from("studio_content_masters")
    .select("id, title, status, scheduled_at")
    .eq("id", masterId)
    .maybeSingle();
  if (error) {
    console.error("[studio:workflow] master load failed:", error.message);
    return { rls, master: null, error: "โหลดคอนเทนต์ไม่สำเร็จ" as string | null };
  }
  if (!data) return { rls, master: null, error: "ไม่พบคอนเทนต์" as string | null };
  return { rls, master: data, error: null as string | null };
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    draft: "ร่าง",
    review: "รอตรวจ",
    approved: "อนุมัติแล้ว",
    scheduled: "ตั้งเวลาแล้ว",
    published: "เผยแพร่แล้ว",
    archived: "เก็บถาวร",
    rejected: "ไม่ผ่าน",
    idea: "ไอเดีย",
  };
  return map[s] ?? s;
}

const PRIVACY_RANK: Record<PrivacyStatus, number> = { safe: 0, review_required: 1, blocked: 2 };
function worstPrivacy(a: PrivacyStatus, b: PrivacyStatus): PrivacyStatus {
  return PRIVACY_RANK[a] >= PRIVACY_RANK[b] ? a : b;
}

/** Fresh deterministic scan; returns an error result when the copy is BLOCKED. */
async function gateBlocked(
  rls: Awaited<ReturnType<typeof createClient>>,
  masterId: string,
  userId: string,
): Promise<{ ok: false; error: string } | null> {
  const fresh = await runAndStorePrivacyCheck(rls, masterId, { useAi: false, userId });
  if (!fresh.ok) return fresh;
  if (fresh.check.status === "blocked") {
    console.warn(`[studio:workflow] transition refused (blocked) master=${masterId}`);
    return { ok: false, error: "Privacy Check เป็น BLOCKED — พบข้อมูลระบุตัวตนในเนื้อหาปัจจุบัน แก้ให้ทั่วไปขึ้นแล้วอนุมัติใหม่" };
  }
  return null;
}

function transitionError(from: string, allowed: ContentStatus[]): string {
  return `ทำรายการนี้ไม่ได้จากสถานะ "${statusLabel(from)}" (ต้องเป็น ${allowed.map(statusLabel).join(" / ")})`;
}

async function setStatus(
  rls: Awaited<ReturnType<typeof createClient>>,
  masterId: string,
  patch: Record<string, unknown>,
): Promise<string | null> {
  const { error } = await rls.from("studio_content_masters").update(patch as never).eq("id", masterId);
  if (error) {
    console.error("[studio:workflow] status update failed:", error.message);
    return "อัปเดตสถานะไม่สำเร็จ";
  }
  return null;
}

async function insertReview(
  rls: Awaited<ReturnType<typeof createClient>>,
  masterId: string,
  reviewerId: string,
  decision: "approve" | "reject" | "request_changes" | "override_privacy",
  note: string | null,
): Promise<void> {
  const { error } = await rls.from("studio_content_reviews").insert({ master_id: masterId, reviewer_id: reviewerId, decision, note });
  if (error) console.error("[studio:workflow] review insert failed:", error.message);
}

// ─── submitForReview ─────────────────────────────────────────────────────────
export async function submitForReview(input: unknown): Promise<ActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const masterId = parsed.data;

  const { rls, master, error } = await loadMaster(masterId);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };
  if (master.status !== "draft") return { ok: false, error: transitionError(master.status, ["draft"]) };

  // Always re-scan at submit time so the reviewer sees the state of the text
  // as it is now, not as it was when an earlier check ran.
  const check = await runAndStorePrivacyCheck(rls, masterId, { useAi: false, userId: profile.id });
  if (!check.ok) return check;

  const err = await setStatus(rls, masterId, { status: "review" });
  if (err) return { ok: false, error: err };
  console.info(`[studio:workflow] submit_for_review master=${masterId} by=${profile.id}`);
  revalidateContentPaths(masterId);
  return { ok: true };
}

// ─── approve (the gate) ──────────────────────────────────────────────────────
const approveSchema = z.object({
  masterId: idSchema,
  overridePrivacy: z.boolean().optional(),
  acknowledgeUnsupported: z.boolean().optional(),
  note: noteSchema.optional(),
});

export async function approveContent(input: unknown): Promise<ActionResult<{ status: "approved" }>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const { masterId, overridePrivacy, acknowledgeUnsupported } = parsed.data;
  const note = parsed.data.note?.trim() || null;

  const { rls, master, error } = await loadMaster(masterId);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };
  if (master.status !== "review" && master.status !== "draft") {
    return { ok: false, error: transitionError(master.status, ["review", "draft"]) };
  }

  const settings = await getStudioSettings();

  // 1. Privacy gate. The text may have been edited after the last check, so a
  //    fresh deterministic scan ALWAYS runs at decision time and the gate uses
  //    the WORST of (latest AI/human verdict) and (fresh scan). Only AI/human
  //    rows count as "previous" — otherwise the deterministic row this very
  //    action inserts would become "latest" and a second click would erase a
  //    stricter AI verdict. To clear an AI verdict the owner re-runs the AI
  //    check (new AI row) or records an explicit override.
  const previous = await getLatestPrivacyCheck(rls, masterId, { checkedBy: ["ai", "human"] });
  const fresh = await runAndStorePrivacyCheck(rls, masterId, { useAi: false, userId: profile.id });
  if (!fresh.ok) return fresh;
  const freshStatus = fresh.check.status;
  const gateStatus = previous ? worstPrivacy(previous.status, freshStatus) : freshStatus;
  const latest = {
    // Point the audit at the row that produced the verdict.
    id: previous && gateStatus === previous.status && gateStatus !== freshStatus ? previous.id : fresh.check.id ?? "",
    status: gateStatus,
    previousStatus: previous?.status ?? null,
    previousId: previous?.id ?? null,
    freshStatus,
    freshId: fresh.check.id ?? null,
  };

  if (latest.status === "blocked") {
    console.warn(`[studio:workflow] approve refused (blocked) master=${masterId}`);
    return { ok: false, error: "ไม่สามารถอนุมัติได้: Privacy Check เป็น BLOCKED — แก้เนื้อหาให้ทั่วไปขึ้นแล้วตรวจอีกครั้ง" };
  }

  // review_required ALWAYS leaves an override trail. With require_privacy_safe
  // on, the owner must tick the override explicitly; with it off, the override
  // is recorded automatically (still a review row + audit entry).
  let overrode = false;
  let overrideNote: string | null = null;
  if (latest.status === "review_required") {
    if (settings.approval_rules.require_privacy_safe) {
      if (!settings.approval_rules.allow_override) {
        return { ok: false, error: "Privacy Check เป็น \"ต้องตรวจสอบ\" และตั้งค่าสตูดิโอไม่อนุญาตให้ override — แก้เนื้อหาแล้วตรวจอีกครั้ง" };
      }
      if (overridePrivacy !== true) {
        return {
          ok: false,
          error: "Privacy Check เป็น \"ต้องตรวจสอบ\" — ติ๊กช่องยืนยันว่าคุณตรวจสอบแล้วและไม่มีข้อมูลระบุตัวตน (override) ก่อนอนุมัติ",
        };
      }
      overrideNote = note ?? "ยืนยันว่าตรวจสอบแล้ว ไม่มีข้อมูลระบุตัวตน";
    } else {
      overrideNote = `อนุมัติขณะ Privacy Check = ต้องตรวจสอบ (require_privacy_safe ปิดอยู่)${note ? ` · ${note}` : ""}`;
    }
    overrode = true;
  }

  // 2. Fact-claim gate — unsupported claims need explicit acknowledgement.
  const { data: claims, error: cErr } = await rls.from("studio_content_claims").select("id, support_status").eq("master_id", masterId);
  if (cErr) {
    console.error("[studio:workflow] claims load failed:", cErr.message);
    return { ok: false, error: "โหลดรายการ claim ไม่สำเร็จ" };
  }
  const unsupported = (claims ?? []).filter((c) => c.support_status === "unsupported").length;
  if (unsupported > 0 && acknowledgeUnsupported !== true) {
    return {
      ok: false,
      error: `มี ${unsupported} claim ที่ไม่มีแหล่งอ้างอิง — แก้ไข/ลบ หรือติ๊กรับทราบก่อนอนุมัติ`,
    };
  }

  // 3. Record decisions, then flip the status.
  if (overrode) {
    await insertReview(rls, masterId, profile.id, "override_privacy", overrideNote);
    await logAudit({
      actorId: profile.id,
      action: "STUDIO_PRIVACY_OVERRIDE",
      entity: "studio_content_masters",
      entityId: masterId,
      metadata: { privacy_check_id: latest.id, note: overrideNote, explicit: settings.approval_rules.require_privacy_safe },
    });
  }

  const now = new Date().toISOString();
  const err = await setStatus(rls, masterId, { status: "approved", approved_by: profile.id, approved_at: now });
  if (err) return { ok: false, error: err };

  const approveNote = [note, unsupported > 0 ? `รับทราบ claim ที่ไม่มีแหล่งอ้างอิง ${unsupported} รายการ` : null].filter(Boolean).join(" · ") || null;
  await insertReview(rls, masterId, profile.id, "approve", approveNote);
  await logAudit({
    actorId: profile.id,
    action: "STUDIO_CONTENT_APPROVE",
    entity: "studio_content_masters",
    entityId: masterId,
    metadata: { privacy_status: latest.status, previous_check_status: latest.previousStatus, previous_check_id: latest.previousId, fresh_check_status: latest.freshStatus, fresh_check_id: latest.freshId, privacy_check_id: latest.id, override: overrode, unsupported_claims: unsupported, from_status: master.status },
  });
  console.info(`[studio:workflow] approve master=${masterId} by=${profile.id} privacy=${latest.status} override=${overrode}`);
  revalidateContentPaths(masterId);
  return { ok: true, data: { status: "approved" } };
}

// ─── requestChanges / reject ─────────────────────────────────────────────────
const noteActionSchema = z.object({ masterId: idSchema, note: noteSchema.min(1, "กรุณาระบุเหตุผล") });

export async function requestChanges(input: unknown): Promise<ActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = noteActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const { masterId, note } = parsed.data;

  const { rls, master, error } = await loadMaster(masterId);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };
  if (master.status !== "review") return { ok: false, error: transitionError(master.status, ["review"]) };

  const err = await setStatus(rls, masterId, { status: "draft" });
  if (err) return { ok: false, error: err };
  await insertReview(rls, masterId, profile.id, "request_changes", note);
  await logAudit({ actorId: profile.id, action: "STUDIO_CONTENT_REQUEST_CHANGES", entity: "studio_content_masters", entityId: masterId, metadata: { note } });
  console.info(`[studio:workflow] request_changes master=${masterId} by=${profile.id}`);
  revalidateContentPaths(masterId);
  return { ok: true };
}

export async function rejectContent(input: unknown): Promise<ActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = noteActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const { masterId, note } = parsed.data;

  const { rls, master, error } = await loadMaster(masterId);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };
  const allowed: ContentStatus[] = ["draft", "review", "approved", "scheduled"];
  if (!allowed.includes(master.status as ContentStatus)) return { ok: false, error: transitionError(master.status, allowed) };

  const err = await setStatus(rls, masterId, { status: "rejected", scheduled_at: null });
  if (err) return { ok: false, error: err };
  await insertReview(rls, masterId, profile.id, "reject", note);
  await logAudit({ actorId: profile.id, action: "STUDIO_CONTENT_REJECT", entity: "studio_content_masters", entityId: masterId, metadata: { from_status: master.status } });
  console.info(`[studio:workflow] reject master=${masterId} by=${profile.id}`);
  revalidateContentPaths(masterId);
  return { ok: true };
}

// ─── schedule / unschedule ───────────────────────────────────────────────────
const scheduleSchema = z.object({
  masterId: idSchema,
  scheduledAt: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), "รูปแบบวันเวลาไม่ถูกต้อง"),
});

export async function scheduleContent(input: unknown): Promise<ActionResult<{ scheduledAt: string }>> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const { masterId } = parsed.data;
  const scheduledAt = new Date(parsed.data.scheduledAt).toISOString();

  const { rls, master, error } = await loadMaster(masterId);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };
  // Re-scheduling an already scheduled piece is allowed (calendar drag-drop).
  if (master.status !== "approved" && master.status !== "scheduled") {
    return { ok: false, error: transitionError(master.status, ["approved"]) };
  }

  const gate = await gateBlocked(rls, masterId, profile.id);
  if (gate) return gate;

  const err = await setStatus(rls, masterId, { status: "scheduled", scheduled_at: scheduledAt });
  if (err) return { ok: false, error: err };
  await logAudit({ actorId: profile.id, action: "STUDIO_CONTENT_SCHEDULE", entity: "studio_content_masters", entityId: masterId, metadata: { scheduled_at: scheduledAt, from_status: master.status } });
  console.info(`[studio:workflow] schedule master=${masterId} at=${scheduledAt}`);
  revalidateContentPaths(masterId);
  return { ok: true, data: { scheduledAt } };
}

export async function unscheduleContent(input: unknown): Promise<ActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const masterId = parsed.data;

  const { rls, master, error } = await loadMaster(masterId);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };
  if (master.status !== "scheduled") return { ok: false, error: transitionError(master.status, ["scheduled"]) };

  const err = await setStatus(rls, masterId, { status: "approved", scheduled_at: null });
  if (err) return { ok: false, error: err };
  await logAudit({ actorId: profile.id, action: "STUDIO_CONTENT_UNSCHEDULE", entity: "studio_content_masters", entityId: masterId, metadata: { previous_scheduled_at: master.scheduled_at } });
  console.info(`[studio:workflow] unschedule master=${masterId} by=${profile.id}`);
  revalidateContentPaths(masterId);
  return { ok: true };
}

// ─── markPublished ───────────────────────────────────────────────────────────
const publishSchema = z.object({
  masterId: idSchema,
  publishedUrl: z
    .string()
    .trim()
    .url("ลิงก์ไม่ถูกต้อง")
    .max(500)
    .refine((u) => /^https?:\/\//i.test(u), "ลิงก์ต้องเริ่มด้วย http:// หรือ https://")
    .optional()
    .or(z.literal("")),
});

export async function markPublished(input: unknown): Promise<ActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const { masterId } = parsed.data;
  const publishedUrl = parsed.data.publishedUrl?.trim() || null;

  const { rls, master, error } = await loadMaster(masterId);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };
  if (master.status !== "scheduled" && master.status !== "approved") {
    return { ok: false, error: transitionError(master.status, ["approved", "scheduled"]) };
  }

  // Defence-in-depth: the copy that goes public must still pass the scrub.
  const gate = await gateBlocked(rls, masterId, profile.id);
  if (gate) return gate;

  const err = await setStatus(rls, masterId, { status: "published", published_at: new Date().toISOString(), published_url: publishedUrl });
  if (err) return { ok: false, error: err };
  await logAudit({
    actorId: profile.id,
    action: "STUDIO_CONTENT_PUBLISH",
    entity: "studio_content_masters",
    entityId: masterId,
    metadata: { published_url: publishedUrl, manual: true },
  });
  console.info(`[studio:workflow] mark_published master=${masterId} by=${profile.id}`);
  revalidateContentPaths(masterId);
  return { ok: true };
}

// ─── archive / unarchive / delete ────────────────────────────────────────────
export async function archiveContent(input: unknown): Promise<ActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const masterId = parsed.data;

  const { rls, master, error } = await loadMaster(masterId);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };
  if (master.status === "archived") return { ok: false, error: "คอนเทนต์นี้ถูกเก็บถาวรอยู่แล้ว" };

  const err = await setStatus(rls, masterId, { status: "archived", scheduled_at: null });
  if (err) return { ok: false, error: err };
  await logAudit({ actorId: profile.id, action: "STUDIO_CONTENT_ARCHIVE", entity: "studio_content_masters", entityId: masterId, metadata: { from_status: master.status } });
  console.info(`[studio:workflow] archive master=${masterId} by=${profile.id}`);
  revalidateContentPaths(masterId);
  return { ok: true };
}

export async function unarchiveContent(input: unknown): Promise<ActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const masterId = parsed.data;

  const { rls, master, error } = await loadMaster(masterId);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };
  if (master.status !== "archived" && master.status !== "rejected") {
    return { ok: false, error: transitionError(master.status, ["archived", "rejected"]) };
  }

  const err = await setStatus(rls, masterId, { status: "draft", approved_by: null, approved_at: null });
  if (err) return { ok: false, error: err };
  await logAudit({ actorId: profile.id, action: "STUDIO_CONTENT_UNARCHIVE", entity: "studio_content_masters", entityId: masterId, metadata: { from_status: master.status } });
  console.info(`[studio:workflow] unarchive master=${masterId} by=${profile.id}`);
  revalidateContentPaths(masterId);
  return { ok: true };
}

export async function deleteContent(input: unknown): Promise<ActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const masterId = parsed.data;

  const { rls, master, error } = await loadMaster(masterId);
  if (!master) return { ok: false, error: error ?? "ไม่พบคอนเทนต์" };
  const allowed: ContentStatus[] = ["draft", "rejected", "archived"];
  if (!allowed.includes(master.status as ContentStatus)) {
    return { ok: false, error: `ลบได้เฉพาะสถานะ ${allowed.map(statusLabel).join(" / ")} — เก็บถาวรก่อนหากต้องการลบ` };
  }

  const { error: delErr } = await rls.from("studio_content_masters").delete().eq("id", masterId);
  if (delErr) {
    console.error("[studio:workflow] delete failed:", delErr.message);
    return { ok: false, error: "ลบคอนเทนต์ไม่สำเร็จ" };
  }
  await logAudit({
    actorId: profile.id,
    action: "STUDIO_CONTENT_DELETE",
    entity: "studio_content_masters",
    entityId: masterId,
    metadata: { title: master.title, status: master.status },
  });
  console.info(`[studio:workflow] delete master=${masterId} by=${profile.id}`);
  revalidateContentPaths(masterId);
  return { ok: true };
}
