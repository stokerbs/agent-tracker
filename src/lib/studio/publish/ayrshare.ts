import "server-only";

import type { SocialPlatform } from "@/lib/studio/types";
import { PublishRejectedError, type ConnectedAccounts, type CreatedPost, type CreatePostInput, type PostStatus, type PublishProvider, type UploadedMedia } from "./provider";

/**
 * Ayrshare REST client (https://www.ayrshare.com/docs). Shapes follow the
 * public docs; parsing is tolerant because the per-platform result arrays
 * vary slightly between platforms. The key only ever travels in the
 * Authorization header — never in URLs or error strings.
 */

const BASE = "https://api.ayrshare.com/api";
const DEFAULT_TIMEOUT_MS = 60_000;
const UPLOAD_TIMEOUT_MS = 180_000;

/** Ayrshare platform keys ↔ ours (identical today; kept explicit for safety). */
const TO_AYR: Record<SocialPlatform, string> = { facebook: "facebook", instagram: "instagram", tiktok: "tiktok", youtube: "youtube", line_oa: "line" };
const FROM_AYR: Record<string, SocialPlatform> = Object.fromEntries(Object.entries(TO_AYR).map(([k, v]) => [v, k as SocialPlatform]));

interface AyrPostResponse {
  status?: string; // "success" | "scheduled" | "error"
  id?: string;
  refId?: string;
  postIds?: { status?: string; id?: string; platform?: string; postUrl?: string; message?: string }[];
  errors?: { platform?: string; message?: string; code?: number }[];
  message?: string;
  code?: number;
}

export class AyrsharePublishProvider implements PublishProvider {
  readonly name = "ayrshare";
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async connectedPlatforms(): Promise<ConnectedAccounts> {
    const json = await this.call<{ activeSocialAccounts?: string[]; displayNames?: { platform?: string; displayName?: string; username?: string }[] }>("GET", "/user");
    const active = (json.activeSocialAccounts ?? []).map((p) => FROM_AYR[p]).filter((p): p is SocialPlatform => !!p);
    const displayNames: Partial<Record<SocialPlatform, string>> = {};
    for (const d of json.displayNames ?? []) {
      const p = d.platform ? FROM_AYR[d.platform] : undefined;
      if (p) displayNames[p] = d.displayName ?? d.username ?? "";
    }
    return { active, displayNames, checkedAt: new Date().toISOString() };
  }

  async uploadMedia(input: { bytes: Uint8Array; mime: string; fileName: string }): Promise<UploadedMedia> {
    const b64 = Buffer.from(input.bytes).toString("base64");
    const json = await this.call<{ accessUrl?: string; url?: string; status?: string; message?: string }>(
      "POST",
      "/media/upload",
      { file: `data:${input.mime};base64,${b64}`, fileName: input.fileName, description: "Detective Pulse Creative Studio" },
      UPLOAD_TIMEOUT_MS,
    );
    const url = json.accessUrl ?? json.url;
    if (!url) throw new Error(`Ayrshare upload returned no url${json.message ? `: ${json.message}` : ""}`);
    return { url };
  }

  async createPost(input: CreatePostInput): Promise<CreatedPost> {
    const body: Record<string, unknown> = {
      post: input.text,
      platforms: input.platforms.map((p) => TO_AYR[p]),
      mediaUrls: input.mediaUrls,
      isVideo: input.isVideo,
      shortenLinks: false,
      // Our own reference — surfaced back as refId in history/webhooks.
      notes: input.refKey,
    };
    if (input.scheduleAt) body.scheduleDate = input.scheduleAt;
    if (input.youtube && input.platforms.includes("youtube")) {
      body.youTubeOptions = { title: input.youtube.title, visibility: input.youtube.visibility, ...(input.youtube.tags?.length ? { tags: input.youtube.tags } : {}) };
    }
    if (input.platforms.includes("tiktok")) {
      body.tikTokOptions = { privacyLevel: input.tiktok?.privacy ?? "PUBLIC_TO_EVERYONE", ...(input.isVideo ? {} : { autoAddMusic: true }) };
    }
    if (input.instagram?.reel && input.platforms.includes("instagram")) body.instagramOptions = { reels: true, shareReelsFeed: true };

    const json = await this.call<AyrPostResponse>("POST", "/post", body, DEFAULT_TIMEOUT_MS, /* allowError */ true);
    const perPlatform = parsePerPlatform(json);
    if (json.status === "error" || (!json.id && !json.postIds?.length)) {
      const details: Partial<Record<SocialPlatform, string>> = {};
      for (const [p, r] of Object.entries(perPlatform)) if (r?.error) details[p as SocialPlatform] = r.error;
      for (const e of json.errors ?? []) {
        const p = e.platform ? FROM_AYR[e.platform] : undefined;
        if (p && e.message) details[p] = e.message;
      }
      throw new PublishRejectedError(json.message ?? json.errors?.[0]?.message ?? "Ayrshare rejected the post", details);
    }
    return {
      providerPostId: json.id ?? "",
      refId: json.refId ?? null,
      status: json.status === "scheduled" ? "scheduled" : "success",
      perPlatform,
    };
  }

  async deletePost(providerPostId: string): Promise<void> {
    await this.call("DELETE", "/post", { id: providerPostId });
  }

  async postStatus(providerPostId: string): Promise<PostStatus> {
    const json = await this.call<AyrPostResponse & { type?: string }>("GET", `/history/${encodeURIComponent(providerPostId)}`, undefined, DEFAULT_TIMEOUT_MS, true);
    if (json.code === 404 || json.status === "error" && /not found/i.test(json.message ?? "")) {
      return { providerPostId, status: "unknown", perPlatform: {} };
    }
    const perPlatform = parsePerPlatform(json);
    const s = json.status;
    const status: PostStatus["status"] = s === "success" ? "success" : s === "scheduled" || s === "pending" ? (s as "scheduled" | "pending") : s === "deleted" ? "deleted" : s === "error" ? "error" : "unknown";
    return { providerPostId, status, perPlatform };
  }

  private async call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: Record<string, unknown>, timeoutMs = DEFAULT_TIMEOUT_MS, allowError = false): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${BASE}${path}`, {
        method,
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (err) {
      throw new Error(err instanceof Error && err.name === "AbortError" ? `Ayrshare ${method} ${path} timed out after ${timeoutMs} ms` : `Ayrshare ${method} ${path} failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }
    const json = (await res.json().catch(() => ({}))) as T & { message?: string; status?: string };
    if (!res.ok && !allowError) {
      throw new Error(`Ayrshare HTTP ${res.status} on ${method} ${path}: ${json.message ?? res.statusText}`.slice(0, 500));
    }
    if (!res.ok && res.status === 401) throw new Error("Ayrshare HTTP 401: API key rejected");
    return json;
  }
}

function parsePerPlatform(json: AyrPostResponse): CreatedPost["perPlatform"] {
  const out: CreatedPost["perPlatform"] = {};
  for (const r of json.postIds ?? []) {
    const p = r.platform ? FROM_AYR[r.platform] : undefined;
    if (!p) continue;
    out[p] = { status: r.status === "success" ? "success" : r.status === "error" ? "error" : "pending", id: r.id, postUrl: r.postUrl, error: r.status === "error" ? r.message : undefined };
  }
  for (const e of json.errors ?? []) {
    const p = e.platform ? FROM_AYR[e.platform] : undefined;
    if (p) out[p] = { status: "error", error: e.message };
  }
  return out;
}
