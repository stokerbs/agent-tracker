"use server";

import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { getStudioAdmin } from "@/lib/studio/auth";
import { getMediaAvailability } from "@/lib/studio/media/provider";
import { getStudioSettings } from "@/lib/studio/settings";
import { MAX_SHOTS } from "@/lib/studio/video/timeline";
import type { CreativePlan, RenderJob } from "@/lib/studio/types";
import { revalidateContentPaths, runAndStorePrivacyCheck } from "./privacy-check";

/**
 * Video (phase 3) server actions: create a render job after the gates, read a
 * job for polling. The heavy work runs in /api/studio/render/[jobId].
 */

const UNAUTHORIZED = "ไม่มีสิทธิ์ดำเนินการ";
const idSchema = z.string().uuid();
/** A running job older than this is considered orphaned (function timed out) and is failed so the owner can retry. */
const STALE_RUNNING_MS = 8 * 60_000;
/** A queued job the client never started (tab closed before the POST) is expired after this. */
const STALE_QUEUED_MS = 3 * 60_000;
/** Renders are CPU-heavy 300 s functions + paid TTS — cap concurrent jobs across all masters. */
const MAX_ACTIVE_JOBS = 2;

export type CreateRenderJobResult = { ok: true; jobId: string } | { ok: false; error: string; code: "unauthorized" | "invalid" | "not_found" | "status" | "blocked" | "requirements" | "not_configured" | "busy" | "failed" };

export async function createRenderJob(input: unknown): Promise<CreateRenderJobResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED, code: "unauthorized" };
  const parsed = z.object({ masterId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง", code: "invalid" };
  const masterId = parsed.data.masterId;

  const rls = await createClient();
  const { data: master, error } = await rls.from("studio_content_masters").select("id, status, creative_plan").eq("id", masterId).maybeSingle();
  if (error) return { ok: false, error: "โหลดคอนเทนต์ไม่สำเร็จ", code: "failed" };
  if (!master) return { ok: false, error: "ไม่พบคอนเทนต์", code: "not_found" };
  if (master.status === "archived") return { ok: false, error: "คอนเทนต์ถูกเก็บถาวรแล้ว", code: "status" };

  const plan = (master.creative_plan as CreativePlan | null) ?? null;
  const shots = plan?.shots ?? [];
  if (!shots.length) return { ok: false, error: "ยังไม่มี shot list — สร้าง creative plan ก่อน", code: "requirements" };
  if (!shots.some((s) => s.voice?.trim())) return { ok: false, error: "shot list ยังไม่มีข้อความพากย์ (voice) — เติมก่อนสร้างวิดีโอ", code: "requirements" };
  if (shots.length > MAX_SHOTS) return { ok: false, error: `shot list เกิน ${MAX_SHOTS} ฉาก — รวมฉากให้สั้นลง`, code: "requirements" };

  const { count, error: aErr } = await rls.from("studio_creative_assets").select("id", { count: "exact", head: true }).eq("master_id", masterId).eq("status", "ready").in("kind", ["thumbnail", "image"]);
  if (aErr) return { ok: false, error: "โหลดสื่อไม่สำเร็จ", code: "failed" };
  if (!count) return { ok: false, error: "ยังไม่มีรูปที่พร้อมใช้ — สร้างภาพปกหรือภาพฉากในส่วน “สื่อ” ก่อน", code: "requirements" };

  const settings = await getStudioSettings();
  const avail = getMediaAvailability(settings.media_prefs);
  if (!avail.tts.available) return { ok: false, error: avail.tts.reason ?? "ยังไม่ได้ตั้งค่าเสียงพากย์", code: "not_configured" };

  // Same privacy stance as publishing: never narrate text that would be blocked.
  const fresh = await runAndStorePrivacyCheck(rls, masterId, { useAi: false, userId: profile.id });
  if (!fresh.ok) return { ok: false, error: fresh.error, code: "blocked" };
  if (fresh.check.status === "blocked") return { ok: false, error: "Privacy Check พบข้อมูลที่ระบุตัวตนได้ — แก้ก่อนสร้างวิดีโอ", code: "blocked" };

  // Free the one-active-job slot from orphans before inserting (queued never started / running beyond the function limit).
  await rls
    .from("studio_render_jobs")
    .update({ status: "failed", error: "งานหยุดกลางทางหรือไม่ได้เริ่ม — ลองใหม่", finished_at: new Date().toISOString() })
    .eq("master_id", masterId)
    .eq("status", "queued")
    .lt("created_at", new Date(Date.now() - STALE_QUEUED_MS).toISOString());
  await rls
    .from("studio_render_jobs")
    .update({ status: "failed", error: "งานหยุดกลางทาง (เกินเวลาที่เซิร์ฟเวอร์อนุญาต) — ลองใหม่ หรือย่อจำนวนฉาก", finished_at: new Date().toISOString() })
    .eq("master_id", masterId)
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - STALE_RUNNING_MS).toISOString());

  const { count: active, error: cErr } = await rls.from("studio_render_jobs").select("id", { count: "exact", head: true }).in("status", ["queued", "running"]);
  if (cErr) return { ok: false, error: "ตรวจสอบงาน render ไม่สำเร็จ", code: "failed" };
  if ((active ?? 0) >= MAX_ACTIVE_JOBS) return { ok: false, error: `มีงาน render ทำงานอยู่ ${active} งาน — รอให้เสร็จก่อน (สูงสุด ${MAX_ACTIVE_JOBS} งานพร้อมกัน)`, code: "busy" };

  const { data: job, error: jErr } = await rls
    .from("studio_render_jobs")
    .insert({ master_id: masterId, status: "queued", step: "รอเริ่ม", params: { aspect: "9:16", shots: shots.length, voice_id: settings.media_prefs.tts_voice_id || "default" } as never, created_by: profile.id })
    .select("id")
    .single();
  if (jErr || !job) {
    if (jErr?.code === "23505") return { ok: false, error: "มีงาน render ของคอนเทนต์นี้ทำงานอยู่แล้ว — รอให้เสร็จก่อน", code: "busy" };
    console.error("[studio:video] job insert failed:", jErr?.message);
    return { ok: false, error: "สร้างงาน render ไม่สำเร็จ", code: "failed" };
  }
  await logAudit({ actorId: profile.id, action: "STUDIO_VIDEO_RENDER", entity: "studio_render_jobs", entityId: job.id, metadata: { master_id: masterId, shots: shots.length } });
  console.info(`[studio:video] job created ${job.id} master=${masterId} shots=${shots.length}`);
  return { ok: true, jobId: job.id };
}

export async function getRenderJob(input: unknown): Promise<{ ok: true; job: RenderJob } | { ok: false; error: string }> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = z.object({ jobId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const rls = await createClient();
  const { data: job, error } = await rls.from("studio_render_jobs").select("*").eq("id", parsed.data.jobId).maybeSingle();
  if (error) return { ok: false, error: "โหลดงานไม่สำเร็จ" };
  if (!job) return { ok: false, error: "ไม่พบงาน render" };
  // Orphaned job (function killed): fail it so the unique active-job index frees up.
  if (job.status === "running" && job.started_at && Date.now() - new Date(job.started_at).getTime() > STALE_RUNNING_MS) {
    const { data: failed } = await rls
      .from("studio_render_jobs")
      .update({ status: "failed", error: "งานหยุดกลางทาง (เกินเวลาที่เซิร์ฟเวอร์อนุญาต) — ลองใหม่ หรือย่อจำนวนฉาก", finished_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "running")
      .select("*")
      .maybeSingle();
    if (failed) {
      revalidateContentPaths(job.master_id);
      return { ok: true, job: failed };
    }
  }
  if (job.status === "done" || job.status === "failed") revalidateContentPaths(job.master_id);
  return { ok: true, job };
}
