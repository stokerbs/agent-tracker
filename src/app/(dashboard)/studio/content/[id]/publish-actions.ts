"use server";

import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getStudioAdmin } from "@/lib/studio/auth";
import { buildCaption, buildYoutubeTitle, PLATFORM_LIMITS } from "@/lib/studio/publish/captions";
import { deleteProviderPost, publishMaster, SCHEDULE_MIN_LEAD_MS, type PublishErrorCode } from "@/lib/studio/publish/publish";
import { SOCIAL_PLATFORMS, type SocialPlatform, type SocialPost } from "@/lib/studio/types";
import { revalidateContentPaths, runAndStorePrivacyCheck } from "./privacy-check";

/**
 * Publishing (phase 2) server actions: post an approved/scheduled master to
 * social platforms through the aggregator, preview the per-platform captions,
 * delete a sent post. Admin-only; master/variants/rows come through RLS.
 */

const UNAUTHORIZED = "ไม่มีสิทธิ์ดำเนินการ";
const idSchema = z.string().uuid();
const platformSchema = z.enum(SOCIAL_PLATFORMS as [SocialPlatform, ...SocialPlatform[]]);

export type PublishActionResult =
  | { ok: true; posts: SocialPost[]; scheduled: boolean }
  | { ok: false; error: string; code: PublishErrorCode | "unauthorized" | "invalid" | "not_found" | "status" | "rate_limited"; details?: Partial<Record<SocialPlatform, string>> };

const publishSchema = z.object({
  masterId: idSchema,
  platforms: z.array(platformSchema).min(1, "เลือกอย่างน้อย 1 แพลตฟอร์ม").max(4),
  assetIds: z.array(idSchema).max(35).default([]),
  /** "now" posts immediately; otherwise uses the master's scheduled_at. */
  when: z.enum(["now", "scheduled"]).default("now"),
  youtubeVisibility: z.enum(["public", "private", "unlisted"]).optional(),
});

export async function publishToSocial(input: unknown): Promise<PublishActionResult> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED, code: "unauthorized" };
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", code: "invalid" };
  const d = parsed.data;
  const rl = await checkRateLimit("studio_publish", profile.id);
  if (!rl.allowed) return { ok: false, error: `ส่งโพสต์ครบโควตาแล้ว — รออีก ${Math.ceil(rl.retryAfterMs / 60_000).toLocaleString("en-GB")} นาที`, code: "rate_limited" };

  const rls = await createClient();
  const { data: master, error } = await rls.from("studio_content_masters").select("id, title, status, caption, cta, hook, scheduled_at").eq("id", d.masterId).maybeSingle();
  if (error) return { ok: false, error: "โหลดคอนเทนต์ไม่สำเร็จ", code: "failed" };
  if (!master) return { ok: false, error: "ไม่พบคอนเทนต์", code: "not_found" };
  if (master.status !== "approved" && master.status !== "scheduled") {
    return { ok: false, error: "โพสต์ได้เฉพาะคอนเทนต์ที่อนุมัติหรือตั้งเวลาแล้ว", code: "status" };
  }
  if (d.when === "scheduled" && !master.scheduled_at) return { ok: false, error: "ยังไม่ได้ตั้งเวลาโพสต์ — ตั้งเวลาก่อน หรือเลือกโพสต์ทันที", code: "invalid" };
  if (d.when === "scheduled" && new Date(master.scheduled_at!).getTime() <= Date.now() + SCHEDULE_MIN_LEAD_MS) {
    return { ok: false, error: "เวลาที่ตั้งไว้ผ่านไปแล้ว — ตั้งเวลาใหม่ หรือเลือกโพสต์ทันที", code: "invalid" };
  }

  // Same defence-in-depth as manual publish: the stored copy must still pass the deterministic scrub.
  const fresh = await runAndStorePrivacyCheck(rls, master.id, { useAi: false, userId: profile.id });
  if (!fresh.ok) return { ok: false, error: fresh.error, code: "blocked" };
  if (fresh.check.status === "blocked") return { ok: false, error: "Privacy Check พบข้อมูลที่ระบุตัวตนได้ — แก้ก่อนโพสต์", code: "blocked" };

  const { data: variants, error: vErr } = await rls.from("studio_content_variants").select("id, platform, caption, hook").eq("master_id", master.id);
  if (vErr) return { ok: false, error: "โหลด variant ไม่สำเร็จ", code: "failed" };

  const res = await publishMaster({
    master: { id: master.id, title: master.title, caption: master.caption, cta: master.cta, hook: master.hook, scheduled_at: master.scheduled_at },
    variants: variants ?? [],
    platforms: d.platforms,
    assetIds: d.assetIds,
    scheduleAt: d.when === "scheduled" ? master.scheduled_at : null,
    youtubeVisibility: d.youtubeVisibility,
    userId: profile.id,
  });
  if (!res.ok) return res;

  await logAudit({
    actorId: profile.id,
    action: "STUDIO_SOCIAL_POST",
    entity: "studio_content_masters",
    entityId: master.id,
    metadata: { platforms: d.platforms, provider_post_id: res.providerPostId, scheduled: res.scheduled, assets: d.assetIds.length },
  });
  revalidateContentPaths(master.id);
  return { ok: true, posts: res.posts, scheduled: res.scheduled };
}

export interface CaptionPreview {
  platform: SocialPlatform;
  text: string;
  chars: number;
  limit: number;
  fromVariant: boolean;
  youtubeTitle?: string;
}

/** What each platform would receive right now (read-only; for the dialog). */
export async function previewCaptions(input: unknown): Promise<{ ok: true; previews: CaptionPreview[] } | { ok: false; error: string }> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = z.object({ masterId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const rls = await createClient();
  const [{ data: master, error }, { data: variants }] = await Promise.all([
    rls.from("studio_content_masters").select("id, title, caption, cta, hook").eq("id", parsed.data.masterId).maybeSingle(),
    rls.from("studio_content_variants").select("id, platform, caption, hook").eq("master_id", parsed.data.masterId),
  ]);
  if (error || !master) return { ok: false, error: "ไม่พบคอนเทนต์" };
  const src = { master, variants: variants ?? [] };
  const previews = SOCIAL_PLATFORMS.map((p) => {
    const text = buildCaption(p, src);
    const fromVariant = !!(variants ?? []).find((v) => v.caption?.trim() && buildCaption(p, { master, variants: [v] }) === text && text !== buildCaption(p, { master, variants: [] }));
    return { platform: p, text, chars: text.length, limit: PLATFORM_LIMITS[p].caption, fromVariant, ...(p === "youtube" ? { youtubeTitle: buildYoutubeTitle(src) } : {}) };
  });
  return { ok: true, previews };
}

export async function removeSocialPost(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getStudioAdmin();
  if (!profile) return { ok: false, error: UNAUTHORIZED };
  const parsed = z.object({ postId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const rls = await createClient();
  const { data: row, error } = await rls.from("studio_social_posts").select("id, master_id, provider_post_id, status").eq("id", parsed.data.postId).maybeSingle();
  if (error) return { ok: false, error: "โหลดโพสต์ไม่สำเร็จ" };
  if (!row) return { ok: false, error: "ไม่พบโพสต์" };
  if (row.status === "deleted") return { ok: true };
  if (!row.provider_post_id) {
    const { error: uErr } = await rls.from("studio_social_posts").update({ status: "deleted" }).eq("id", row.id);
    if (uErr) return { ok: false, error: "อัปเดตสถานะไม่สำเร็จ" };
  } else {
    const res = await deleteProviderPost(row.provider_post_id);
    if (!res.ok) return res;
  }
  await logAudit({ actorId: profile.id, action: "STUDIO_SOCIAL_DELETE", entity: "studio_social_posts", entityId: row.id, metadata: { master_id: row.master_id, provider_post_id: row.provider_post_id } });
  revalidateContentPaths(row.master_id);
  return { ok: true };
}
