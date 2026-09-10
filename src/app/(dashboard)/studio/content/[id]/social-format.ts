import { assetMediaKind, platformRequirement, type MediaKind } from "@/lib/studio/publish/captions";
import type { ContentStatus, CreativeAsset, SocialPlatform, SocialPost, SocialPostStatus, TiktokPrivacy, YoutubeVisibility } from "@/lib/studio/types";

/**
 * Pure UI helpers for the social publishing section (phase 2). No I/O, no
 * React — unit-tested in social-format.test.ts. Every gate here is UX
 * feedback only: publish-actions.ts re-checks status, connections, media
 * requirements and the privacy scrub on the server.
 */

export const SOCIAL_POST_STATUSES: SocialPostStatus[] = ["queued", "scheduled", "published", "failed", "deleted"];
export type { SocialPostStatus };

export interface SocialStatusMeta {
  label: string;
  className: string;
  dot: string;
}

export const SOCIAL_STATUS_META: Record<SocialPostStatus, SocialStatusMeta> = {
  queued: { label: "รอส่ง", className: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400", dot: "bg-sky-500" },
  scheduled: { label: "ตั้งเวลา", className: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400", dot: "bg-violet-500" },
  published: { label: "โพสต์แล้ว", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  failed: { label: "ล้มเหลว", className: "border-destructive/30 bg-destructive/10 text-destructive", dot: "bg-destructive" },
  deleted: { label: "ลบแล้ว", className: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
};

/** DB column is `text`; anything unexpected renders as "รอส่ง" rather than crashing the badge. */
export function normaliseSocialStatus(status: string): SocialPostStatus {
  return (SOCIAL_POST_STATUSES as readonly string[]).includes(status) ? (status as SocialPostStatus) : "queued";
}

/** Newest first — the DB order is not guaranteed once the cron updates rows. */
export function sortPostsNewest<T extends Pick<SocialPost, "created_at">>(posts: T[]): T[] {
  return [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/** Only ready images/videos can be attached; audio waits for video assembly (phase 3). */
export function selectableAssets<T extends Pick<CreativeAsset, "kind" | "mime" | "status">>(assets: T[]): T[] {
  return assets.filter((a) => a.status === "ready" && assetMediaKind(a) !== "none");
}

export function nonSelectableReadyAssets<T extends Pick<CreativeAsset, "kind" | "mime" | "status">>(assets: T[]): T[] {
  return assets.filter((a) => a.status === "ready" && assetMediaKind(a) === "none");
}

export function selectedMediaKinds<T extends Pick<CreativeAsset, "id" | "kind" | "mime">>(assets: T[], selectedIds: string[]): MediaKind[] {
  const byId = new Map(assets.map((a) => [a.id, a] as const));
  return selectedIds.map((id) => byId.get(id)).filter((a): a is T => !!a).map(assetMediaKind);
}

export const NOT_CONNECTED_REASON = "ยังไม่เชื่อมต่อใน Ayrshare";

/** Why a platform checkbox is disabled for the current selection — null when it can be posted to. */
export function platformDisabledReason(platform: SocialPlatform, active: SocialPlatform[], kinds: MediaKind[]): string | null {
  if (!active.includes(platform)) return NOT_CONNECTED_REASON;
  return platformRequirement(platform, kinds);
}

export const PUBLISHABLE_STATUSES: ContentStatus[] = ["approved", "scheduled"];
export const STATUS_GATE_REASON = "อนุมัติคอนเทนต์ก่อนโพสต์";
export const PUBLISHED_GATE_REASON = "คอนเทนต์เผยแพร่แล้ว — โพสต์ซ้ำได้เมื่อนำกลับมาเป็นร่างและอนุมัติใหม่";
export const NO_ACCOUNTS_REASON = "เชื่อมต่อบัญชีใน Ayrshare แล้วกดรีเฟรชใน Settings";

export interface PublishGateInput {
  available: boolean;
  availabilityReason?: string;
  status: ContentStatus | string;
  activeCount: number;
}

/** Why the "โพสต์ไปโซเชียล" button is disabled — null when the dialog may open. Order mirrors the server gates. */
export function publishBlockedReason({ available, availabilityReason, status, activeCount }: PublishGateInput): string | null {
  if (!available) return availabilityReason ?? "ยังไม่ได้ตั้งค่า provider สำหรับโพสต์";
  if (status === "published") return PUBLISHED_GATE_REASON;
  if (!PUBLISHABLE_STATUSES.includes(status as ContentStatus)) return STATUS_GATE_REASON;
  if (activeCount === 0) return NO_ACCOUNTS_REASON;
  return null;
}

export const YOUTUBE_VISIBILITIES: YoutubeVisibility[] = ["public", "unlisted", "private"];
export const YOUTUBE_VISIBILITY_LABEL: Record<YoutubeVisibility, string> = {
  public: "Public — ทุกคนเห็น",
  unlisted: "Unlisted — เฉพาะคนที่มีลิงก์",
  private: "Private — เฉพาะเจ้าของช่อง",
};

export const TIKTOK_PRIVACIES: TiktokPrivacy[] = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"];
export const TIKTOK_PRIVACY_LABEL: Record<TiktokPrivacy, string> = {
  PUBLIC_TO_EVERYONE: "Public — ทุกคนเห็น",
  MUTUAL_FOLLOW_FRIENDS: "Friends — เฉพาะเพื่อนที่ติดตามกัน",
  SELF_ONLY: "Only me — เฉพาะตัวเอง",
};

/** "1,234/2,200" with en-GB grouping (app convention). */
export function formatCharBudget(chars: number, limit: number): string {
  return `${chars.toLocaleString("en-GB")}/${limit.toLocaleString("en-GB")}`;
}
