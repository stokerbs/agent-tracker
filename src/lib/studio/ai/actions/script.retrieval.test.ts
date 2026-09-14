import { describe, expect, it, vi } from "vitest";

/** The script path must stay narrow: a long knowledge list is what made clips mix unrelated topics. */
const h = vi.hoisted(() => ({ context: vi.fn(), run: vi.fn() }));
vi.mock("./context", () => ({
  buildContext: (q: string, s: unknown) => h.context(q, s),
  resolveSourceRefs: () => [],
  clampScore: (n: number) => n,
}));
vi.mock("../run", () => ({ runStructured: (o: unknown) => h.run(o) }));

describe("script schema", () => {
  it("does not offer the model section labels the prompt bans", async () => {
    const { ScriptResponseSchema } = await import("../prompts/schemas");
    const description = ScriptResponseSchema.shape.script.description ?? "";
    expect(description).toContain("No section labels");
    expect(description).not.toMatch(/\[HOOK\]|label[s]? like/i);
  });
});

describe("generateScript retrieval", () => {
  it("asks for four knowledge blocks and tells the model to use at most two", async () => {
    h.context.mockResolvedValue({ system: "sys", knowledgeContext: "blocks", hits: [], refs: {} });
    h.run.mockResolvedValue({ ok: false, error: "stop", code: "failed", generationId: null });
    const { generateScript } = await import("./script");
    await generateScript({ title: "หัวข้อ", pillar: "detective_knowledge", platform: "tiktok", targetSeconds: 30, userId: "u1" });
    expect(h.context).toHaveBeenCalledWith(expect.stringContaining("หัวข้อ"), { limit: 4, pillar: "detective_knowledge" });
    const user = (h.run.mock.calls[0]![0] as { user: string }).user;
    expect(user).toContain("at MOST 2 blocks");
    expect(user).toContain("NO section labels");
  });
});
