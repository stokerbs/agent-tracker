import "server-only";

import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import * as Sentry from "@sentry/nextjs";
import { BUCKETS } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { recordGeneration } from "@/lib/studio/ai/run";
import { getTtsProvider, MediaNotConfiguredError, type TtsProvider } from "@/lib/studio/media/provider";
import { scrubText } from "@/lib/studio/privacy/scrub";
import { getStudioSettingsStrict } from "@/lib/studio/settings";
import type { CreativeAsset, CreativePlan } from "@/lib/studio/types";
import { buildAss } from "./ass";
import { buildFfmpegArgs, runFfmpeg } from "./ffmpeg";
import { layoutShots, mp3DurationSec, OUTPUT_H, OUTPUT_W, resolveShotImages, totalDuration, type ShotSource } from "./timeline";

/**
 * Template video pipeline (phase 3): per-shot still + per-shot narration →
 * ffmpeg → mp4 asset. Runs inside the render route handler (maxDuration 300)
 * after the action created the job and the route re-checked the admin.
 *
 * Privacy: hook/script/caption are re-scrubbed before any TTS call (nothing
 * is synthesised from blocked text); the job row keeps step names and counts
 * only. Per-shot narration is cached as audio assets keyed by a hash of the
 * text + voice so a re-render does not pay TTS twice.
 */

export const FONTS_DIR = path.join(process.cwd(), "src/lib/studio/video/fonts");
const FFMPEG_TIMEOUT_MS = 240_000;

export interface RenderOutcome {
  ok: boolean;
  jobId: string;
  assetId?: string;
  durationSec?: number;
  error?: string;
}

type Svc = ReturnType<typeof createServiceClient>;

export async function runRenderJob(jobId: string, opts: { userId: string; tts?: TtsProvider }): Promise<RenderOutcome> {
  const svc = createServiceClient();
  const { data: job, error: jErr } = await svc.from("studio_render_jobs").select("*").eq("id", jobId).maybeSingle();
  if (jErr || !job) return { ok: false, jobId, error: "ไม่พบงาน render" };
  if (job.status !== "queued") return { ok: false, jobId, error: `งานนี้อยู่ในสถานะ ${job.status} แล้ว` };

  const step = async (progress: number, label: string) => {
    await svc.from("studio_render_jobs").update({ progress, step: label }).eq("id", jobId);
  };
  const fail = async (message: string, err?: unknown): Promise<RenderOutcome> => {
    console.error(`[studio:video] job=${jobId} failed: ${message}`, err instanceof Error ? err.message : "");
    if (err && !(err instanceof MediaNotConfiguredError)) Sentry.captureException(err, { tags: { module: "studio-video" } });
    await svc.from("studio_render_jobs").update({ status: "failed", error: message.slice(0, 900), finished_at: new Date().toISOString() }).eq("id", jobId);
    return { ok: false, jobId, error: message };
  };

  // Atomic claim: only one runner may move queued → running (double POST / retry must not render twice).
  const { data: claimed } = await svc
    .from("studio_render_jobs")
    .update({ status: "running", started_at: new Date().toISOString(), progress: 2, step: "กำลังเตรียมข้อมูล" })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, jobId, error: "งานนี้ถูกเริ่มไปแล้ว" };
  let tmp: string | null = null;
  const started = Date.now();
  try {
    const [{ data: master, error: mErr }, { data: assets, error: aErr }, settings] = await Promise.all([
      svc.from("studio_content_masters").select("id, title, hook, script, caption, creative_plan, status").eq("id", job.master_id).maybeSingle(),
      svc.from("studio_creative_assets").select("*").eq("master_id", job.master_id).eq("status", "ready"),
      getStudioSettingsStrict(),
    ]);
    if (mErr || !master) return await fail("โหลดคอนเทนต์ไม่สำเร็จ");
    if (aErr) return await fail("โหลดสื่อไม่สำเร็จ");
    if (master.status === "archived") return await fail("คอนเทนต์ถูกเก็บถาวรแล้ว");

    // Privacy: never narrate text that would be blocked from publishing.
    const findings = scrubText({ fields: { hook: master.hook ?? "", script: master.script ?? "", caption: master.caption ?? "" }, rules: settings.privacy_rules });
    const hit = findings.find((f) => f.severity === "high" || f.kind === "denylist");
    if (hit) return await fail(`สคริปต์ยังมีข้อมูลที่ระบุตัวตนได้ (${hit.reason}) — แก้ให้ผ่าน Privacy Check ก่อนสร้างวิดีโอ`);

    const plan = (master.creative_plan as CreativePlan | null) ?? { shots: [], broll: [], text_overlays: [] };
    const images = (assets ?? []).filter((a) => a.kind === "thumbnail" || a.kind === "image");
    const resolved = resolveShotImages(plan, images);
    if ("error" in resolved) return await fail(resolved.error);
    const shotsWithVoice = resolved.filter((s) => s.voice);
    if (!shotsWithVoice.length) return await fail("ยังไม่มีข้อความพากย์ใน shot list (ช่อง voice ว่างทุกฉาก)");

    let tts: TtsProvider;
    try {
      tts = opts.tts ?? getTtsProvider();
    } catch (e) {
      return await fail(e instanceof Error ? e.message : String(e), e);
    }

    tmp = await mkdtemp(path.join(tmpdir(), "studio-render-"));
    await step(8, "กำลังดาวน์โหลดภาพ");
    const imagePaths = new Map<string, string>();
    for (const id of Array.from(new Set(resolved.map((s) => s.imageAssetId)))) {
      const a = images.find((x) => x.id === id)!;
      const buf = await downloadAsset(svc, a);
      const p = path.join(tmp, `img-${id}.${a.storage_path!.split(".").pop() ?? "png"}`);
      await writeFile(p, buf);
      imagePaths.set(id, p);
    }

    // Per-shot narration (cached by hash of text + voice).
    const voiceId = settings.media_prefs.tts_voice_id || undefined;
    const ttsModel = settings.media_prefs.tts_model || undefined;
    const audioAssets = (assets ?? []).filter((a) => a.kind === "audio");
    const timed: (ShotSource & { voiceSec: number; audioPath: string | null; imagePath: string })[] = [];
    let ttsCalls = 0;
    for (const [i, s] of resolved.entries()) {
      await step(10 + Math.round((i / resolved.length) * 45), `กำลังพากย์เสียงฉาก ${i + 1}/${resolved.length}`);
      let audioPath: string | null = null;
      let voiceSec = 0;
      if (s.voice) {
        const hash = shotHash(s.voice, voiceId ?? "default", ttsModel ?? "default");
        let audio = audioAssets.find((a) => (a.meta as { shot_hash?: string } | null)?.shot_hash === hash) ?? null;
        let bytes: Uint8Array;
        if (audio?.storage_path) {
          bytes = await downloadAsset(svc, audio);
        } else {
          const out = await tts.synthesize({ text: s.voice, voiceId, model: ttsModel });
          ttsCalls += 1;
          bytes = out.bytes;
          audio = await storeAudio(svc, { masterId: master.id, index: i, bytes, hash, voiceId: out.voiceId, model: out.model, durationMs: out.durationMs ?? mp3DurationSec(bytes.length) * 1000, userId: opts.userId });
        }
        voiceSec = mp3DurationSec(bytes.length);
        audioPath = path.join(tmp, `vo-${i}.mp3`);
        await writeFile(audioPath, bytes);
      }
      timed.push({ ...s, voiceSec, audioPath, imagePath: imagePaths.get(s.imageAssetId)! });
    }

    const laid = layoutShots(timed);
    if ("error" in laid) return await fail(laid.error);
    const durationSec = totalDuration(laid);

    await step(60, "กำลังตัดต่อวิดีโอ");
    const assPath = path.join(tmp, "subs.ass");
    await writeFile(assPath, buildAss({ shots: laid, hook: master.hook }), "utf8");
    const outPath = path.join(tmp, "out.mp4");
    const plan2 = buildFfmpegArgs({ shots: laid, assPath, fontsDir: FONTS_DIR, outPath });
    console.info(`[studio:video] job=${jobId} ffmpeg ${plan2.summary} (${durationSec}s, tts_calls=${ttsCalls})`);
    const run = await runFfmpeg(plan2.args, { timeoutMs: FFMPEG_TIMEOUT_MS });

    await step(88, "กำลังอัปโหลดวิดีโอ");
    const mp4 = await readFile(outPath);
    const { data: row, error: iErr } = await svc
      .from("studio_creative_assets")
      .insert({
        master_id: master.id,
        kind: "video",
        status: "pending",
        label: `วิดีโอ 9:16 (${Math.round(durationSec)} วิ)`,
        mime: "video/mp4",
        bytes: mp4.byteLength,
        width: OUTPUT_W,
        height: OUTPUT_H,
        duration_ms: Math.round(durationSec * 1000),
        prompt: null,
        provider: "ffmpeg",
        model: "template-v2",
        meta: { aspect: "9:16", style: "viral", shots: laid.length, tts_calls: ttsCalls, render_ms: run.durationMs, job_id: jobId } as never,
        created_by: opts.userId,
      })
      .select("*")
      .single();
    if (iErr || !row) throw new Error(`asset row insert failed: ${iErr?.message ?? "no row"}`);
    const storagePath = `${master.id}/${row.id}.mp4`;
    const { error: upErr } = await svc.storage.from(BUCKETS.studioMedia).upload(storagePath, mp4, { contentType: "video/mp4", upsert: false });
    if (upErr) {
      await svc.from("studio_creative_assets").update({ status: "failed", error: upErr.message.slice(0, 500) }).eq("id", row.id);
      throw new Error(`upload failed: ${upErr.message}`);
    }
    await svc.from("studio_creative_assets").update({ status: "ready", storage_path: storagePath }).eq("id", row.id);

    await recordGeneration({
      purpose: "video_render",
      provider: "ffmpeg",
      model: "template-v2",
      input_refs: { master_id: master.id, job_id: jobId, shots: laid.length, tts_calls: ttsCalls },
      output: { asset_id: row.id, duration_sec: durationSec, bytes: mp4.byteLength, render_ms: run.durationMs },
      input_tokens: null,
      output_tokens: null,
      duration_ms: Date.now() - started,
      status: "ok",
      error: null,
      user_id: opts.userId,
    });
    await svc.from("studio_render_jobs").update({ status: "done", progress: 100, step: "เสร็จแล้ว", asset_id: row.id, finished_at: new Date().toISOString() }).eq("id", jobId);
    console.info(`[studio:video] job=${jobId} done asset=${row.id} ${durationSec}s bytes=${mp4.byteLength} total=${Date.now() - started}ms`);
    return { ok: true, jobId, assetId: row.id, durationSec };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return await fail(message.startsWith("ffmpeg") ? `ตัดต่อวิดีโอไม่สำเร็จ — ${message}` : `สร้างวิดีโอไม่สำเร็จ — ${message}`, err);
  } finally {
    if (tmp) await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function shotHash(text: string, voiceId: string, model: string): string {
  return createHash("sha256").update(`${model}|${voiceId}|${text.trim()}`).digest("hex").slice(0, 32);
}

async function downloadAsset(svc: Svc, a: Pick<CreativeAsset, "id" | "storage_path">): Promise<Uint8Array> {
  if (!a.storage_path) throw new Error(`asset ${a.id} has no object`);
  const { data, error } = await svc.storage.from(BUCKETS.studioMedia).download(a.storage_path);
  if (error || !data) throw new Error(`download failed for ${a.id}: ${error?.message ?? "no data"}`);
  return new Uint8Array(await data.arrayBuffer());
}

async function storeAudio(svc: Svc, a: { masterId: string; index: number; bytes: Uint8Array; hash: string; voiceId: string; model: string; durationMs: number; userId: string }): Promise<CreativeAsset> {
  const { data: row, error } = await svc
    .from("studio_creative_assets")
    .insert({
      master_id: a.masterId,
      kind: "audio",
      status: "pending",
      label: `เสียงฉาก ${a.index + 1}`,
      mime: "audio/mpeg",
      bytes: a.bytes.length,
      duration_ms: Math.round(a.durationMs),
      prompt: null,
      provider: "elevenlabs",
      model: a.model,
      meta: { shot_hash: a.hash, shot_index: a.index, voice_id: a.voiceId } as never,
      created_by: a.userId,
    })
    .select("*")
    .single();
  if (error || !row) throw new Error(`audio row insert failed: ${error?.message ?? "no row"}`);
  const storagePath = `${a.masterId}/${row.id}.mp3`;
  const { error: upErr } = await svc.storage.from(BUCKETS.studioMedia).upload(storagePath, a.bytes, { contentType: "audio/mpeg", upsert: false });
  if (upErr) {
    await svc.from("studio_creative_assets").update({ status: "failed", error: upErr.message.slice(0, 500) }).eq("id", row.id);
    throw new Error(`audio upload failed: ${upErr.message}`);
  }
  const { data: ready } = await svc.from("studio_creative_assets").update({ status: "ready", storage_path: storagePath }).eq("id", row.id).select("*").single();
  return ready ?? row;
}
