/**
 * runPrivacyCheck: deterministic scan always runs; AI can only tighten the
 * verdict, never loosen it; AI failure falls back to the deterministic result.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  aiResult: null as null | { ok: true; data: unknown; generationId: string; model: string } | { ok: false; error: string; code: string; generationId: null },
  strict: false,
}));

vi.mock("@/lib/studio/settings", () => ({
  getStudioSettings: async () => ({
    brand_voice: { language: "th", style: [], avoid: [], cta_default: "", custom_notes: "" },
    privacy_rules: { denylist: ["Pimchanok"], custom_patterns: [], strict_mode: h.strict },
  }),
}));
vi.mock("../run", () => ({ runStructured: vi.fn(async () => h.aiResult) }));

const aiOk = (status: "safe" | "review_required" | "blocked", findings: unknown[] = []) => ({
  ok: true as const,
  data: { status, findings, summary: "AI summary", generalisation_suggestions: ["ใช้คำว่า ย่านหนึ่ง"] },
  generationId: "g1",
  model: "claude-opus-5",
});

beforeEach(() => {
  h.aiResult = null;
  h.strict = false;
});

describe("runPrivacyCheck", () => {
  it("deterministic only: safe for generalised text", async () => {
    const { runPrivacyCheck } = await import("./privacy");
    const r = await runPrivacyCheck({ fields: { script: "เป้าหมายออกจากบ้านช่วงเช้า" }, useAi: false, userId: null });
    expect(r.status).toBe("safe");
    expect(r.checked_by).toBe("deterministic");
  });

  it("deterministic only: blocked on a phone number or denylist term", async () => {
    const { runPrivacyCheck } = await import("./privacy");
    const r = await runPrivacyCheck({ fields: { caption: "โทร 081-234-5678" }, useAi: false, userId: null });
    expect(r.status).toBe("blocked");
    const d = await runPrivacyCheck({ fields: { caption: "ลูกค้า pimchanok" }, useAi: false, userId: null });
    expect(d.status).toBe("blocked");
  });

  it("AI can tighten a safe deterministic result", async () => {
    h.aiResult = aiOk("review_required", [{ kind: "location", excerpt: "คอนโดริมน้ำ", reason: "เจาะจง", severity: "medium", field: "script" }]);
    const { runPrivacyCheck } = await import("./privacy");
    const r = await runPrivacyCheck({ fields: { script: "เป้าหมายไปคอนโดริมน้ำ" }, useAi: true, userId: null });
    expect(r.status).toBe("review_required");
    expect(r.checked_by).toBe("ai");
    expect(r.findings.some((f) => f.source === "ai" && f.kind === "location")).toBe(true);
    expect(r.suggestions).toHaveLength(1);
  });

  it("AI can never loosen a deterministic block", async () => {
    h.aiResult = aiOk("safe");
    const { runPrivacyCheck } = await import("./privacy");
    const r = await runPrivacyCheck({ fields: { script: "โทร 081-234-5678" }, useAi: true, userId: null });
    expect(r.status).toBe("blocked");
  });

  it("falls back to the deterministic result when the AI call fails", async () => {
    h.aiResult = { ok: false, error: "AI ล้มเหลว", code: "failed", generationId: null };
    const { runPrivacyCheck } = await import("./privacy");
    const r = await runPrivacyCheck({ fields: { script: "ข้อความทั่วไป" }, useAi: true, userId: null });
    expect(r.status).toBe("safe");
    expect(r.checked_by).toBe("deterministic");
    expect(r.ai_error).toBe("AI ล้มเหลว");
  });

  it("strict mode turns medium findings into blocked", async () => {
    h.strict = true;
    const { runPrivacyCheck } = await import("./privacy");
    const r = await runPrivacyCheck({ fields: { script: "เหตุการณ์วันที่ 12/03/2568" }, useAi: false, userId: null });
    expect(r.status).toBe("blocked");
  });
});
