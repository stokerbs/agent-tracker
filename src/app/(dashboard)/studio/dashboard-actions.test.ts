/**
 * Dashboard action tests: auth guard, AI pass-through (errors surfaced, never
 * swallowed), and saving a mix suggestion into the Idea Bank.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  admin: { id: "admin-1", role: "admin" } as { id: string; role: string } | null,
  aiResult: { ok: true, data: { flags: ["f"], suggestions: [], unused_knowledge: [] }, model: "claude-test", generationId: "g1" } as Record<string, unknown>,
  aiCalls: [] as Record<string, unknown>[],
  insertResult: { data: { id: "idea-1" } as { id: string } | null, error: null as { message: string } | null },
  inserts: [] as Record<string, unknown>[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/auth", () => ({ getStudioAdmin: vi.fn(async () => h.admin) }));
vi.mock("@/lib/studio/ai", () => ({
  recommendContentMix: vi.fn(async (input: Record<string, unknown>) => {
    h.aiCalls.push(input);
    return h.aiResult;
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.single = async () => h.insertResult;
      b.insert = (payload: Record<string, unknown>) => {
        h.inserts.push(payload);
        return b;
      };
      return b;
    },
  }),
}));

async function load() {
  return import("./dashboard-actions");
}

beforeEach(() => {
  h.admin = { id: "admin-1", role: "admin" };
  h.aiResult = { ok: true, data: { flags: ["f"], suggestions: [], unused_knowledge: [] }, model: "claude-test", generationId: "g1" };
  h.aiCalls.length = 0;
  h.insertResult = { data: { id: "idea-1" }, error: null };
  h.inserts.length = 0;
});

describe("requestMixRecommendation", () => {
  it("refuses non-admins without calling the AI", async () => {
    h.admin = null;
    const { requestMixRecommendation } = await load();
    expect(await requestMixRecommendation()).toMatchObject({ ok: false });
    expect(h.aiCalls).toHaveLength(0);
  });

  it("passes the window and user id through and returns the recommendation + model", async () => {
    const { requestMixRecommendation } = await load();
    const res = await requestMixRecommendation(14);
    expect(res).toMatchObject({ ok: true, data: { model: "claude-test", recommendation: { flags: ["f"] } } });
    expect(h.aiCalls[0]).toEqual({ days: 14, userId: "admin-1" });
  });

  it("rejects an out-of-range window", async () => {
    const { requestMixRecommendation } = await load();
    expect(await requestMixRecommendation(3)).toMatchObject({ ok: false });
    expect(h.aiCalls).toHaveLength(0);
  });

  it("surfaces an AI failure instead of swallowing it", async () => {
    h.aiResult = { ok: false, error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY", code: "not_configured", generationId: null };
    const { requestMixRecommendation } = await load();
    expect(await requestMixRecommendation()).toEqual({ ok: false, error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" });
  });
});

describe("saveMixSuggestionAsIdea", () => {
  const valid = {
    pillar: "red_flags",
    title: "5 สัญญาณที่คนมักมองข้าม",
    hook: "ถ้าเห็นข้อ 3 ให้เริ่มสังเกต",
    reason: "ยังไม่มีคอนเทนต์เสานี้เลย",
    source_refs: [{ kind: "knowledge" as const, id: "11111111-1111-4111-8111-111111111111", label: "FAQ: สัญญาณเตือน" }],
  };

  it("refuses non-admins", async () => {
    h.admin = null;
    const { saveMixSuggestionAsIdea } = await load();
    expect(await saveMixSuggestionAsIdea(valid)).toMatchObject({ ok: false });
    expect(h.inserts).toHaveLength(0);
  });

  it("rejects an unknown pillar and an empty title", async () => {
    const { saveMixSuggestionAsIdea } = await load();
    expect(await saveMixSuggestionAsIdea({ ...valid, pillar: "gossip" })).toMatchObject({ ok: false });
    expect(await saveMixSuggestionAsIdea({ ...valid, title: "   " })).toMatchObject({ ok: false });
    expect(h.inserts).toHaveLength(0);
  });

  it("inserts an AI-origin idea in status new with its source refs", async () => {
    const { saveMixSuggestionAsIdea } = await load();
    expect(await saveMixSuggestionAsIdea(valid)).toEqual({ ok: true, data: { id: "idea-1" } });
    expect(h.inserts[0]).toMatchObject({
      title: valid.title,
      hook: valid.hook,
      description: valid.reason,
      pillar: "red_flags",
      origin: "ai",
      status: "new",
      tags: ["content_mix"],
      created_by: "admin-1",
      source_refs: valid.source_refs,
    });
  });

  it("returns a Thai error when the insert fails", async () => {
    h.insertResult = { data: null, error: { message: "boom" } };
    const { saveMixSuggestionAsIdea } = await load();
    expect(await saveMixSuggestionAsIdea(valid)).toMatchObject({ ok: false });
  });
});
