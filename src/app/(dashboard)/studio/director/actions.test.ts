/**
 * Creative Director action tests: zod validation, AI-unavailable path,
 * RunResult.error surfacing (never faked), createCampaign persistence
 * (campaign row + selected ideas + audit + revalidate).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = { table: string; op: string; payload?: unknown };

const h = vi.hoisted(() => ({
  profile: { id: "admin-1", role: "admin" } as { id: string; role: string } | null,
  aiKey: true,
  calls: [] as Call[],
  responses: {} as Record<string, { data: unknown; error: unknown }>,
  campaignResult: { ok: true, data: null as unknown, generationId: "11111111-1111-4111-8111-111111111111", model: "claude-opus-5" } as Record<string, unknown>,
  ideasResult: { ok: true, data: null as unknown, generationId: null, model: "claude-opus-5" } as Record<string, unknown>,
  audit: [] as unknown[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async (e: unknown) => void h.audit.push(e)) }));
vi.mock("@/lib/studio/auth", () => ({
  requireStudioAdmin: vi.fn(async () => {
    if (!h.profile) throw new Error("Unauthorized");
    return h.profile;
  }),
}));
vi.mock("@/lib/studio/ai", () => ({
  resolveAiConfig: vi.fn(async () => ({ provider: "anthropic", model: "claude-opus-5" })),
  isAiAvailable: vi.fn(() => h.aiKey),
  generateCampaign: vi.fn(async () => h.campaignResult),
  generateIdeas: vi.fn(async () => h.ideasResult),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const call: Call = { table, op: "select" };
      h.calls.push(call);
      const resolve = () => h.responses[`${table}.${call.op}`] ?? { data: null, error: null };
      const b: Record<string, unknown> = {};
      for (const m of ["eq", "in", "order", "limit", "select", "neq", "not", "or", "contains"]) b[m] = () => b;
      for (const m of ["insert", "update", "delete"]) {
        b[m] = (payload: unknown) => {
          call.op = m;
          call.payload = payload;
          return b;
        };
      }
      b.single = async () => resolve();
      b.maybeSingle = async () => resolve();
      (b as { then: unknown }).then = (r: (v: unknown) => unknown) => Promise.resolve(resolve()).then(r);
      return b;
    },
  }),
  createServiceClient: () => {
    throw new Error("service client must not be used in studio server actions");
  },
}));

async function load() {
  return import("@/app/(dashboard)/studio/director/actions");
}

const idea = {
  title: "3 สิ่งที่นักสืบสังเกตก่อนรับเคสนอกใจ",
  hook: "คุณสังเกตข้อนี้ไหม",
  description: "อธิบายสัญญาณ 3 อย่าง",
  pillar: "detective_knowledge",
  platforms: ["tiktok", "instagram_reel"],
  format: "short_video",
  source_refs: [{ kind: "knowledge", id: "22222222-2222-4222-8222-222222222222", label: "คู่มือเฝ้าติดตาม" }],
  ai_scores: { hook: 4, educational: 5, conversion: 3, originality: 4 },
  tags: ["นอกใจ", "GPS"],
};

const proposal = {
  title: "แคมเปญนอกใจ สัปดาห์หน้า",
  interpretation: {
    objective: "ให้ความรู้",
    audience: "คนที่กำลังสงสัยคู่ครอง",
    platforms: ["tiktok", "instagram_reel"],
    pillar_focus: ["detective_knowledge", "red_flags"],
    tone: "มืออาชีพ",
    post_count: 5,
    cta: "ทัก LINE",
  },
  ideas: [idea],
  mix_note: "เน้นความรู้ 60%",
  knowledge_gaps: ["ยังไม่มีข้อมูลเรื่องกฎหมายหลักฐานดิจิทัล"],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.profile = { id: "admin-1", role: "admin" };
  h.aiKey = true;
  h.calls = [];
  h.audit = [];
  h.responses = {};
  h.campaignResult = { ok: true, data: proposal, generationId: "11111111-1111-4111-8111-111111111111", model: "claude-opus-5" };
  h.ideasResult = { ok: true, data: { ideas: [idea], knowledge_gaps: [] }, generationId: null, model: "claude-opus-5" };
});

describe("proposeCampaign", () => {
  it("rejects a too-short brief before calling AI", async () => {
    const { proposeCampaign } = await load();
    const res = await proposeCampaign({ request: "สั้น" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/บรีฟสั้นเกินไป/);
  });

  it("throws for non-admins", async () => {
    h.profile = null;
    const { proposeCampaign } = await load();
    await expect(proposeCampaign({ request: "อาทิตย์หน้าสร้าง 5 คอนเทนต์" })).rejects.toThrow("Unauthorized");
  });

  it("returns an honest error when AI is not configured", async () => {
    h.aiKey = false;
    const { proposeCampaign } = await load();
    const res = await proposeCampaign({ request: "อาทิตย์หน้าสร้าง 5 คอนเทนต์ เน้นงานนอกใจ" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/AI ยังใช้งานไม่ได้/);
  });

  it("surfaces RunResult.error verbatim", async () => {
    h.campaignResult = { ok: false, error: "AI ปฏิเสธคำขอนี้", code: "refused", generationId: null };
    const { proposeCampaign } = await load();
    const res = await proposeCampaign({ request: "อาทิตย์หน้าสร้าง 5 คอนเทนต์ เน้นงานนอกใจ" });
    expect(res).toEqual({ ok: false, error: "AI ปฏิเสธคำขอนี้" });
  });

  it("returns the proposal with generation metadata", async () => {
    const { proposeCampaign } = await load();
    const res = await proposeCampaign({ request: "อาทิตย์หน้าสร้าง 5 คอนเทนต์ เน้นงานนอกใจ TikTok กับ IG" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.proposal.ideas).toHaveLength(1);
      expect(res.data.model).toBe("claude-opus-5");
      expect(res.data.generationId).toBe("11111111-1111-4111-8111-111111111111");
    }
  });

  it("passes a tone instruction into refine", async () => {
    const ai = await import("@/lib/studio/ai");
    const { proposeCampaign } = await load();
    await proposeCampaign({ request: "อาทิตย์หน้าสร้าง 5 คอนเทนต์ เน้นงานนอกใจ", refine: { previousIdeas: ["a"], tone: "friendly" } });
    const arg = (ai.generateCampaign as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)?.[0] as { refine: { instruction: string; previousIdeas: string[] } };
    expect(arg.refine.previousIdeas).toEqual(["a"]);
    expect(arg.refine.instruction).toMatch(/เป็นกันเอง/);
  });
});

describe("generateMoreIdeas / replaceIdea", () => {
  it("filters out ideas whose titles already exist on screen", async () => {
    const { generateMoreIdeas } = await load();
    const res = await generateMoreIdeas({ request: "อาทิตย์หน้าสร้าง 5 คอนเทนต์ เน้นงานนอกใจ", existingTitles: [idea.title], count: 3 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/ซ้ำ/);
  });

  it("returns fresh ideas", async () => {
    const { generateMoreIdeas } = await load();
    const res = await generateMoreIdeas({ request: "อาทิตย์หน้าสร้าง 5 คอนเทนต์ เน้นงานนอกใจ", existingTitles: ["อื่น"], count: 3 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.ideas).toHaveLength(1);
  });

  it("replaceIdea surfaces AI errors", async () => {
    h.ideasResult = { ok: false, error: "สร้างด้วย AI ไม่สำเร็จ", code: "failed", generationId: null };
    const { replaceIdea } = await load();
    const res = await replaceIdea({ request: "อาทิตย์หน้าสร้าง 5 คอนเทนต์ เน้นงานนอกใจ", avoidTitle: "x", existingTitles: [] });
    expect(res).toEqual({ ok: false, error: "สร้างด้วย AI ไม่สำเร็จ" });
  });
});

describe("createCampaign", () => {
  const input = {
    request: "อาทิตย์หน้าสร้าง 5 คอนเทนต์ เน้นงานนอกใจ TikTok กับ IG",
    title: proposal.title,
    interpretation: proposal.interpretation,
    mix_note: proposal.mix_note,
    knowledge_gaps: proposal.knowledge_gaps,
    ideas: [idea],
    generationId: "11111111-1111-4111-8111-111111111111",
  };

  it("rejects when no ideas are selected", async () => {
    const { createCampaign } = await load();
    const res = await createCampaign({ ...input, ideas: [] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/อย่างน้อย 1 ไอเดีย/);
  });

  it("rejects an invalid pillar", async () => {
    const { createCampaign } = await load();
    const res = await createCampaign({ ...input, ideas: [{ ...idea, pillar: "not_a_pillar" }] });
    expect(res.ok).toBe(false);
  });

  it("inserts campaign + ideas, audits, and returns the id", async () => {
    h.responses["studio_campaigns.insert"] = { data: { id: "33333333-3333-4333-8333-333333333333" }, error: null };
    h.responses["studio_ideas.insert"] = { data: null, error: null };
    const { createCampaign } = await load();
    const res = await createCampaign(input);
    expect(res).toEqual({ ok: true, data: { id: "33333333-3333-4333-8333-333333333333", ideaCount: 1 } });

    const campaignInsert = h.calls.find((c) => c.table === "studio_campaigns" && c.op === "insert")?.payload as Record<string, unknown>;
    expect(campaignInsert.status).toBe("active");
    expect(campaignInsert.pillar).toBe("detective_knowledge");
    expect((campaignInsert.brief as Record<string, unknown>).request).toBe(input.request);
    expect(campaignInsert.created_by).toBe("admin-1");

    const ideasInsert = h.calls.find((c) => c.table === "studio_ideas" && c.op === "insert")?.payload as Record<string, unknown>[];
    expect(ideasInsert).toHaveLength(1);
    expect(ideasInsert[0]).toMatchObject({ origin: "ai", status: "saved", campaign_id: "33333333-3333-4333-8333-333333333333", generation_id: input.generationId });

    expect(h.audit).toHaveLength(1);
    expect((h.audit[0] as { action: string }).action).toBe("STUDIO_CAMPAIGN_CREATE");
    const { revalidatePath } = await import("next/cache");
    expect(revalidatePath).toHaveBeenCalledWith("/studio/ideas");
  });

  it("reports a campaign insert failure", async () => {
    h.responses["studio_campaigns.insert"] = { data: null, error: { message: "permission denied" } };
    const { createCampaign } = await load();
    const res = await createCampaign(input);
    expect(res.ok).toBe(false);
    expect(h.audit).toHaveLength(0);
  });
});
