/**
 * Idea Bank action tests: status/edit/duplicate validation, owner idea insert,
 * AI suggestion error surfacing, and the editor bridge generateContentFromIdea
 * (draft + sources + claims + privacy check; draft survives AI failure).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = { table: string; op: string; payload?: unknown; filters: unknown[] };

const IDEA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MASTER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const K_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const h = vi.hoisted(() => ({
  profile: { id: "admin-1", role: "admin" } as { id: string; role: string } | null,
  aiKey: true,
  calls: [] as Call[],
  responses: {} as Record<string, { data: unknown; error: unknown }>,
  ideasResult: {} as Record<string, unknown>,
  scriptResult: {} as Record<string, unknown>,
  privacyResult: { status: "safe", findings: [], summary: "", suggestions: [], checked_by: "deterministic", model: null } as Record<string, unknown>,
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
  generateIdeas: vi.fn(async () => h.ideasResult),
  generateScript: vi.fn(async () => h.scriptResult),
  runPrivacyCheck: vi.fn(async () => h.privacyResult),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const call: Call = { table, op: "select", filters: [] };
      h.calls.push(call);
      const resolve = () => h.responses[`${table}.${call.op}`] ?? { data: null, error: null };
      const b: Record<string, unknown> = {};
      for (const m of ["in", "order", "limit", "select", "neq", "not", "or", "contains"]) b[m] = () => b;
      b.eq = (...args: unknown[]) => {
        call.filters.push(args);
        return b;
      };
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
  return import("@/app/(dashboard)/studio/ideas/actions");
}

const ideaRow = {
  id: IDEA_ID,
  title: "ข้อจำกัดของ GPS ติดรถที่คนไม่ค่อยรู้",
  hook: "GPS บอกตำแหน่งได้ แต่ไม่บอกว่าใครขับ",
  description: "อธิบายข้อจำกัด 3 ข้อ",
  pillar: "detective_knowledge",
  platforms: ["instagram_reel", "tiktok"],
  format: "short_video",
  origin: "ai",
  source_refs: [{ kind: "knowledge", id: K_ID, label: "คู่มือ GPS" }],
  ai_scores: { hook: 4, educational: 5, conversion: 3, originality: 4 },
  status: "saved",
  tags: ["GPS"],
  campaign_id: null,
  generation_id: null,
  created_by: "admin-1",
  created_at: "2026-09-09T00:00:00Z",
  updated_at: "2026-09-09T00:00:00Z",
};

const script = {
  hook: "GPS บอกตำแหน่งได้ แต่ไม่บอกว่าใครขับ",
  script: "สคริปต์ 45 วินาที",
  caption: "แคปชัน",
  cta: "ทัก LINE",
  estimated_duration_sec: 44,
  ai_notes: "หมายเหตุ",
  source_refs: [
    { kind: "knowledge", id: K_ID, label: "คู่มือ GPS" },
    { kind: "ai_general", id: null, label: "ความรู้ทั่วไปของ AI" },
  ],
  claims: [
    { claim: "GPS ระบุตำแหน่งรถ ไม่ใช่คน", support_status: "supported", source: { kind: "knowledge", id: K_ID, label: "คู่มือ GPS" } },
    { claim: "สัญญาณหายในอาคารจอดรถ", support_status: "ai_suggestion", source: null },
  ],
};

function calls(table: string, op: string) {
  return h.calls.filter((c) => c.table === table && c.op === op);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.profile = { id: "admin-1", role: "admin" };
  h.aiKey = true;
  h.calls = [];
  h.audit = [];
  h.responses = {
    "studio_ideas.select": { data: ideaRow, error: null },
    "studio_ideas.update": { data: { id: IDEA_ID }, error: null },
    "studio_content_masters.insert": { data: { id: MASTER_ID }, error: null },
  };
  h.ideasResult = { ok: true, data: { ideas: [], knowledge_gaps: [] }, generationId: null, model: "claude-opus-5" };
  h.scriptResult = { ok: true, data: script, generationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", model: "claude-opus-5" };
  h.privacyResult = { status: "safe", findings: [], summary: "", suggestions: [], checked_by: "deterministic", model: null };
});

describe("setIdeaStatus", () => {
  it("rejects unknown statuses and bad ids", async () => {
    const { setIdeaStatus } = await load();
    expect((await setIdeaStatus({ id: IDEA_ID, status: "generated" })).ok).toBe(false);
    expect((await setIdeaStatus({ id: "nope", status: "saved" })).ok).toBe(false);
  });
  it("updates and revalidates", async () => {
    const { setIdeaStatus } = await load();
    const res = await setIdeaStatus({ id: IDEA_ID, status: "rejected" });
    expect(res).toEqual({ ok: true, data: { id: IDEA_ID, status: "rejected" } });
    expect(calls("studio_ideas", "update")[0].payload).toEqual({ status: "rejected" });
  });
  it("reports a missing row", async () => {
    h.responses["studio_ideas.update"] = { data: null, error: null };
    const { setIdeaStatus } = await load();
    expect(await setIdeaStatus({ id: IDEA_ID, status: "saved" })).toEqual({ ok: false, error: "ไม่พบไอเดียนี้" });
  });
  it("throws for non-admins", async () => {
    h.profile = null;
    const { setIdeaStatus } = await load();
    await expect(setIdeaStatus({ id: IDEA_ID, status: "saved" })).rejects.toThrow("Unauthorized");
  });
});

describe("createOwnerIdea / updateIdea / duplicateIdea", () => {
  it("validates title length", async () => {
    const { createOwnerIdea } = await load();
    const res = await createOwnerIdea({ title: "ab", pillar: "service" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/สั้นเกินไป/);
  });
  it("inserts an owner idea as saved with deduped tags", async () => {
    h.responses["studio_ideas.insert"] = { data: { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }, error: null };
    const { createOwnerIdea } = await load();
    const res = await createOwnerIdea({ title: "ไอเดียของฉัน", pillar: "service", platforms: ["facebook"], tags: ["a", "a", "b"] });
    expect(res.ok).toBe(true);
    const payload = calls("studio_ideas", "insert")[0].payload as Record<string, unknown>;
    expect(payload).toMatchObject({ origin: "owner", status: "saved", tags: ["a", "b"], created_by: "admin-1" });
  });
  it("updateIdea writes the edited fields", async () => {
    const { updateIdea } = await load();
    const res = await updateIdea({ id: IDEA_ID, title: "ชื่อใหม่", pillar: "red_flags", platforms: ["tiktok"], format: "carousel", tags: [] });
    expect(res.ok).toBe(true);
    expect(calls("studio_ideas", "update")[0].payload).toMatchObject({ title: "ชื่อใหม่", pillar: "red_flags", format: "carousel", hook: null });
  });
  it("duplicateIdea copies the row as new with a (สำเนา) suffix", async () => {
    h.responses["studio_ideas.insert"] = { data: { id: "ffffffff-ffff-4fff-8fff-ffffffffffff" }, error: null };
    const { duplicateIdea } = await load();
    const res = await duplicateIdea({ id: IDEA_ID });
    expect(res.ok).toBe(true);
    expect(calls("studio_ideas", "insert")[0].payload).toMatchObject({ title: `${ideaRow.title} (สำเนา)`, status: "new", origin: "ai" });
  });
});

describe("suggestIdeas / saveSuggestedIdeas", () => {
  it("returns an honest error when AI is off", async () => {
    h.aiKey = false;
    const { suggestIdeas } = await load();
    const res = await suggestIdeas({ brief: "ไอเดียเรื่อง GPS ติดรถ", count: 5 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/AI ยังใช้งานไม่ได้/);
  });
  it("surfaces RunResult.error", async () => {
    h.ideasResult = { ok: false, error: "สร้างด้วย AI ไม่สำเร็จ", code: "failed", generationId: null };
    const { suggestIdeas } = await load();
    expect(await suggestIdeas({ brief: "ไอเดียเรื่อง GPS ติดรถ" })).toEqual({ ok: false, error: "สร้างด้วย AI ไม่สำเร็จ" });
  });
  it("saves selected suggestions as ai/new", async () => {
    h.responses["studio_ideas.insert"] = { data: [{ id: "1" }, { id: "2" }], error: null };
    const { saveSuggestedIdeas } = await load();
    const gi = { title: "x", hook: "", description: "", pillar: "service", platforms: ["tiktok"], format: "post", source_refs: [], ai_scores: { hook: 3, educational: 3, conversion: 3, originality: 3 }, tags: [] };
    const res = await saveSuggestedIdeas({ ideas: [gi, { ...gi, title: "y" }], generationId: null });
    expect(res).toEqual({ ok: true, data: { ids: ["1", "2"] } });
    const rows = calls("studio_ideas", "insert")[0].payload as Record<string, unknown>[];
    expect(rows.every((r) => r.origin === "ai" && r.status === "new")).toBe(true);
  });
});

describe("generateContentFromIdea", () => {
  it("rejects an invalid target duration", async () => {
    const { generateContentFromIdea } = await load();
    const res = await generateContentFromIdea({ ideaId: IDEA_ID, targetSeconds: 50 });
    expect(res.ok).toBe(false);
  });

  it("reports a missing idea", async () => {
    h.responses["studio_ideas.select"] = { data: null, error: null };
    const { generateContentFromIdea } = await load();
    expect(await generateContentFromIdea({ ideaId: IDEA_ID })).toEqual({ ok: false, error: "ไม่พบไอเดียนี้" });
    expect(calls("studio_content_masters", "insert")).toHaveLength(0);
  });

  it("creates the draft, script, deduped sources, claims, privacy check and marks the idea generated", async () => {
    const { generateContentFromIdea } = await load();
    const res = await generateContentFromIdea({ ideaId: IDEA_ID, platform: "tiktok", targetSeconds: 30 });
    expect(res).toEqual({ ok: true, data: { id: MASTER_ID } });

    const master = calls("studio_content_masters", "insert")[0].payload as Record<string, unknown>;
    expect(master).toMatchObject({ idea_id: IDEA_ID, title: ideaRow.title, pillar: "detective_knowledge", status: "draft", primary_platform: "tiktok", target_duration_sec: 30, tags: ["GPS"], created_by: "admin-1" });

    const update = calls("studio_content_masters", "update")[0].payload as Record<string, unknown>;
    expect(update).toMatchObject({ script: script.script, caption: script.caption, cta: script.cta, estimated_duration_sec: 44 });

    // idea refs first, then a full replace with idea ∪ script refs (knowledge deduped → 2 rows)
    const sourceInserts = calls("studio_content_sources", "insert");
    expect(sourceInserts).toHaveLength(2);
    expect(calls("studio_content_sources", "delete")).toHaveLength(1);
    const merged = sourceInserts[1].payload as Record<string, unknown>[];
    expect(merged).toHaveLength(2);
    expect(merged.map((r) => r.source_kind)).toEqual(["knowledge", "ai_general"]);

    const claims = calls("studio_content_claims", "insert")[0].payload as Record<string, unknown>[];
    expect(claims).toHaveLength(2);
    expect(claims[0]).toMatchObject({ master_id: MASTER_ID, support_status: "supported", source_kind: "knowledge", source_id: K_ID });
    expect(claims[1]).toMatchObject({ support_status: "ai_suggestion", source_kind: null, source_id: null });

    const privacy = calls("studio_privacy_checks", "insert")[0].payload as Record<string, unknown>;
    expect(privacy).toMatchObject({ master_id: MASTER_ID, status: "safe", checked_by: "deterministic" });

    const ideaUpdate = calls("studio_ideas", "update").at(-1);
    expect(ideaUpdate?.payload).toEqual({ status: "generated" });

    expect(h.audit).toHaveLength(1);
    expect((h.audit[0] as { action: string }).action).toBe("STUDIO_CONTENT_CREATE");
    const { revalidatePath } = await import("next/cache");
    expect(revalidatePath).toHaveBeenCalledWith("/studio/content");
  });

  it("defaults platform to the idea's first platform and 45 s", async () => {
    const { generateContentFromIdea } = await load();
    await generateContentFromIdea({ ideaId: IDEA_ID });
    const master = calls("studio_content_masters", "insert")[0].payload as Record<string, unknown>;
    expect(master).toMatchObject({ primary_platform: "instagram_reel", target_duration_sec: 45 });
  });

  it("keeps the draft and returns aiError when script generation fails", async () => {
    h.scriptResult = { ok: false, error: "AI ปฏิเสธคำขอนี้", code: "refused", generationId: null };
    const { generateContentFromIdea } = await load();
    const res = await generateContentFromIdea({ ideaId: IDEA_ID });
    expect(res).toEqual({ ok: true, data: { id: MASTER_ID, aiError: "AI ปฏิเสธคำขอนี้" } });
    expect(calls("studio_content_masters", "update")).toHaveLength(0);
    expect(calls("studio_content_claims", "insert")).toHaveLength(0);
    expect(calls("studio_privacy_checks", "insert")).toHaveLength(0);
    // idea refs were still copied onto the draft, idea still marked generated, audit recorded with ai_ok=false
    expect(calls("studio_content_sources", "insert")).toHaveLength(1);
    expect(calls("studio_ideas", "update").at(-1)?.payload).toEqual({ status: "generated" });
    expect((h.audit[0] as { metadata: { ai_ok: boolean } }).metadata.ai_ok).toBe(false);
  });

  it("creates an empty draft with aiError when AI is not configured", async () => {
    h.aiKey = false;
    const ai = await import("@/lib/studio/ai");
    const { generateContentFromIdea } = await load();
    const res = await generateContentFromIdea({ ideaId: IDEA_ID });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.aiError).toMatch(/AI ยังใช้งานไม่ได้/);
    expect(ai.generateScript).not.toHaveBeenCalled();
  });

  it("fails cleanly when the master insert fails", async () => {
    h.responses["studio_content_masters.insert"] = { data: null, error: { message: "boom" } };
    const { generateContentFromIdea } = await load();
    const res = await generateContentFromIdea({ ideaId: IDEA_ID });
    expect(res.ok).toBe(false);
    expect(h.audit).toHaveLength(0);
  });
});
