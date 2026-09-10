import type { CreativeAsset, SocialPlatform } from "@/lib/studio/types";

/**
 * Pure helpers for the publishing step: per-platform caption assembly with
 * platform limits, and the media requirements each platform enforces.
 * No I/O — fully unit-tested.
 */

export const PLATFORM_LIMITS: Record<SocialPlatform, { caption: number; title?: number }> = {
  facebook: { caption: 63_206 },
  instagram: { caption: 2_200 },
  tiktok: { caption: 2_200 },
  youtube: { caption: 5_000, title: 100 },
  line_oa: { caption: 5_000 },
};

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: "Facebook Page",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  line_oa: "LINE OA",
};

/** Content-variant platform keys that map onto a social platform. */
export const VARIANT_PLATFORM_FOR: Record<SocialPlatform, string[]> = {
  facebook: ["facebook"],
  instagram: ["instagram_reel", "instagram_post", "instagram_carousel"],
  tiktok: ["tiktok"],
  youtube: ["youtube_short"],
  line_oa: ["line_oa"],
};

export interface CaptionSource {
  master: { title: string; caption: string | null; cta: string | null; hook: string | null };
  variants: { platform: string; caption: string | null; hook: string | null }[];
}

/** Platform caption = the matching variant's caption, else master caption + CTA. Trimmed to the platform limit on a word/line boundary. */
export function buildCaption(platform: SocialPlatform, src: CaptionSource): string {
  const variant = src.variants.find((v) => VARIANT_PLATFORM_FOR[platform].includes(v.platform) && v.caption?.trim());
  const base = variant?.caption?.trim() || [src.master.caption?.trim(), src.master.cta?.trim()].filter(Boolean).join("\n\n");
  return truncateAtBoundary(base, PLATFORM_LIMITS[platform].caption);
}

/** YouTube title = hook (short, no hashtags) or master title, ≤ 100 chars. */
export function buildYoutubeTitle(src: CaptionSource): string {
  const hook = src.master.hook?.replace(/#\S+/g, "").replace(/\s+/g, " ").trim();
  const title = hook && hook.length >= 8 ? hook : src.master.title.trim();
  return truncateAtBoundary(title, PLATFORM_LIMITS.youtube.title ?? 100);
}

export function truncateAtBoundary(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

export type MediaKind = "image" | "video" | "none";

export function assetMediaKind(a: Pick<CreativeAsset, "kind" | "mime">): MediaKind {
  if (a.kind === "video" || a.mime?.startsWith("video/")) return "video";
  if (a.kind === "image" || a.kind === "thumbnail" || a.kind === "broll" || a.mime?.startsWith("image/")) return "image";
  return "none";
}

/**
 * What each platform accepts today. Returns a Thai reason when the selection
 * cannot be posted there; null when it can.
 */
export function platformRequirement(platform: SocialPlatform, media: MediaKind[]): string | null {
  const images = media.filter((m) => m === "image").length;
  const videos = media.filter((m) => m === "video").length;
  if (videos > 1) return "โพสต์ได้ครั้งละ 1 วิดีโอ";
  if (videos === 1 && images > 0) return "เลือกวิดีโอหรือรูปอย่างใดอย่างหนึ่ง";
  switch (platform) {
    case "facebook":
      return images > 10 ? "Facebook รับรูปได้สูงสุด 10 รูปต่อโพสต์" : null;
    case "instagram":
      if (!images && !videos) return "Instagram ต้องมีรูปหรือวิดีโออย่างน้อย 1 ชิ้น";
      return images > 10 ? "Instagram รับรูปได้สูงสุด 10 รูป (carousel)" : null;
    case "tiktok":
      if (!images && !videos) return "TikTok ต้องมีวิดีโอ หรือรูป 1–35 รูป";
      return images > 35 ? "TikTok รับรูปได้สูงสุด 35 รูป" : null;
    case "youtube":
      return videos === 1 ? null : "YouTube ต้องมีวิดีโอ 1 ชิ้น (สร้างได้ในเฟส 3)";
    case "line_oa":
      return null;
  }
}
