import "server-only";

import * as Sentry from "@sentry/nextjs";
import { BUCKETS } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { recordGeneration } from "@/lib/studio/ai/run";
import { scrubText } from "@/lib/studio/privacy/scrub";
import { getStudioSettingsStrict } from "@/lib/studio/settings";
import type { CreativeAsset, CreativePlan } from "@/lib/studio/types";
import { MEDIA_RATE_LIMIT, MEDIA_RATE_WINDOW_MS, type MediaErrorCode } from "./generate";
import { buildMotionPrompt } from "./prompts";
import { getVideoProvider, MediaNotConfiguredError, MediaRefusedError } from "./provider";
import { HOOK_SECONDS } from "./veo-video";

/**
 * Motion hook: an 8 s generated clip that replaces the first shot's still in the rendered video (docs §17).
 *
 * Veo takes minutes, which is longer than a Vercel function may run, so the work is split in two:
 * `startHookMotion` validates, starts the operation and stores a `pending` asset that remembers the operation
 * name; `finishPendingHookMotions` (cron) polls, downloads and finalises it. The renderer only ever looks at
 * `ready` assets, so a clip that is still generating simply means the next render uses the still.
 */

export const MOTION_TARGET = "hook_motion";
/** Generation is minutes, not hours: past this a pending asset is stuck and is marked failed. */
export const MOTION_TIMEOUT_MS = 20 * 60_000;

export interface MotionMeta {
  target: { kind: typeof MOTION_TARGET };
  /** `operation` is null for the moment between claiming the slot and the provider answering. */
  veo: { operation: string | null; started_at: string };
  seconds: number;
}

/** A row may sit without an operation only while `startHookMotion` is mid-call; past this it never got one. */
export const MOTION_CLAIM_GRACE_MS = 2 * 60_000;

export type MotionStart = { ok: true; assetId: string } | { ok: false; error: string; code: MediaErrorCode };

function motionScene(plan: CreativePlan | null, hook: string | null, title: string): string | null {
  const shot = plan?.shots?.[0];
  const visual = shot?.visual?.trim();
  if (visual) return visual;
  const fallback = hook?.trim() || title.trim();
  return fallback ? `Establishing shot that fits this line, no text on screen: ${fallback}` : null;
}

export async function startHookMotion(input: { master: { id: string; title: string; hook: string | null; creative_plan: CreativePlan | null }; userId: string }): Promise<MotionStart> {
  const { master, userId } = input;
  let rules;
  let prefs;
  try {
    const settings = await getStudioSettingsStrict();
    rules = settings.privacy_rules;
    prefs = settings.media_prefs;
  } catch {
    return { ok: false, error: "โหลดการตั้งค่าสตูดิโอไม่สำเร็จ — ลองใหม่อีกครั้ง", code: "failed" };
  }

  const scene = motionScene(master.creative_plan, master.hook, master.title);
  if (!scene) return { ok: false, error: "ยังไม่มีคำบรรยายภาพของฉากแรก — สร้าง creative plan ก่อน", code: "no_source" };
  const findings = scrubText({ fields: { scene }, rules });
  const blocked = findings.find((f) => f.severity === "high" || f.kind === "denylist");
  if (blocked) return { ok: false, error: `คำบรรยายฉากแรกมีข้อมูลที่ระบุตัวตนได้ (${blocked.reason}) — ลบออกก่อนสร้างวิดีโอ`, code: "blocked" };

  const svc = createServiceClient();
  const { count, error: cErr } = await svc
    .from("studio_ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("purpose", ["image_generation", "tts", "video_hook"])
    .gte("created_at", new Date(Date.now() - MEDIA_RATE_WINDOW_MS).toISOString());
  if (cErr) return { ok: false, error: "ตรวจสอบโควตาการสร้างสื่อไม่สำเร็จ — ลองใหม่อีกครั้ง", code: "failed" };
  if ((count ?? 0) >= MEDIA_RATE_LIMIT) return { ok: false, error: `สร้างสื่อครบ ${MEDIA_RATE_LIMIT} ครั้งใน 5 นาทีแล้ว — รอสักครู่ก่อนสร้างเพิ่ม (กันค่าใช้จ่ายพุ่ง)`, code: "rate_limited" };

  const prompt = buildMotionPrompt({ style: prefs.image_style, scene, seconds: HOOK_SECONDS });
  let provider;
  try {
    provider = getVideoProvider();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), code: "not_configured" };
  }

  // Claim the slot BEFORE paying: the partial unique index (0123) allows one pending motion hook per master, so two
  // concurrent clicks cannot both reach Veo, and a crash between here and the provider call can never lose an
  // operation we were billed for — the row already exists and the sweep will time it out.
  const meta: MotionMeta = { target: { kind: MOTION_TARGET }, veo: { operation: null, started_at: new Date().toISOString() }, seconds: HOOK_SECONDS };
  const { data: row, error: iErr } = await svc
    .from("studio_creative_assets")
    .insert({
      master_id: master.id,
      kind: "broll",
      status: "pending",
      label: `ฮุกเคลื่อนไหว ${HOOK_SECONDS} วิ`,
      mime: "video/mp4",
      bytes: 0,
      duration_ms: HOOK_SECONDS * 1000,
      prompt,
      provider: "veo",
      model: prefs.video_model || "default",
      meta: meta as never,
      created_by: userId,
    })
    .select("id")
    .single();
  if (iErr?.code === "23505") return { ok: false, error: "กำลังสร้างวิดีโอฮุกของคอนเทนต์นี้อยู่แล้ว — รอให้เสร็จก่อน", code: "rate_limited" };
  if (iErr || !row) {
    console.error("[studio:media] motion hook row insert failed:", iErr?.message);
    return { ok: false, error: "เริ่มสร้างวิดีโอฮุกไม่สำเร็จ — ลองใหม่อีกครั้ง", code: "failed" };
  }

  const started = Date.now();
  try {
    const op = await provider.start({ prompt, model: prefs.video_model || undefined, seconds: HOOK_SECONDS });
    const { error: uErr } = await svc
      .from("studio_creative_assets")
      .update({ model: op.model, meta: { ...meta, veo: { operation: op.operation, started_at: meta.veo.started_at } } as never })
      .eq("id", row.id);
    if (uErr) throw new Error(`asset update failed: ${uErr.message}`);
    // Counts against the shared media quota at the moment the spend happens, not when the cron finishes.
    await recordGeneration({
      purpose: "video_hook",
      provider: op.provider,
      model: op.model,
      input_refs: { master_id: master.id, asset_id: row.id, prompt_chars: prompt.length, phase: "start", seconds: HOOK_SECONDS },
      output: { operation: op.operation },
      input_tokens: null,
      output_tokens: null,
      duration_ms: Date.now() - started,
      status: "ok",
      error: null,
      user_id: userId,
    });
    console.info(`[studio:media] motion hook started master=${master.id} model=${op.model} asset=${row.id}`);
    return { ok: true, assetId: row.id };
  } catch (err) {
    const code: MediaErrorCode = err instanceof MediaNotConfiguredError ? "not_configured" : err instanceof MediaRefusedError ? "refused" : "failed";
    const message = err instanceof Error ? err.message : String(err);
    console.error("[studio:media] motion hook start failed:", message);
    if (code === "failed") Sentry.captureException(err, { tags: { module: "studio-media", purpose: "video_hook" } });
    // Free the slot: without this the unique index would block every later attempt for this master.
    await svc.from("studio_creative_assets").update({ status: "failed", error: message.slice(0, 500) }).eq("id", row.id).eq("status", "pending");
    await recordGeneration({
      purpose: "video_hook",
      provider: "veo",
      model: prefs.video_model || "default",
      input_refs: { master_id: master.id, asset_id: row.id, prompt_chars: prompt.length, phase: "start" },
      output: null,
      input_tokens: null,
      output_tokens: null,
      duration_ms: Date.now() - started,
      status: code === "refused" ? "refused" : "error",
      error: message.slice(0, 1000),
      user_id: userId,
    });
    if (code === "refused") return { ok: false, error: "โมเดลวิดีโอปฏิเสธคำสั่งนี้ — ปรับคำบรรยายฉากให้เป็นกลางขึ้น", code };
    if (code === "not_configured") return { ok: false, error: message, code };
    return { ok: false, error: "เริ่มสร้างวิดีโอฮุกไม่สำเร็จ — ลองใหม่อีกครั้ง", code };
  }
}

export interface MotionSweep {
  checked: number;
  ready: number;
  failed: number;
  pending: number;
  errors: string[];
}

/** Cron sweep: poll every pending motion asset once, finish the ones Veo has rendered. */
export async function finishPendingHookMotions(opts: { now?: number } = {}): Promise<MotionSweep> {
  const now = opts.now ?? Date.now();
  const res: MotionSweep = { checked: 0, ready: 0, failed: 0, pending: 0, errors: [] };
  const svc = createServiceClient();
  const { data: rows, error } = await svc
    .from("studio_creative_assets")
    .select("id, master_id, model, meta, created_by, created_at")
    .eq("kind", "broll")
    .eq("status", "pending")
    .contains("meta", { target: { kind: MOTION_TARGET } })
    .order("created_at")
    .limit(20);
  if (error) {
    res.errors.push(`load: ${error.message}`);
    return res;
  }
  let provider;
  try {
    provider = getVideoProvider();
  } catch (e) {
    res.errors.push(e instanceof Error ? e.message : String(e));
    return res;
  }

  for (const row of rows ?? []) {
    res.checked += 1;
    const meta = (row.meta ?? {}) as Partial<MotionMeta>;
    const operation = meta.veo?.operation;
    const startedAt = Date.parse(meta.veo?.started_at ?? row.created_at);
    const ageMs = now - (Number.isFinite(startedAt) ? startedAt : now);
    if (!operation) {
      // Still inside the start call's grace window: the operation name is on its way.
      if (ageMs <= MOTION_CLAIM_GRACE_MS) {
        res.pending += 1;
        continue;
      }
      await fail(svc, row.id, "ไม่มีรหัสงานของโมเดลวิดีโอ");
      res.failed += 1;
      continue;
    }
    try {
      const poll = await provider.poll(operation);
      if (!poll.done) {
        if (ageMs > MOTION_TIMEOUT_MS) {
          await fail(svc, row.id, `สร้างวิดีโอนานเกิน ${Math.round(MOTION_TIMEOUT_MS / 60_000)} นาที — ยกเลิกแล้ว`);
          res.failed += 1;
        } else res.pending += 1;
        continue;
      }
      if (poll.error || !poll.uri) {
        await fail(svc, row.id, poll.error ?? "โมเดลวิดีโอไม่ส่งไฟล์กลับมา");
        res.failed += 1;
        continue;
      }
      const started = Date.now();
      const video = await provider.download(poll.uri);
      const path = `${row.master_id}/${row.id}.mp4`;
      const { error: upErr } = await svc.storage.from(BUCKETS.studioMedia).upload(path, video.bytes, { contentType: video.mime, upsert: true });
      if (upErr) throw new Error(`upload failed: ${upErr.message}`);
      const { error: uErr } = await svc.from("studio_creative_assets").update({ status: "ready", storage_path: path, bytes: video.bytes.length, width: 1080, height: 1920 }).eq("id", row.id).eq("status", "pending");
      if (uErr) throw new Error(`finalise failed: ${uErr.message}`);
      await recordGeneration({
        // A separate purpose from the start: the quota is charged once, when the spend happens.
        purpose: "video_hook_finish",
        provider: "veo",
        model: row.model ?? "veo",
        input_refs: { master_id: row.master_id, asset_id: row.id, phase: "finish", seconds: meta.seconds ?? HOOK_SECONDS },
        output: { bytes: video.bytes.length },
        input_tokens: null,
        output_tokens: null,
        duration_ms: Date.now() - started,
        status: "ok",
        error: null,
        user_id: row.created_by,
      });
      console.info(`[studio:media] motion hook ready master=${row.master_id} asset=${row.id} bytes=${video.bytes.length}`);
      res.ready += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.errors.push(`${row.id}: ${message.slice(0, 200)}`);
      if (err instanceof MediaRefusedError) {
        await fail(svc, row.id, message);
        res.failed += 1;
        continue;
      }
      // Network blips must not burn the asset: leave it pending and try again on the next sweep, until the timeout.
      if (ageMs > MOTION_TIMEOUT_MS) {
        await fail(svc, row.id, message);
        res.failed += 1;
      } else {
        res.pending += 1;
        console.warn(`[studio:media] motion hook poll failed (will retry) asset=${row.id}: ${message.slice(0, 200)}`);
      }
    }
  }
  return res;
}

async function fail(svc: ReturnType<typeof createServiceClient>, id: string, message: string): Promise<void> {
  await svc.from("studio_creative_assets").update({ status: "failed", error: message.slice(0, 500) }).eq("id", id).eq("status", "pending");
  console.error(`[studio:media] motion hook failed asset=${id}: ${message.slice(0, 200)}`);
}

/** The ready motion hook for a master, if any (newest first). */
export async function findHookMotion(masterId: string): Promise<Pick<CreativeAsset, "id" | "storage_path"> | null> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("studio_creative_assets")
    .select("id, storage_path")
    .eq("master_id", masterId)
    .eq("kind", "broll")
    .eq("status", "ready")
    .contains("meta", { target: { kind: MOTION_TARGET } })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.storage_path) return null;
  return data;
}
