import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/marketing/article-gen", () => ({
  KEYWORD_TOPICS: [
    { th: "topic-a", en: "en-a", angle: "x" },
    { th: "topic-b", en: "en-b", angle: "y" },
  ],
  generateArticle: vi.fn(),
}));
vi.mock("@/lib/marketing/articles-db", () => ({
  getUsedTopicsAndSlugs: vi.fn(),
  insertDraft: vi.fn(),
}));
vi.mock("@/lib/line/notify", () => ({ pushLineNotify: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notifyRole: vi.fn() }));
vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));

import { GET } from "./route";
import { generateArticle } from "@/lib/marketing/article-gen";
import { getUsedTopicsAndSlugs, insertDraft } from "@/lib/marketing/articles-db";
import { pushLineNotify } from "@/lib/line/notify";

function req(auth?: string): NextRequest {
  const headers = new Map<string, string>();
  if (auth) headers.set("authorization", auth);
  return { headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null } } as unknown as NextRequest;
}

const article = {
  topic: "topic-a", thTitle: "T", thDescription: "D", thBody: "B",
  enTitle: "T", enDescription: "D", enBody: "B", thSlug: "s", enSlug: "s", coverCategory: "hire", model: "m",
};

const OLD = { ...process.env };
beforeEach(() => {
  vi.restoreAllMocks();
  process.env.CRON_SECRET = "secret";
  vi.mocked(getUsedTopicsAndSlugs).mockResolvedValue({ topics: new Set(), slugs: new Set() });
  vi.mocked(generateArticle).mockResolvedValue({ ...article });
  vi.mocked(insertDraft).mockResolvedValue({ id: "id-1" });
});
afterEach(() => { process.env = { ...OLD }; vi.clearAllMocks(); });

describe("GET /api/cron/publish-article", () => {
  it("401 without the CRON_SECRET bearer", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(vi.mocked(generateArticle)).not.toHaveBeenCalled();
  });

  it("401 on a wrong secret", async () => {
    const res = await GET(req("Bearer nope"));
    expect(res.status).toBe(401);
  });

  it("generates a draft + pings LINE when authorized", async () => {
    const res = await GET(req("Bearer secret"));
    expect(res.status).toBe(200);
    expect(vi.mocked(generateArticle)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(insertDraft)).toHaveBeenCalledTimes(1);
    // draft is inserted with a fresh token (2nd arg)
    const token = vi.mocked(insertDraft).mock.calls[0]![1];
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
    expect(vi.mocked(pushLineNotify)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(pushLineNotify).mock.calls[0]![0]).toContain("/review/");
  });

  it("appends a suffix when the generated slug already exists", async () => {
    vi.mocked(getUsedTopicsAndSlugs).mockResolvedValue({ topics: new Set(), slugs: new Set(["s"]) });
    await GET(req("Bearer secret"));
    const inserted = vi.mocked(insertDraft).mock.calls[0]![0];
    expect(inserted.thSlug).toBe("s-2");
    expect(inserted.enSlug).toBe("s-2");
  });

  it("500 when generation fails", async () => {
    vi.mocked(generateArticle).mockRejectedValue(new Error("boom"));
    const res = await GET(req("Bearer secret"));
    expect(res.status).toBe(500);
  });
});
