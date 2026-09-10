import "server-only";

import * as Sentry from "@sentry/nextjs";
import { BUCKETS } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { STUDIO_SETTINGS_ID } from "@/lib/studio/constants";
import { privacyStatusFromFindings, scrubText } from "@/lib/studio/privacy/scrub";
import { getStudioSettingsStrict } from "@/lib/studio/settings";
import type { CreativeAsset, PrivacyRules, SocialConnections, SocialPlatform, SocialPost } from "@/lib/studio/types";
import { assetMediaKind, buildCaption, buildYoutubeTitle, platformRequirement, type CaptionSource } from "./captions";
import { getPublishProvider, PublishNotConfiguredError, PublishRejectedError, type CreatedPost, type PublishProvider } from "./provider";

/**
 * Publishing core (phase 2). Server actions verify the admin and load the
 * master through RLS first; this module then uses the service client for the
 * bucket download (media upload to the aggregator) and the bookkeeping rows.
 *
 * Privacy: the exact caption sent to each platform is scrubbed with the studio
 * rules right before the network call — a blocked result refuses the whole
 * request. studio_social_posts never stores captions (ids/status/urls only).
 *
 * Platforms whose resolved caption differs are sent as separate aggregator
 * requests, so every platform receives exactly the text previewed.
 */

export type PublishErrorCode = "not_configured" | "blocked" | "requirements" | "rejected" | "failed" | "not_connected" | "duplicate";
export type PublishResult =
  | { ok: true; posts: SocialPost[]; providerPostId: string; scheduled: boolean; failures?: Partial<Record<SocialPlatform, string>> }
  | { ok: false; error: string; code: PublishErrorCode; details?: Partial<Record<SocialPlatform, string>> };

export interface PublishInput {
  master: { id: string; title: string; caption: string | null; cta: string | null; hook: string | null; scheduled_at: string | null };
  variants: { id: string; platform: string; caption: string | null; hook: string | null }[];
  platforms: SocialPlatform[];
  /** Asset ids chosen by the owner (must belong to the master, status ready). */
  assetIds: string[];
  /** ISO in the future to let the aggregator hold the schedule; null = post now. */
  scheduleAt: string | null;
  youtubeVisibility?: "public" | "private" | "unlisted";
  userId: string;
}

export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
/** A schedule closer than this is treated as invalid by the action layer; here we only trust what we are given. */
export const SCHEDULE_MIN_LEAD_MS = 60_000;
const ACTIVE_STATUSES = ["queued", "scheduled", "published"] as const;

/** Only http(s) URLs are ever stored or forwarded — never trust a provider string blindly. */
export function safeHttpUrl(u: string | null | undefined): string | null {
  return u && /^https?:\/\/\S+$/i.test(u) ? u : null;
}

export async function publishMaster(input: PublishInput, deps: { provider?: PublishProvider } = {}): Promise<PublishResult> {
  const { master, platforms, userId } = input;
  if (!platforms.length) return { ok: false, error: "เลือกอย่างน้อย 1 แพลตฟอร์ม", code: "requirements" };

  let rules: PrivacyRules;
  let social: SocialConnections;
  try {
    const settings = await getStudioSettingsStrict();
    rules = settings.privacy_rules;
    social = settings.social_connections;
  } catch {
    return { ok: false, error: "โหลดการตั้งค่าสตูดิโอไม่สำเร็จ — ลองใหม่อีกครั้ง", code: "failed" };
  }

  let provider: PublishProvider;
  try {
    provider = deps.provider ?? getPublishProvider();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), code: "not_configured" };
  }

  // Only platforms the owner has actually linked in the aggregator dashboard.
  const notLinked = platforms.filter((p) => !social.ayrshare.active.includes(p));
  if (notLinked.length) {
    return { ok: false, error: `ยังไม่ได้เชื่อมต่อ ${notLinked.join(", ")} ใน Ayrshare — เชื่อมต่อแล้วกด "รีเฟรชการเชื่อมต่อ" ในตั้งค่า`, code: "not_connected" };
  }

  const svc = createServiceClient();

  // Never send the same master to the same platform twice while a post is live/queued.
  const { data: existing, error: exErr } = await svc.from("studio_social_posts").select("platform, status").eq("master_id", master.id).in("platform", platforms).in("status", [...ACTIVE_STATUSES]);
  if (exErr) return { ok: false, error: "ตรวจสอบโพสต์เดิมไม่สำเร็จ — ลองใหม่อีกครั้ง", code: "failed" };
  if (existing?.length) {
    const details: Partial<Record<SocialPlatform, string>> = {};
    for (const r of existing) details[r.platform as SocialPlatform] = r.status === "published" ? "โพสต์ไปแล้ว — ลบโพสต์เดิมก่อนถ้าต้องการส่งใหม่" : "มีโพสต์รอส่ง/ตั้งเวลาอยู่แล้ว";
    return { ok: false, error: "แพลตฟอร์มที่เลือกมีโพสต์ของคอนเทนต์นี้อยู่แล้ว", code: "duplicate", details };
  }

  // Captions per platform → privacy scan of the exact text that goes public (strict_mode honoured).
  const src: CaptionSource = { master, variants: input.variants };
  const captions = new Map<SocialPlatform, string>();
  for (const p of platforms) {
    const text = buildCaption(p, src);
    const findings = scrubText({ fields: { caption: text }, rules });
    if (privacyStatusFromFindings(findings, rules.strict_mode) === "blocked" || findings.some((f) => f.kind === "denylist")) {
      const why = findings.find((f) => f.severity === "high" || f.kind === "denylist")?.reason ?? findings[0]?.reason ?? "พบข้อมูลที่ต้องตรวจ";
      return { ok: false, error: `แคปชันสำหรับ ${p} ยังมีข้อมูลที่ระบุตัวตนได้ (${why}) — แก้ก่อนโพสต์`, code: "blocked" };
    }
    captions.set(p, text);
  }

  // Media: must be this master's ready assets, within the upload cap.
  const uniqueIds = Array.from(new Set(input.assetIds));
  let assets: CreativeAsset[] = [];
  if (uniqueIds.length) {
    const { data, error } = await svc.from("studio_creative_assets").select("*").eq("master_id", master.id).eq("status", "ready").in("id", uniqueIds);
    if (error) return { ok: false, error: "โหลดสื่อไม่สำเร็จ", code: "failed" };
    assets = uniqueIds.map((id) => (data ?? []).find((a) => a.id === id)).filter((a): a is CreativeAsset => !!a);
    if (assets.length !== uniqueIds.length) return { ok: false, error: "มีสื่อที่เลือกไม่พร้อมใช้หรือไม่ใช่ของคอนเทนต์นี้", code: "requirements" };
  }
  const oversized = assets.find((a) => (a.bytes ?? 0) > MAX_MEDIA_BYTES);
  if (oversized) return { ok: false, error: `สื่อ "${oversized.label ?? oversized.id}" ใหญ่เกิน ${Math.round(MAX_MEDIA_BYTES / 1024 / 1024)} MB`, code: "requirements" };
  const kinds = assets.map(assetMediaKind);
  if (kinds.includes("none")) return { ok: false, error: "เลือกได้เฉพาะรูปหรือวิดีโอ (ไฟล์เสียงใช้ประกอบวิดีโอในเฟส 3)", code: "requirements" };
  const details: Partial<Record<SocialPlatform, string>> = {};
  for (const p of platforms) {
    const why = platformRequirement(p, kinds);
    if (why) details[p] = why;
    else if (p === "facebook" && !kinds.length && !captions.get("facebook")) details[p] = "Facebook ต้องมีข้อความหรือรูปอย่างน้อย 1 อย่าง";
  }
  if (Object.keys(details).length) return { ok: false, error: "สื่อที่เลือกยังไม่ตรงข้อกำหนดของแพลตฟอร์ม", code: "requirements", details };

  const isVideo = kinds.includes("video");
  const scheduleAt = input.scheduleAt && new Date(input.scheduleAt).getTime() > Date.now() + SCHEDULE_MIN_LEAD_MS ? new Date(input.scheduleAt).toISOString() : null;

  try {
    // Upload media to the aggregator (our bucket is private; signed URLs expire before scheduled posts fire).
    const mediaUrls: string[] = [];
    for (const a of assets) mediaUrls.push(await ensureExternalUrl(svc, provider, a));

    // One aggregator request per distinct caption, so each platform receives exactly its previewed text.
    const groups = new Map<string, SocialPlatform[]>();
    for (const p of platforms) (groups.get(captions.get(p)!) ?? groups.set(captions.get(p)!, []).get(captions.get(p)!)!).push(p);

    const now = new Date().toISOString();
    const rows: Omit<SocialPost, "id" | "created_at" | "updated_at">[] = [];
    const failures: Partial<Record<SocialPlatform, string>> = {};
    let firstProviderId = "";
    for (const [text, group] of groups) {
      let created: CreatedPost | null = null;
      let groupError: string | null = null;
      try {
        created = await provider.createPost({
          text,
          platforms: group,
          mediaUrls,
          scheduleAt,
          isVideo,
          refKey: master.id,
          youtube: group.includes("youtube") ? { title: buildYoutubeTitle(src), visibility: input.youtubeVisibility ?? social.defaults.youtube_visibility } : undefined,
          tiktok: group.includes("tiktok") ? { privacy: social.defaults.tiktok_privacy } : undefined,
          instagram: group.includes("instagram") && isVideo ? { reel: true } : undefined,
        });
        if (!firstProviderId) firstProviderId = created.providerPostId;
      } catch (err) {
        groupError = err instanceof PublishRejectedError ? err.message : err instanceof Error ? err.message : String(err);
        const perPlatform = err instanceof PublishRejectedError ? err.details : {};
        for (const p of group) failures[p] = perPlatform[p] ?? groupError;
        if (!(err instanceof PublishRejectedError)) Sentry.captureException(err, { tags: { module: "studio-publish" } });
        console.error(`[studio:publish] group failed master=${master.id} platforms=${group.join(",")}:`, groupError);
      }
      for (const p of group) {
        const r = created?.perPlatform[p];
        const failed = !created || r?.status === "error";
        // TikTok (and sometimes others) answer "success" with id "pending" while the platform still processes
        // the upload — that is queued, not published; the sync cron fills the url once the platform confirms.
        const stillPending = r?.status === "pending" || r?.id === "pending" || (r?.status === "success" && !safeHttpUrl(r.postUrl) && p === "tiktok");
        const published = !!created && !scheduleAt && !stillPending && (r?.status === "success" || (!r && created.status === "success"));
        if (failed && created && r?.error) failures[p] = r.error;
        rows.push({
          master_id: master.id,
          variant_id: variantIdFor(p, text, src, input.variants),
          platform: p,
          provider: provider.name,
          provider_post_id: created?.providerPostId || null,
          provider_ref: { refId: created?.refId ?? null, platform_id: r?.id ?? null } as never,
          status: failed ? "failed" : published ? "published" : scheduleAt ? "scheduled" : "queued",
          scheduled_at: scheduleAt,
          published_at: published ? now : null,
          post_url: safeHttpUrl(r?.postUrl),
          error: failed ? (failures[p] ?? "provider error").slice(0, 500) : null,
          caption_chars: text.length,
          media_asset_ids: assets.map((a) => a.id),
          created_by: userId,
        });
      }
    }

    const succeeded = rows.filter((r) => r.status !== "failed");
    if (!succeeded.length) {
      return { ok: false, error: "แพลตฟอร์มปฏิเสธโพสต์ — ดูรายละเอียดต่อแพลตฟอร์ม", code: "rejected", details: failures };
    }
    const { data: inserted, error: iErr } = await svc.from("studio_social_posts").insert(rows as never).select("*");
    if (iErr) {
      console.error("[studio:publish] rows insert failed after provider accepted:", iErr.message);
      Sentry.captureException(iErr, { tags: { module: "studio-publish" } });
      return { ok: false, error: `โพสต์ถูกส่งแล้ว (id ${firstProviderId}) แต่บันทึกสถานะไม่สำเร็จ — ตรวจใน Ayrshare dashboard`, code: "failed" };
    }
    await flipMasterIfDone(svc, master.id);
    console.info(`[studio:publish] master=${master.id} platforms=${platforms.join(",")} requests=${groups.size} provider_post=${firstProviderId} scheduled=${!!scheduleAt} failed=${Object.keys(failures).length}`);
    return { ok: true, posts: inserted ?? [], providerPostId: firstProviderId, scheduled: !!scheduleAt, ...(Object.keys(failures).length ? { failures } : {}) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[studio:publish] failed:", message);
    if (err instanceof PublishNotConfiguredError) return { ok: false, error: message, code: "not_configured" };
    Sentry.captureException(err, { tags: { module: "studio-publish" } });
    return { ok: false, error: "โพสต์ไม่สำเร็จ — ลองใหม่อีกครั้ง หากยังไม่ได้ให้ตรวจการเชื่อมต่อใน Ayrshare", code: "failed" };
  }
}

/** Refresh which platforms are linked at the aggregator and persist the snapshot in settings. */
export async function refreshConnections(deps: { provider?: PublishProvider } = {}): Promise<{ ok: true; active: SocialPlatform[] } | { ok: false; error: string; code: "not_configured" | "failed" }> {
  let provider: PublishProvider;
  try {
    provider = deps.provider ?? getPublishProvider();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), code: "not_configured" };
  }
  try {
    const acc = await provider.connectedPlatforms();
    const svc = createServiceClient();
    const current = (await getStudioSettingsStrict()).social_connections;
    const next: SocialConnections = { ...current, ayrshare: { checked_at: acc.checkedAt, active: acc.active, display_names: acc.displayNames } };
    const { error } = await svc.from("studio_settings").update({ social_connections: next as never }).eq("id", STUDIO_SETTINGS_ID);
    if (error) return { ok: false, error: "บันทึกสถานะการเชื่อมต่อไม่สำเร็จ", code: "failed" };
    console.info(`[studio:publish] connections refreshed active=${acc.active.join(",") || "none"}`);
    return { ok: true, active: acc.active };
  } catch (err) {
    console.error("[studio:publish] connections refresh failed:", err instanceof Error ? err.message : err);
    return { ok: false, error: "ติดต่อ Ayrshare ไม่สำเร็จ — ตรวจ API key", code: "failed" };
  }
}

/**
 * Delete at the aggregator (best effort) and mark our rows deleted. One
 * aggregator id covers every platform of that request, so all its rows flip.
 */
export async function deleteProviderPost(providerPostId: string, deps: { provider?: PublishProvider } = {}): Promise<{ ok: true } | { ok: false; error: string }> {
  let provider: PublishProvider;
  try {
    provider = deps.provider ?? getPublishProvider();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    await provider.deletePost(providerPostId);
  } catch (err) {
    console.error("[studio:publish] provider delete failed:", err instanceof Error ? err.message : err);
    return { ok: false, error: "ลบโพสต์ที่ Ayrshare ไม่สำเร็จ — ลองใหม่ หรือลบใน dashboard" };
  }
  const svc = createServiceClient();
  const { error } = await svc.from("studio_social_posts").update({ status: "deleted" }).eq("provider_post_id", providerPostId);
  if (error) return { ok: false, error: "อัปเดตสถานะไม่สำเร็จ" };
  return { ok: true };
}

export interface SyncResult {
  checked: number;
  published: number;
  failed: number;
  errors: string[];
}

/** Cron: reconcile queued/scheduled rows with the aggregator. */
export async function syncSocialPosts(deps: { provider?: PublishProvider; limit?: number } = {}): Promise<SyncResult> {
  const res: SyncResult = { checked: 0, published: 0, failed: 0, errors: [] };
  let provider: PublishProvider;
  try {
    provider = deps.provider ?? getPublishProvider();
  } catch (e) {
    res.errors.push(e instanceof Error ? e.message : String(e));
    return res;
  }
  const svc = createServiceClient();
  const { data: pending, error } = await svc
    .from("studio_social_posts")
    .select("id, master_id, platform, provider_post_id, status")
    .in("status", ["queued", "scheduled"])
    .not("provider_post_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(deps.limit ?? 100);
  if (error) {
    res.errors.push(`load: ${error.message}`);
    return res;
  }
  const byPost = new Map<string, typeof pending>();
  for (const row of pending ?? []) (byPost.get(row.provider_post_id!) ?? byPost.set(row.provider_post_id!, []).get(row.provider_post_id!)!).push(row);

  const touchedMasters = new Set<string>();
  for (const [providerPostId, rows] of byPost) {
    res.checked += rows.length;
    let status;
    try {
      status = await provider.postStatus(providerPostId);
    } catch (err) {
      res.errors.push(`${providerPostId}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    for (const row of rows) {
      const p = row.platform as SocialPlatform;
      const per = status.perPlatform[p];
      const overall = status.status;
      let patch: Partial<SocialPost> | null = null;
      const perPending = per?.id === "pending" || (per?.status === "success" && p === "tiktok" && !safeHttpUrl(per.postUrl));
      if (!perPending && (per?.status === "success" || (!per && overall === "success"))) {
        patch = { status: "published", published_at: new Date().toISOString(), post_url: safeHttpUrl(per?.postUrl), error: null };
        res.published += 1;
      } else if (per?.status === "error" || overall === "error") {
        patch = { status: "failed", error: (per?.error ?? "provider reported an error").slice(0, 500) };
        res.failed += 1;
      } else if (overall === "deleted" || per?.status === "deleted") {
        patch = { status: "deleted" };
      }
      if (patch) {
        const { error: uErr } = await svc.from("studio_social_posts").update(patch).eq("id", row.id);
        if (uErr) res.errors.push(`${row.id}: ${uErr.message}`);
        else touchedMasters.add(row.master_id);
      }
    }
  }
  for (const masterId of touchedMasters) await flipMasterIfDone(svc, masterId);
  console.info(`[studio:publish] sync checked=${res.checked} published=${res.published} failed=${res.failed} errors=${res.errors.length}`);
  return res;
}

// ─── internals ───────────────────────────────────────────────────────────────

type Svc = ReturnType<typeof createServiceClient>;

function variantIdFor(platform: SocialPlatform, text: string, src: CaptionSource, variants: PublishInput["variants"]): string | null {
  const v = variants.find((x) => x.caption?.trim() && buildCaption(platform, { master: src.master, variants: [x] }) === text && text !== buildCaption(platform, { master: src.master, variants: [] }));
  return v?.id ?? null;
}

async function ensureExternalUrl(svc: Svc, provider: PublishProvider, asset: CreativeAsset): Promise<string> {
  const cached = safeHttpUrl(asset.external_url);
  if (cached) return cached;
  if (!asset.storage_path) throw new Error(`asset ${asset.id} has no object`);
  const { data, error } = await svc.storage.from(BUCKETS.studioMedia).download(asset.storage_path);
  if (error || !data) throw new Error(`download failed for ${asset.id}: ${error?.message ?? "no data"}`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength > MAX_MEDIA_BYTES) throw new Error(`asset ${asset.id} exceeds ${MAX_MEDIA_BYTES} bytes`);
  const ext = asset.storage_path.split(".").pop() ?? "bin";
  const up = await provider.uploadMedia({ bytes, mime: asset.mime ?? "application/octet-stream", fileName: `${asset.id}.${ext}` });
  const url = safeHttpUrl(up.url);
  if (!url) throw new Error(`provider returned a non-http media url for ${asset.id}`);
  const { error: uErr } = await svc.from("studio_creative_assets").update({ external_url: url, meta: { ...((asset.meta as Record<string, unknown>) ?? {}), provider_uploaded_at: new Date().toISOString() } as never }).eq("id", asset.id);
  if (uErr) console.error("[studio:publish] external_url cache failed:", uErr.message);
  return url;
}

/** Master → published once every non-deleted, non-failed social row for it is published (immediate or via sync). */
async function flipMasterIfDone(svc: Svc, masterId: string): Promise<void> {
  const { data: rows, error } = await svc.from("studio_social_posts").select("status, post_url, published_at").eq("master_id", masterId).neq("status", "deleted");
  if (error || !rows?.length) return;
  if (!rows.every((r) => r.status === "published")) return;
  const first = rows.map((r) => safeHttpUrl(r.post_url)).find((u) => u) ?? null;
  const at = rows.map((r) => r.published_at).filter((x): x is string => !!x).sort()[0] ?? new Date().toISOString();
  const { error: mErr } = await svc
    .from("studio_content_masters")
    .update({ status: "published", published_at: at, published_url: first })
    .eq("id", masterId)
    .in("status", ["approved", "scheduled"]);
  if (mErr) console.error("[studio:publish] master flip failed:", mErr.message);
}
