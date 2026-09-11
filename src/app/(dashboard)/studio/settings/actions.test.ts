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
vi.mock("@/lib/studio/settings", () => ({
  getStudioSettings: vi.fn(async () => ({ social_connections: { ayrshare: { checked_at: null, active: [], display_names: {} }, defaults: { youtube_visibility: "public", tiktok_privacy: "PUBLIC_TO_EVERYONE" } } })),
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

describe("updateMediaPrefs", () => {
  const good = { image_style: "Cinematic Bangkok night", default_aspect: "9:16", image_model: "gemini-2.5-flash-image", tts_voice_id: "EXAVITQu4vr4xnSDxMaL", tts_model: "eleven_multilingual_v2" };
  it("rejects an unknown aspect and unsafe model / voice ids", async () => {
    const { updateMediaPrefs } = await load();
    expect((await updateMediaPrefs({ ...good, default_aspect: "3:2" })).ok).toBe(false);
    expect((await updateMediaPrefs({ ...good, image_model: "model;drop" })).ok).toBe(false);
    expect((await updateMediaPrefs({ ...good, tts_voice_id: "../x" })).ok).toBe(false);
    expect(h.upsertCalls).toHaveLength(0);
  });
  it("stores media_prefs and audits", async () => {
    const { updateMediaPrefs } = await load();
    expect(await updateMediaPrefs(good)).toEqual({ ok: true });
    expect(h.upsertCalls[0]!.row).toMatchObject({ media_prefs: good });
    expect(h.audit.map((a) => a.action)).toContain("STUDIO_SETTINGS_UPDATE");
  });
});

describe("updateSocialDefaults", () => {
  it("rejects unknown values and stores defaults next to the existing connection snapshot", async () => {
    const { updateSocialDefaults } = await load();
    expect((await updateSocialDefaults({ youtube_visibility: "everyone", tiktok_privacy: "PUBLIC_TO_EVERYONE" })).ok).toBe(false);
    expect(h.upsertCalls).toHaveLength(0);
    expect(await updateSocialDefaults({ youtube_visibility: "unlisted", tiktok_privacy: "SELF_ONLY" })).toEqual({ ok: true });
    const sc = h.upsertCalls[0]!.row.social_connections as { defaults: Record<string, string>; ayrshare: unknown };
    expect(sc.defaults).toEqual({ youtube_visibility: "unlisted", tiktok_privacy: "SELF_ONLY" });
    expect(sc.ayrshare).toBeDefined();
  });
});

describe("updateAutopilot", () => {
  const good = {
    enabled: true,
    days: [4, 1, 1],
    platforms: ["facebook", "instagram"],
    pillar_mode: "rotate",
    pillar: null,
    target_seconds: 30,
    images_per_run: 2,
    auto_publish: true,
    publish_on_review_required: false,
    allow_unsupported_claims: false,
    max_runs_per_week: 3,
    video_format: "storyteller",
  };
  it("refuses a non-admin before touching the database", async () => {
    h.profile = { id: "u", role: "supervisor" };
    const { updateAutopilot } = await load();
    await expect(updateAutopilot(good)).rejects.toThrow();
    expect(h.upsertCalls).toHaveLength(0);
  });
  it("rejects a fixed pillar mode with no pillar and out-of-range values", async () => {
    const { updateAutopilot } = await load();
    expect((await updateAutopilot({ ...good, pillar_mode: "fixed", pillar: null })).ok).toBe(false);
    expect((await updateAutopilot({ ...good, images_per_run: 7 })).ok).toBe(false);
    expect((await updateAutopilot({ ...good, days: [] })).ok).toBe(false);
    expect((await updateAutopilot({ ...good, platforms: [] })).ok).toBe(false);
    expect((await updateAutopilot({ ...good, target_seconds: 42 })).ok).toBe(false);
    expect((await updateAutopilot({ ...good, video_format: "vlog" })).ok).toBe(false);
    expect((await updateAutopilot(Object.fromEntries(Object.entries(good).filter(([k]) => k !== "video_format")))).ok).toBe(false);
    expect(h.upsertCalls).toHaveLength(0);
  });
  it("stores the config with days de-duplicated and sorted, and audits", async () => {
    const { updateAutopilot } = await load();
    expect(await updateAutopilot(good)).toEqual({ ok: true });
    expect((h.upsertCalls[0]!.row.autopilot as Record<string, unknown>).days).toEqual([1, 4]);
    expect((h.upsertCalls[0]!.row.autopilot as Record<string, unknown>).auto_publish).toBe(true);
    expect((h.upsertCalls[0]!.row.autopilot as Record<string, unknown>).video_format).toBe("storyteller");
    expect(h.audit.map((a) => a.action)).toContain("STUDIO_SETTINGS_UPDATE");
  });
  it("accepts every clip format, persists it and audits the choice", async () => {
    const { updateAutopilot } = await load();
    for (const video_format of ["template", "storyteller", "alternate"]) {
      expect(await updateAutopilot({ ...good, video_format })).toEqual({ ok: true });
      expect((h.upsertCalls.at(-1)!.row.autopilot as Record<string, unknown>).video_format).toBe(video_format);
    }
    expect(h.upsertCalls).toHaveLength(3);
    expect(h.audit.at(-1)!.metadata).toMatchObject({ section: "autopilot", video_format: "alternate" });
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
