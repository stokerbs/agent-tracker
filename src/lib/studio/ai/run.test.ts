/**
 * runStructured() — the single choke point for Studio AI calls. Verifies the
 * generation log is written for success / failure / refusal / not-configured
 * and that user-facing errors never leak raw provider internals.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

const h = vi.hoisted(() => ({
  inserted: [] as Record<string, unknown>[],
  generate: vi.fn(),
  providerError: null as Error | null,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        h.inserted.push(row);
        return { select: () => ({ single: async () => ({ data: { id: "gen-1" }, error: null }) }) };
      },
    }),
  }),
}));
vi.mock("./provider", async () => {
  const actual = await vi.importActual<typeof import("./provider")>("./provider");
  return {
    ...actual,
    getAiProvider: async () => {
      if (h.providerError) throw h.providerError;
      return { name: "anthropic", generateStructured: h.generate };
    },
  };
});

const Schema = z.object({ title: z.string() });
const base = { purpose: "ideas", schema: Schema, system: "s", user: "u", inputRefs: { brief: "x" }, userId: "u1" };

beforeEach(() => {
  h.inserted = [];
  h.generate.mockReset();
  h.providerError = null;
});

describe("runStructured", () => {
  it("returns data and logs an ok row", async () => {
    h.generate.mockResolvedValue({ data: { title: "A" }, provider: "anthropic", model: "claude-opus-5", inputTokens: 10, outputTokens: 5, durationMs: 12 });
    const { runStructured } = await import("./run");
    const res = await runStructured(base);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.title).toBe("A");
    expect(h.inserted[0]).toMatchObject({ purpose: "ideas", status: "ok", model: "claude-opus-5", input_tokens: 10 });
    expect(h.inserted[0].input_refs).toEqual({ brief: "x" });
  });

  it("omits raw output from the log when storeOutput is false", async () => {
    h.generate.mockResolvedValue({ data: { title: "ลูกค้าคุณสมชาย" }, provider: "anthropic", model: "m", inputTokens: 1, outputTokens: 1, durationMs: 1 });
    const { runStructured } = await import("./run");
    const res = await runStructured({ ...base, storeOutput: false });
    expect(res.ok).toBe(true);
    expect(JSON.stringify(h.inserted[0].output)).not.toContain("สมชาย");
    expect(h.inserted[0].output).toMatchObject({ _omitted: "privacy" });
  });

  it("logs an error row and returns a Thai user-facing message on failure", async () => {
    h.generate.mockRejectedValue(new Error("boom: internal stack"));
    const { runStructured } = await import("./run");
    const res = await runStructured(base);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("failed");
      expect(res.error).not.toContain("boom");
    }
    expect(h.inserted[0]).toMatchObject({ status: "error", error: "boom: internal stack" });
  });

  it("maps refusals", async () => {
    const { AiRefusedError } = await import("./provider");
    h.generate.mockRejectedValue(new AiRefusedError());
    const { runStructured } = await import("./run");
    const res = await runStructured(base);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("refused");
    expect(h.inserted[0]).toMatchObject({ status: "refused" });
  });

  it("reports not_configured without logging when no provider can be built", async () => {
    const { AiNotConfiguredError } = await import("./provider");
    h.providerError = new AiNotConfiguredError("ANTHROPIC_API_KEY ยังไม่ได้ตั้งค่า");
    const { runStructured } = await import("./run");
    const res = await runStructured(base);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("not_configured");
      expect(res.error).toContain("ANTHROPIC_API_KEY");
    }
    expect(h.inserted).toHaveLength(0);
  });
});
