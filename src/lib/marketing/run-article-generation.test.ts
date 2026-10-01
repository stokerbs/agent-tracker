import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/marketing/article-gen", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/marketing/article-gen")>();
  return { ...mod, generateArticle: vi.fn() };
});
vi.mock("@/lib/marketing/articles-db", () => ({
  getUsedTopicsAndSlugs: vi.fn(),
  insertDraft: vi.fn(),
  insertComplianceTombstone: vi.fn(),
}));
vi.mock("@/lib/line/notify", () => ({ pushLineNotify: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notifyRole: vi.fn() }));
vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));

import { runArticleGeneration } from "./run-article-generation";
import { generateArticle, ComplianceRejectedError } from "./article-gen";
import { getUsedTopicsAndSlugs, insertDraft, insertComplianceTombstone } from "./articles-db";
import { ZH_PLAN_ORDERED } from "@/lib/marketing/zh/topics";

const article = {
  topic: "t", thTitle: "T", thDescription: "D", thBody: "B", enTitle: "T", enDescription: "D", enBody: "B",
  zhTitle: "T", zhDescription: "D", zhBody: "B", thSlug: "slug", enSlug: "slug", zhSlug: "文章", coverCategory: "hire", model: "m", service: "background",
};

beforeEach(() => {
  vi.mocked(getUsedTopicsAndSlugs).mockResolvedValue({ topics: new Set(), slugs: new Set() });
  vi.mocked(generateArticle).mockResolvedValue({ ...article });
  vi.mocked(insertDraft).mockResolvedValue({ id: "id-1" });
});
afterEach(() => vi.clearAllMocks());

describe("runArticleGeneration", () => {
  it("passes the service through to the draft and seeds from the Chinese plan first", async () => {
    const r = await runArticleGeneration();
    expect(r.id).toBe("id-1");
    expect(vi.mocked(generateArticle).mock.calls[0]![0].th).toBe(ZH_PLAN_ORDERED[0]!.th);
    expect(vi.mocked(insertDraft)).toHaveBeenCalledWith(expect.objectContaining({ service: "background" }), expect.any(String));
  });

  it("suffixes all three slugs when the Chinese slug collides", async () => {
    vi.mocked(getUsedTopicsAndSlugs).mockResolvedValue({ topics: new Set(), slugs: new Set(["文章", "文章-2"]) });
    await runArticleGeneration();
    expect(vi.mocked(insertDraft)).toHaveBeenCalledWith(expect.objectContaining({ thSlug: "slug-3", enSlug: "slug-3", zhSlug: "文章-3" }), expect.any(String));
  });

  it("writes a tombstone so a twice-rejected topic is skipped next run, then rethrows", async () => {
    vi.mocked(generateArticle).mockRejectedValue(new ComplianceRejectedError("topic-x", ["开房记录"]));
    await expect(runArticleGeneration()).rejects.toBeInstanceOf(ComplianceRejectedError);
    expect(vi.mocked(insertComplianceTombstone)).toHaveBeenCalledWith("topic-x", ["开房记录"], "compliance-filter");
    expect(vi.mocked(insertDraft)).not.toHaveBeenCalled();
  });

  it("does not tombstone on an unrelated failure", async () => {
    vi.mocked(generateArticle).mockRejectedValue(new Error("Anthropic error 500"));
    await expect(runArticleGeneration()).rejects.toThrow("Anthropic error 500");
    expect(vi.mocked(insertComplianceTombstone)).not.toHaveBeenCalled();
  });
});
