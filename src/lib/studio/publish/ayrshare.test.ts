import { describe, expect, it, vi } from "vitest";
import { AyrsharePublishProvider } from "./ayrshare";
import { getPublishAvailability, getPublishProvider, PublishNotConfiguredError, PublishRejectedError } from "./provider";

type Call = { url: string; init: RequestInit };
function mockFetch(responses: { status?: number; body: unknown }[]) {
  const calls: Call[] = [];
  let i = 0;
  const f = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("AyrsharePublishProvider", () => {
  it("maps connected accounts and display names", async () => {
    const { f, calls } = mockFetch([{ body: { activeSocialAccounts: ["facebook", "instagram", "linkedin"], displayNames: [{ platform: "facebook", displayName: "Detective Pulse" }] } }]);
    const p = new AyrsharePublishProvider("KEY", f);
    const acc = await p.connectedPlatforms();
    expect(acc.active).toEqual(["facebook", "instagram"]);
    expect(acc.displayNames.facebook).toBe("Detective Pulse");
    expect(calls[0].url).toBe("https://api.ayrshare.com/api/user");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer KEY");
  });
  it("uploads media as a data URL and returns the hosted url", async () => {
    const { f, calls } = mockFetch([{ body: { accessUrl: "https://img.ayrshare.com/x.png" } }]);
    const p = new AyrsharePublishProvider("KEY", f);
    const up = await p.uploadMedia({ bytes: new Uint8Array([1, 2, 3]), mime: "image/png", fileName: "a.png" });
    expect(up.url).toBe("https://img.ayrshare.com/x.png");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.file.startsWith("data:image/png;base64,")).toBe(true);
    expect(body.fileName).toBe("a.png");
  });
  it("creates a post with platform options and parses per-platform results", async () => {
    const { f, calls } = mockFetch([{ body: { status: "success", id: "P1", refId: "R1", postIds: [{ status: "success", id: "fb_1", platform: "facebook", postUrl: "https://fb/1" }, { status: "error", platform: "instagram", message: "media required" }] } }]);
    const p = new AyrsharePublishProvider("KEY", f);
    const out = await p.createPost({ text: "hello", platforms: ["facebook", "instagram", "youtube", "tiktok"], mediaUrls: ["https://m/1.mp4"], scheduleAt: "2030-01-01T00:00:00.000Z", isVideo: true, refKey: "master-1", youtube: { title: "T", visibility: "unlisted" }, instagram: { reel: true } });
    expect(out.providerPostId).toBe("P1");
    expect(out.status).toBe("success");
    expect(out.perPlatform.facebook).toMatchObject({ status: "success", postUrl: "https://fb/1" });
    expect(out.perPlatform.instagram).toMatchObject({ status: "error", error: "media required" });
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({ post: "hello", platforms: ["facebook", "instagram", "youtube", "tiktok"], scheduleDate: "2030-01-01T00:00:00.000Z", isVideo: true, notes: "master-1" });
    expect(body.youTubeOptions).toEqual({ title: "T", visibility: "unlisted" });
    expect(body.tikTokOptions.privacyLevel).toBe("PUBLIC_TO_EVERYONE");
    expect(body.instagramOptions).toMatchObject({ reels: true });
  });
  it("throws PublishRejectedError with per-platform details on a provider error", async () => {
    const { f } = mockFetch([{ status: 400, body: { status: "error", message: "bad request", errors: [{ platform: "tiktok", message: "video required" }] } }]);
    const p = new AyrsharePublishProvider("KEY", f);
    const err = await p.createPost({ text: "x", platforms: ["tiktok"], mediaUrls: [], isVideo: false, refKey: "m" }).catch((e) => e);
    expect(err).toBeInstanceOf(PublishRejectedError);
    expect((err as PublishRejectedError).details.tiktok).toBe("video required");
  });
  it("reads post status and maps scheduled / unknown", async () => {
    const { f } = mockFetch([{ body: { status: "scheduled", id: "P1", postIds: [] } }, { status: 404, body: { code: 404, status: "error", message: "Post not found" } }]);
    const p = new AyrsharePublishProvider("KEY", f);
    expect((await p.postStatus("P1")).status).toBe("scheduled");
    expect((await p.postStatus("nope")).status).toBe("unknown");
  });
  it("surfaces HTTP failures without the key and times out", async () => {
    const { f } = mockFetch([{ status: 500, body: { message: "boom" } }]);
    await expect(new AyrsharePublishProvider("SECRET", f).deletePost("P1")).rejects.toThrow(/HTTP 500.*boom/);
    await expect(new AyrsharePublishProvider("SECRET", f).deletePost("P1")).rejects.not.toThrow(/SECRET/);
    // An aborted fetch (what the internal timer triggers) surfaces as a "timed out" error, never as a raw AbortError.
    const aborting = vi.fn(async () => {
      throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    }) as unknown as typeof fetch;
    await expect(new AyrsharePublishProvider("K", aborting).connectedPlatforms()).rejects.toThrow(/timed out after \d+ ms/);
  });
});

describe("publish seam", () => {
  it("availability + not-configured error", () => {
    expect(getPublishAvailability({} as unknown as NodeJS.ProcessEnv).available).toBe(false);
    expect(getPublishAvailability({} as unknown as NodeJS.ProcessEnv).reason).toContain("AYRSHARE_API_KEY");
    expect(() => getPublishProvider({} as unknown as NodeJS.ProcessEnv)).toThrow(PublishNotConfiguredError);
    expect(getPublishProvider({ AYRSHARE_API_KEY: "k" } as unknown as NodeJS.ProcessEnv).name).toBe("ayrshare");
  });
});
