"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { getStudioAdmin } from "@/lib/studio/auth";
import { generateImageAsset, generateVoiceoverAsset, removeAssetObject, type MediaErrorCode } from "@/lib/studio/media/generate";
import { MAX_CUSTOM_PROMPT_CHARS } from "@/lib/studio/media/prompts";
import { MAX_TTS_CHARS } from "@/lib/studio/media/elevenlabs-tts";
import { IMAGE_ASPECTS, type CreativeAsset, type CreativePlan, type ImageAspect } from "@/lib/studio/types";

/**
 * Media (phase 1) server actions for the Content Editor: generate an image,
 * generate a voice-over, delete an asset. Admin-only; the master is loaded
 * through the RLS client first so a non-admin can never reach the service
 * client paths inside lib/studio/media.
 */

const UNAUTHORIZED = "ไม่มีสิทธิ์ดำเนินการ";
const idSchema = z.string().uuid();

export type MediaActionResult = { ok: true; asset: CreativeAsset } | { ok: false; error: string; code: MediaErrorCode | "unauthorized" | "invalid" | "not_found" };

const imageSchema = z.object({
  masterId: idSchema,
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("thumbnail") }),
    z.object({ kind: z.literal("scene"), index: z.number().int().min(0).max(60) }),
    z.object({ kind: z.literal("custom"), text: z.string().trim().min(3, "พิมพ์คำบรรยายภาพอย่างน้อย 3 ตัวอักษร").max(MAX_CUSTOM_PROMPT_CHARS) }),
  ]),
  aspect: z.enum(IMAGE_ASPECTS as [ImageAspect, ...ImageAspect[]]),
});

export async function generateImage(input: unknown): Promise<MediaActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED, code: "unauthorized" };
  const parsed = imageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", code: "invalid" };
  const master = await loadMaster(parsed.data.masterId);
  if (!master) return { ok: false, error: "ไม่พบคอนเทนต์", code: "not_found" };

  const res = await generateImageAsset({ master, target: parsed.data.target, aspect: parsed.data.aspect, userId: profile.id });
  if (res.ok) {
    await logAudit({ actorId: profile.id, action: "STUDIO_MEDIA_GENERATE", entity: "studio_creative_assets", entityId: res.asset.id, metadata: { master_id: master.id, kind: res.asset.kind, target: parsed.data.target.kind, model: res.asset.model } });
    revalidatePath(`/studio/content/${master.id}`);
  }
  return res;
}

const voiceSchema = z.object({
  masterId: idSchema,
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("script") }),
    z.object({ kind: z.literal("hook") }),
    z.object({ kind: z.literal("variant"), variantId: idSchema }),
  ]),
});

export async function generateVoiceover(input: unknown): Promise<MediaActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED, code: "unauthorized" };
  const parsed = voiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", code: "invalid" };
  const master = await loadMaster(parsed.data.masterId);
  if (!master) return { ok: false, error: "ไม่พบคอนเทนต์", code: "not_found" };

  // Voice text is read server-side from the saved copy (the editor flushes autosave first) — never trusted from the client.
  let text = "";
  let label = "";
  let variantId: string | null = null;
  const src = parsed.data.source;
  if (src.kind === "script") {
    text = master.script ?? "";
    label = "พากย์สคริปต์หลัก";
  } else if (src.kind === "hook") {
    text = master.hook ?? "";
    label = "พากย์ hook";
  } else {
    const supabase = await createClient();
    const { data: v, error } = await supabase.from("studio_content_variants").select("id, platform, script, hook").eq("id", src.variantId).eq("master_id", master.id).maybeSingle();
    if (error) return { ok: false, error: "โหลด variant ไม่สำเร็จ", code: "failed" };
    if (!v) return { ok: false, error: "ไม่พบ variant", code: "not_found" };
    text = v.script ?? v.hook ?? "";
    label = `พากย์ variant ${v.platform}`;
    variantId = v.id;
  }
  if (text.trim().length > MAX_TTS_CHARS) return { ok: false, error: `ข้อความยาวเกิน ${MAX_TTS_CHARS.toLocaleString("en-GB")} ตัวอักษร — ตัดเป็นช่วงสั้นลง`, code: "invalid" };

  const res = await generateVoiceoverAsset({ master, text, label, variantId, userId: profile.id });
  if (res.ok) {
    await logAudit({ actorId: profile.id, action: "STUDIO_MEDIA_GENERATE", entity: "studio_creative_assets", entityId: res.asset.id, metadata: { master_id: master.id, kind: "audio", source: src.kind, model: res.asset.model } });
    revalidatePath(`/studio/content/${master.id}`);
  }
  return res;
}

export async function deleteMediaAsset(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = z.object({ assetId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const supabase = await createClient();
  const { data: asset, error } = await supabase.from("studio_creative_assets").select("id, master_id, storage_path").eq("id", parsed.data.assetId).maybeSingle();
  if (error) return { ok: false, error: "โหลดสื่อไม่สำเร็จ" };
  if (!asset) return { ok: false, error: "ไม่พบสื่อรายการนี้" };
  const { error: dErr } = await supabase.from("studio_creative_assets").delete().eq("id", asset.id);
  if (dErr) {
    console.error("[studio:media] asset delete failed:", dErr.message);
    return { ok: false, error: "ลบสื่อไม่สำเร็จ" };
  }
  await removeAssetObject(asset.storage_path);
  await logAudit({ actorId: profile.id, action: "STUDIO_MEDIA_DELETE", entity: "studio_creative_assets", entityId: asset.id, metadata: { master_id: asset.master_id } });
  revalidatePath(`/studio/content/${asset.master_id}`);
  return { ok: true };
}

async function loadMaster(id: string): Promise<{ id: string; title: string; script: string | null; hook: string | null; creative_plan: CreativePlan | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("studio_content_masters").select("id, title, script, hook, creative_plan, status").eq("id", id).maybeSingle();
  if (error) {
    console.error("[studio:media] master load failed:", error.message);
    return null;
  }
  if (!data) return null;
  return { id: data.id, title: data.title, script: data.script, hook: data.hook, creative_plan: (data.creative_plan as CreativePlan | null) ?? null };
}
