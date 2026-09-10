import "server-only";

import * as Sentry from "@sentry/nextjs";
import { BUCKETS } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { recordGeneration } from "@/lib/studio/ai/run";
import { scrubText } from "@/lib/studio/privacy/scrub";
import { getStudioSettingsStrict } from "@/lib/studio/settings";
import type { CreativeAsset, CreativePlan, ImageAspect, PrivacyRules } from "@/lib/studio/types";
import { MAX_TTS_CHARS } from "./elevenlabs-tts";
import { buildImagePrompt, describeImageTarget, sceneText, type ImageTarget } from "./prompts";
import { getImageProvider, getTtsProvider, MediaNotConfiguredError, MediaRefusedError } from "./provider";

/**
 * Media generation core (phase 1). Callers (server actions) have already
 * verified the admin; this module uses the service client for storage +
 * rows because Supabase Storage uploads from a server action would otherwise
 * need the user's JWT on a bucket the browser never touches directly.
 *
 * Privacy: the prompt / voice text is scrubbed with the studio rules first;
 * a high-severity or denylist hit refuses the call (nothing is sent out).
 * Generation log rows keep ids + char counts only.
 */

export type MediaErrorCode = "not_configured" | "blocked" | "refused" | "failed" | "no_source";
export type MediaResult = { ok: true; asset: CreativeAsset } | { ok: false; error: string; code: MediaErrorCode };

export interface MasterMediaContext {
  id: string;
  title: string;
  creative_plan: CreativePlan | null;
}

const SIGNED_URL_TTL_SEC = 600;

export async function generateImageAsset(input: { master: MasterMediaContext; target: ImageTarget; aspect: ImageAspect; userId: string }): Promise<MediaResult> {
  const { master, target, aspect, userId } = input;
  let rules: PrivacyRules;
  let prefs;
  try {
    const settings = await getStudioSettingsStrict();
    rules = settings.privacy_rules;
    prefs = settings.media_prefs;
  } catch (e) {
    return { ok: false, error: "โหลดการตั้งค่าสตูดิโอไม่สำเร็จ — ลองใหม่อีกครั้ง", code: "failed" };
  }

  const scene = sceneText(target, master.creative_plan, master.title);
  if (!scene) return { ok: false, error: "ยังไม่มีคำบรรยายภาพสำหรับเป้าหมายนี้ — สร้าง creative plan หรือพิมพ์คำบรรยายเอง", code: "no_source" };
  const prompt = buildImagePrompt({ style: prefs.image_style, scene, aspect, broll: master.creative_plan?.broll, musicMood: master.creative_plan?.music_mood });
  const blocked = blockingFinding(rules, scene);
  if (blocked) return { ok: false, error: `คำบรรยายภาพมีข้อมูลที่ระบุตัวตนได้ (${blocked}) — ลบออกก่อนสร้างภาพ`, code: "blocked" };

  let provider;
  try {
    provider = getImageProvider();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), code: "not_configured" };
  }
  const label = describeImageTarget(target, master.creative_plan);
  const started = Date.now();
  try {
    const img = await provider.generate({ prompt, aspect, model: prefs.image_model || undefined });
    const generationId = await recordGeneration({
      purpose: "image_generation",
      provider: img.provider,
      model: img.model,
      input_refs: { master_id: master.id, target: target.kind, prompt_chars: prompt.length, aspect },
      output: { bytes: img.bytes.length, mime: img.mime, width: img.width, height: img.height },
      input_tokens: null,
      output_tokens: null,
      duration_ms: img.durationMs,
      status: "ok",
      error: null,
      user_id: userId,
    });
    const asset = await storeAsset({
      masterId: master.id,
      kind: target.kind === "thumbnail" ? "thumbnail" : "image",
      label,
      bytes: img.bytes,
      mime: img.mime,
      ext: img.mime === "image/jpeg" ? "jpg" : img.mime === "image/webp" ? "webp" : "png",
      meta: { aspect, target: target.kind === "scene" ? { kind: "scene", index: target.index } : { kind: target.kind }, review: "manual" },
      width: img.width,
      height: img.height,
      durationMs: null,
      prompt,
      provider: img.provider,
      model: img.model,
      generationId,
      variantId: null,
      userId,
    });
    console.info(`[studio:media] image ok master=${master.id} target=${target.kind} model=${img.model} bytes=${img.bytes.length} ${img.durationMs}ms`);
    return { ok: true, asset };
  } catch (err) {
    return await failed("image_generation", err, { master_id: master.id, target: target.kind, prompt_chars: prompt.length }, provider.name, prefs.image_model || "default", Date.now() - started, userId);
  }
}

export async function generateVoiceoverAsset(input: { master: MasterMediaContext; text: string; label: string; variantId: string | null; userId: string }): Promise<MediaResult> {
  const { master, userId } = input;
  const text = input.text.trim();
  if (!text) return { ok: false, error: "ไม่มีข้อความให้พากย์ — เขียนสคริปต์ก่อน", code: "no_source" };
  if (text.length > MAX_TTS_CHARS) return { ok: false, error: `ข้อความยาวเกิน ${MAX_TTS_CHARS.toLocaleString("en-GB")} ตัวอักษร — ตัดเป็นช่วงสั้นลง`, code: "failed" };

  let rules: PrivacyRules;
  let prefs;
  try {
    const settings = await getStudioSettingsStrict();
    rules = settings.privacy_rules;
    prefs = settings.media_prefs;
  } catch {
    return { ok: false, error: "โหลดการตั้งค่าสตูดิโอไม่สำเร็จ — ลองใหม่อีกครั้ง", code: "failed" };
  }
  const blocked = blockingFinding(rules, text);
  if (blocked) return { ok: false, error: `สคริปต์ยังมีข้อมูลที่ระบุตัวตนได้ (${blocked}) — แก้ให้ผ่าน Privacy Check ก่อนพากย์`, code: "blocked" };

  let provider;
  try {
    provider = getTtsProvider();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), code: "not_configured" };
  }
  const started = Date.now();
  try {
    const audio = await provider.synthesize({ text, voiceId: prefs.tts_voice_id || undefined, model: prefs.tts_model || undefined });
    const generationId = await recordGeneration({
      purpose: "tts",
      provider: audio.provider,
      model: audio.model,
      input_refs: { master_id: master.id, variant_id: input.variantId, chars: text.length, voice_id: audio.voiceId },
      output: { bytes: audio.bytes.length, duration_ms: audio.durationMs },
      input_tokens: null,
      output_tokens: null,
      duration_ms: audio.durationMsCall,
      status: "ok",
      error: null,
      user_id: userId,
    });
    const asset = await storeAsset({
      masterId: master.id,
      kind: "audio",
      label: input.label,
      bytes: audio.bytes,
      mime: audio.mime,
      ext: "mp3",
      meta: { voice_id: audio.voiceId, chars: text.length },
      width: null,
      height: null,
      durationMs: audio.durationMs,
      // The spoken text is the (privacy-checked) script itself; keep a short head for identification only.
      prompt: text.slice(0, 200),
      provider: audio.provider,
      model: audio.model,
      generationId,
      variantId: input.variantId,
      userId,
    });
    console.info(`[studio:media] tts ok master=${master.id} chars=${text.length} model=${audio.model} bytes=${audio.bytes.length} ${audio.durationMsCall}ms`);
    return { ok: true, asset };
  } catch (err) {
    return await failed("tts", err, { master_id: master.id, variant_id: input.variantId, chars: text.length }, provider.name, prefs.tts_model || "default", Date.now() - started, userId);
  }
}

/** Signed URLs for the editor (10 min). Missing objects yield null rather than throwing. */
export async function signAssetUrls(assets: Pick<CreativeAsset, "id" | "storage_path">[]): Promise<Record<string, string | null>> {
  const paths = assets.map((a) => a.storage_path).filter((p): p is string => !!p);
  if (!paths.length) return {};
  const svc = createServiceClient();
  const { data, error } = await svc.storage.from(BUCKETS.studioMedia).createSignedUrls(paths, SIGNED_URL_TTL_SEC);
  if (error) {
    console.error("[studio:media] sign failed:", error.message);
    return {};
  }
  const byPath = new Map((data ?? []).map((d) => [d.path, d.error ? null : d.signedUrl]));
  return Object.fromEntries(assets.map((a) => [a.id, a.storage_path ? (byPath.get(a.storage_path) ?? null) : null]));
}

export async function removeAssetObject(storagePath: string | null): Promise<void> {
  if (!storagePath) return;
  const svc = createServiceClient();
  const { error } = await svc.storage.from(BUCKETS.studioMedia).remove([storagePath]);
  if (error) console.error("[studio:media] object remove failed:", error.message);
}

// ─── internals ───────────────────────────────────────────────────────────────

function blockingFinding(rules: PrivacyRules, text: string): string | null {
  const findings = scrubText({ fields: { text }, rules });
  const hit = findings.find((f) => f.severity === "high" || f.kind === "denylist");
  return hit ? hit.reason : null;
}

async function storeAsset(a: {
  masterId: string;
  kind: "thumbnail" | "image" | "audio";
  label: string;
  bytes: Uint8Array;
  mime: string;
  ext: string;
  meta: Record<string, unknown>;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  prompt: string;
  provider: string;
  model: string;
  generationId: string | null;
  variantId: string | null;
  userId: string;
}): Promise<CreativeAsset> {
  const svc = createServiceClient();
  const { data: row, error: iErr } = await svc
    .from("studio_creative_assets")
    .insert({
      master_id: a.masterId,
      kind: a.kind,
      status: "pending",
      label: a.label,
      mime: a.mime,
      bytes: a.bytes.length,
      width: a.width,
      height: a.height,
      duration_ms: a.durationMs,
      prompt: a.prompt,
      provider: a.provider,
      model: a.model,
      generation_id: a.generationId,
      variant_id: a.variantId,
      meta: a.meta as never,
      created_by: a.userId,
    })
    .select("*")
    .single();
  if (iErr || !row) throw new Error(`asset row insert failed: ${iErr?.message ?? "no row"}`);

  const path = `${a.masterId}/${row.id}.${a.ext}`;
  const { error: upErr } = await svc.storage.from(BUCKETS.studioMedia).upload(path, a.bytes, { contentType: a.mime, upsert: false });
  if (upErr) {
    await svc.from("studio_creative_assets").update({ status: "failed", error: upErr.message.slice(0, 500) }).eq("id", row.id);
    throw new Error(`upload failed: ${upErr.message}`);
  }
  const { data: ready, error: rErr } = await svc.from("studio_creative_assets").update({ status: "ready", storage_path: path }).eq("id", row.id).select("*").single();
  if (rErr || !ready) throw new Error(`asset finalise failed: ${rErr?.message ?? "no row"}`);
  return ready;
}

async function failed(purpose: "image_generation" | "tts", err: unknown, refs: Record<string, unknown>, provider: string, model: string, durationMs: number, userId: string): Promise<MediaResult> {
  const code: MediaErrorCode = err instanceof MediaNotConfiguredError ? "not_configured" : err instanceof MediaRefusedError ? "refused" : "failed";
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[studio:media] ${purpose} ${code}:`, message);
  if (code === "failed") Sentry.captureException(err, { tags: { module: "studio-media", purpose } });
  await recordGeneration({ purpose, provider, model, input_refs: refs, output: null, input_tokens: null, output_tokens: null, duration_ms: durationMs, status: code === "refused" ? "refused" : "error", error: message.slice(0, 1000), user_id: userId });
  if (code === "refused") return { ok: false, error: "ผู้ให้บริการปฏิเสธคำขอนี้ — ปรับคำบรรยาย/ข้อความให้เป็นกลางขึ้น", code };
  if (code === "not_configured") return { ok: false, error: message, code };
  return { ok: false, error: "สร้างสื่อไม่สำเร็จ — ลองใหม่อีกครั้ง หากยังไม่ได้ให้ดูบันทึก AI ในตั้งค่าสตูดิโอ", code };
}
