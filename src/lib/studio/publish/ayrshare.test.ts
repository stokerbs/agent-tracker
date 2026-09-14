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
  describe("findRecentPostByRef", () => {
    const SINCE = "2026-09-14T10:20:00.000Z";
    const entry = (over: Record<string, unknown> = {}) => ({
      id: "P_LATE",
      refId: "R_LATE",
      status: "success",
      notes: "master-1",
      created: "2026-09-14T10:21:35Z",
      platforms: ["facebook", "tiktok"],
      postIds: [{ status: "success", id: "fb_1", platform: "facebook", postUrl: "https://fb/1" }],
      ...over,
    });

    it("matches our refKey, the exact platform set and the time window", async () => {
      const { f, calls } = mockFetch([{ body: { history: [entry()] } }]);
      const p = new AyrsharePublishProvider("KEY", f);
      const out = await p.findRecentPostByRef({ refKey: "master-1", platforms: ["tiktok", "facebook"], since: SINCE });
      expect(out).toMatchObject({ providerPostId: "P_LATE", refId: "R_LATE", status: "success" });
      expect(out!.perPlatform.facebook).toMatchObject({ status: "success", postUrl: "https://fb/1" });
      expect(calls[0].url).toBe("https://api.ayrshare.com/api/history?lastRecords=25");
      expect(calls[0].init.method).toBe("GET");
      expect(String(calls[0].url)).not.toContain("KEY"); // the key only ever travels in the header
    });

    it("reads a held schedule as scheduled, not published", async () => {
      const { f } = mockFetch([{ body: { history: [entry({ status: "scheduled" })] } }]);
      const out = await new AyrsharePublishProvider("KEY", f).findRecentPostByRef({ refKey: "master-1", platforms: ["facebook", "tiktok"], since: SINCE });
      expect(out!.status).toBe("scheduled");
    });

    it("ignores another master, another platform set, an older post, an errored post and a missing id", async () => {
      const cases: Record<string, unknown>[] = [
        { notes: "master-2" },
        { platforms: ["facebook"] }, // a narrower request than the group we are asking about
        { platforms: ["facebook", "tiktok", "instagram"] },
        { created: "2026-09-14T10:00:00Z" }, // well before the attempt, even with the clock slack
        { status: "error" },
        { id: undefined },
        { created: "not a date" },
      ];
      for (const over of cases) {
        const { f } = mockFetch([{ body: { history: [entry(over)] } }]);
        const out = await new AyrsharePublishProvider("KEY", f).findRecentPostByRef({ refKey: "master-1", platforms: ["facebook", "tiktok"], since: SINCE });
        expect(out, JSON.stringify(over)).toBeNull();
      }
    });

    it("only calls an explicit success with per-platform results posted", async () => {
      // still in flight → reported as not-yet-published so the sync cron keeps following it
      for (const over of [{ status: "pending" }, { status: "processing" }, { status: "success", postIds: [] }]) {
        const { f } = mockFetch([{ body: { history: [entry(over)] } }]);
        const out = await new AyrsharePublishProvider("KEY", f).findRecentPostByRef({ refKey: "master-1", platforms: ["facebook", "tiktok"], since: SINCE });
        expect(out, JSON.stringify(over)).toMatchObject({ providerPostId: "P_LATE", status: "scheduled" });
      }
      // a status we do not understand is never treated as posted
      for (const status of ["deleted", "cancelled", "unknown-to-us"]) {
        const { f } = mockFetch([{ body: { history: [entry({ status })] } }]);
        expect(await new AyrsharePublishProvider("KEY", f).findRecentPostByRef({ refKey: "master-1", platforms: ["facebook", "tiktok"], since: SINCE })).toBeNull();
      }
    });

    it("ignores a record created past the window, not only one before it", async () => {
      const { f } = mockFetch([{ body: { history: [entry({ created: new Date(Date.now() + 10 * 60_000).toISOString() })] } }]);
      expect(await new AyrsharePublishProvider("KEY", f).findRecentPostByRef({ refKey: "master-1", platforms: ["facebook", "tiktok"], since: SINCE })).toBeNull();
    });

    it("refuses a platform set of the same size but a different shape", async () => {
      const { f } = mockFetch([{ body: { history: [entry({ platforms: ["facebook", "instagram"] })] } }]);
      expect(await new AyrsharePublishProvider("KEY", f).findRecentPostByRef({ refKey: "master-1", platforms: ["facebook", "tiktok"], since: SINCE })).toBeNull();
    });

    it("takes the newest of two matching records", async () => {
      // Ayrshare returns history newest first; a retry can leave two records for the same group.
      const { f } = mockFetch([{ body: { history: [entry({ id: "P_NEW", created: "2026-09-14T10:25:00Z" }), entry({ id: "P_OLD" })] } }]);
      const out = await new AyrsharePublishProvider("KEY", f).findRecentPostByRef({ refKey: "master-1", platforms: ["facebook", "tiktok"], since: SINCE });
      expect(out!.providerPostId).toBe("P_NEW");
    });

    it("returns null instead of throwing when the history call answers an error", async () => {
      const { f } = mockFetch([{ status: 404, body: { status: "error", code: 221, message: "not found" } }]);
      expect(await new AyrsharePublishProvider("KEY", f).findRecentPostByRef({ refKey: "master-1", platforms: ["facebook"], since: SINCE })).toBeNull();
    });
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
