/**
 * Studio Settings action tests: admin gate, pillar-sum validation, regex
 * compile check, and the happy-path upsert (id + updated_by stamped).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  profile: { id: "admin-1", role: "admin" } as { id: string; role: string } | null,
  upsertCalls: [] as { row: Record<string, unknown>; opts: unknown }[],
  upsertResult: { error: null as unknown },
  audit: [] as { action: string; metadata?: unknown }[],
  seed: { knowledge: 1, cases: 2, insights: 3, questions: 4, ideas: 5, masters: 6 },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/auth", () => ({
  requireStudioAdmin: vi.fn(async () => {
    if (!h.profile || h.profile.role !== "admin") throw new Error("Unauthorized");
    return h.profile;
  }),
}));
vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(async (e: { action: string; metadata?: unknown }) => {
    h.audit.push(e);
  }),
}));
vi.mock("@/lib/studio/seed", () => ({
  loadDemoData: vi.fn(async () => h.seed),
  removeDemoData: vi.fn(async () => undefined),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      upsert: (row: Record<string, unknown>, opts: unknown) => {
        h.upsertCalls.push({ row, opts });
        return Promise.resolve(h.upsertResult);
      },
    }),
  }),
}));

async function load() {
  return import("./actions");
}

beforeEach(() => {
  h.profile = { id: "admin-1", role: "admin" };
  h.upsertCalls = [];
  h.upsertResult = { error: null };
  h.audit = [];
});

const validBrandVoice = {
  language: "th",
  style: ["professional", "calm"],
  avoid: ["clickbait"],
  cta_default: "ปรึกษาได้ทาง LINE",
  custom_notes: "",
};

describe("authorization", () => {
  it("rejects non-admins before touching the database", async () => {
    h.profile = { id: "agent-1", role: "agent" };
    const { updateBrandVoice, updatePillars, loadDemo } = await load();
    await expect(updateBrandVoice(validBrandVoice)).rejects.toThrow("Unauthorized");
    await expect(updatePillars({ pillars: [] })).rejects.toThrow("Unauthorized");
    await expect(loadDemo()).rejects.toThrow("Unauthorized");
    expect(h.upsertCalls).toHaveLength(0);
  });
});

describe("updatePillars", () => {
  const full = (pcts: number[]) =>
    ["detective_knowledge", "case_story", "detective_pov", "red_flags", "behind_investigation", "service"].map((key, i) => ({ key, target_pct: pcts[i]! }));

  it("rejects when the sum is not 100", async () => {
    const { updatePillars } = await load();
    const res = await updatePillars({ pillars: full([25, 30, 15, 10, 10, 5]) });
    expect(res).toEqual({ ok: false, error: expect.stringContaining("100") });
    expect(h.upsertCalls).toHaveLength(0);
  });

  it("rejects when a pillar is missing", async () => {
    const { updatePillars } = await load();
    const res = await updatePillars({ pillars: full([50, 50, 0, 0, 0, 0]).slice(0, 5) });
    expect(res.ok).toBe(false);
  });

  it("saves when the sum is exactly 100", async () => {
    const { updatePillars } = await load();
    const res = await updatePillars({ pillars: full([25, 30, 15, 10, 10, 10]) });
    expect(res).toEqual({ ok: true });
    expect(h.upsertCalls[0]!.row).toMatchObject({ id: "00000000-0000-0000-0000-000000000001", updated_by: "admin-1" });
    expect((h.upsertCalls[0]!.row.pillars as unknown[]).length).toBe(6);
  });
});

describe("updatePrivacyRules", () => {
  it("rejects an invalid regex and names it", async () => {
    const { updatePrivacyRules } = await load();
    const res = await updatePrivacyRules({ denylist: ["สมชาย"], custom_patterns: ["\\d{3}", "(unclosed"], strict_mode: false });
    expect(res).toEqual({ ok: false, error: expect.stringContaining("(unclosed") });
    expect(h.upsertCalls).toHaveLength(0);
  });

  it("saves valid rules and writes STUDIO_PRIVACY_RULES_UPDATE audit", async () => {
    const { updatePrivacyRules } = await load();
    const res = await updatePrivacyRules({ denylist: ["สมชาย", "สมชาย"], custom_patterns: ["เคส\\s?\\d{4,}"], strict_mode: true });
    expect(res).toEqual({ ok: true });
    const rules = h.upsertCalls[0]!.row.privacy_rules as { denylist: string[]; strict_mode: boolean };
    expect(rules.denylist).toEqual(["สมชาย"]); // de-duplicated
    expect(rules.strict_mode).toBe(true);
    expect(h.audit.map((a) => a.action)).toContain("STUDIO_PRIVACY_RULES_UPDATE");
  });
});

describe("updateBrandVoice (happy path)", () => {
  it("upserts onto the singleton with updated_by and mirrors default_language", async () => {
    const { updateBrandVoice } = await load();
    const res = await updateBrandVoice(validBrandVoice);
    expect(res).toEqual({ ok: true });
    expect(h.upsertCalls).toHaveLength(1);
    const { row, opts } = h.upsertCalls[0]!;
    expect(row).toMatchObject({
      id: "00000000-0000-0000-0000-000000000001",
      updated_by: "admin-1",
      default_language: "th",
      brand_voice: expect.objectContaining({ style: ["professional", "calm"] }),
    });
    expect(opts).toEqual({ onConflict: "id" });
    expect(h.audit.map((a) => a.action)).toContain("STUDIO_SETTINGS_UPDATE");
  });

  it("rejects an empty style list", async () => {
    const { updateBrandVoice } = await load();
    const res = await updateBrandVoice({ ...validBrandVoice, style: [] });
    expect(res.ok).toBe(false);
  });

  it("surfaces a safe error when the upsert fails", async () => {
    h.upsertResult = { error: { message: "boom", code: "42501" } };
    const { updateBrandVoice } = await load();
    const res = await updateBrandVoice(validBrandVoice);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("boom");
  });
});

describe("updateAiProvider", () => {
  it("rejects a model that is not in STUDIO_MODELS", async () => {
    const { updateAiProvider } = await load();
    const res = await updateAiProvider({ provider: "anthropic", model: "gpt-9" });
    expect(res.ok).toBe(false);
  });
  it("stores provider + model", async () => {
    const { updateAiProvider } = await load();
    const res = await updateAiProvider({ provider: "anthropic", model: "claude-sonnet-5" });
    expect(res).toEqual({ ok: true });
    expect(h.upsertCalls[0]!.row).toMatchObject({ ai_provider: "anthropic", ai_model: "claude-sonnet-5" });
  });
});

describe("demo data", () => {
  it("loadDemo returns the seed summary and audits", async () => {
    const { loadDemo } = await load();
    const res = await loadDemo();
    expect(res).toEqual({ ok: true, data: h.seed });
    expect(h.audit.map((a) => a.action)).toContain("STUDIO_DEMO_LOAD");
  });
  it("removeDemo audits", async () => {
    const { removeDemo } = await load();
    expect(await removeDemo()).toEqual({ ok: true });
    expect(h.audit.map((a) => a.action)).toContain("STUDIO_DEMO_REMOVE");
  });
});
