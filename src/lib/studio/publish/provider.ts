import "server-only";

import type { SocialPlatform } from "@/lib/studio/types";
import { AyrsharePublishProvider } from "./ayrshare";

/**
 * Publishing provider seam (phase 2). One aggregator (Ayrshare) fronts
 * Facebook / Instagram / TikTok / YouTube so we never hold platform tokens
 * or go through Meta/TikTok app review ourselves. Missing key ⇒ honest
 * "not configured" (UI disables the buttons and says which env var).
 */

export class PublishNotConfiguredError extends Error {
  constructor(message = "ยังไม่ได้ตั้งค่า AYRSHARE_API_KEY — เพิ่มใน Vercel/.env.local เพื่อเปิดการโพสต์อัตโนมัติ") {
    super(message);
    this.name = "PublishNotConfiguredError";
  }
}

export class PublishRejectedError extends Error {
  /** Per-platform messages as returned by the provider (already free of secrets). */
  readonly details: Partial<Record<SocialPlatform, string>>;
  constructor(message: string, details: Partial<Record<SocialPlatform, string>> = {}) {
    super(message);
    this.name = "PublishRejectedError";
    this.details = details;
  }
}

export interface ConnectedAccounts {
  active: SocialPlatform[];
  displayNames: Partial<Record<SocialPlatform, string>>;
  checkedAt: string;
}

export interface UploadedMedia {
  url: string;
}

export interface CreatePostInput {
  /** Caption / description; per platform overrides below win. */
  text: string;
  platforms: SocialPlatform[];
  mediaUrls: string[];
  /** ISO timestamp in the future → provider holds the schedule. Absent = post now. */
  scheduleAt?: string | null;
  isVideo: boolean;
  youtube?: { title: string; visibility: "public" | "private" | "unlisted"; tags?: string[] };
  tiktok?: { privacy?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY" };
  instagram?: { reel?: boolean };
  /** Our own idempotency/reference key (master id). */
  refKey: string;
}

export interface CreatedPost {
  providerPostId: string;
  refId: string | null;
  /** "success" for immediate posts, "scheduled" when held by the provider. */
  status: "success" | "scheduled";
  perPlatform: Partial<Record<SocialPlatform, { status: "success" | "error" | "pending"; id?: string; postUrl?: string; error?: string }>>;
}

export interface PostStatus {
  providerPostId: string;
  status: "success" | "scheduled" | "pending" | "error" | "deleted" | "unknown";
  perPlatform: Partial<Record<SocialPlatform, { status: "success" | "error" | "pending" | "deleted"; id?: string; postUrl?: string; error?: string }>>;
}

export interface PublishProvider {
  readonly name: string;
  connectedPlatforms(): Promise<ConnectedAccounts>;
  uploadMedia(input: { bytes: Uint8Array; mime: string; fileName: string }): Promise<UploadedMedia>;
  createPost(input: CreatePostInput): Promise<CreatedPost>;
  deletePost(providerPostId: string): Promise<void>;
  postStatus(providerPostId: string): Promise<PostStatus>;
}

export interface PublishAvailability {
  available: boolean;
  provider: "ayrshare";
  reason?: string;
}

export function getPublishAvailability(env: NodeJS.ProcessEnv = process.env): PublishAvailability {
  return env.AYRSHARE_API_KEY ? { available: true, provider: "ayrshare" } : { available: false, provider: "ayrshare", reason: new PublishNotConfiguredError().message };
}

export function getPublishProvider(env: NodeJS.ProcessEnv = process.env): PublishProvider {
  const key = env.AYRSHARE_API_KEY;
  if (!key) throw new PublishNotConfiguredError();
  return new AyrsharePublishProvider(key);
}
