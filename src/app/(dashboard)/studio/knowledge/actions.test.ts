/**
 * Knowledge Base server-action tests: auth gate, zod validation, happy-path
 * inserts and the AI import preview. Supabase, auth, audit and the AI layer
 * are mocked (pattern: settings/security-actions.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Call { table: string; op: string; payload?: unknown }

const h = vi.hoisted(() => ({
  profile: { id: "admin-1", role: "admin" } as { id: string; role: string } | null,
  calls: [] as Call[],
  /** Result for the terminal `.single()` / `.maybeSingle()` / awaited builder. */
  result: { data: null as unknown, error: null as unknown },
  aiAvailable: true,
  aiResult: { ok: true, data: { questions: [] as unknown[] } } as unknown,
  audit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: h.audit }));
vi.mock("@/lib/studio/auth", () => ({
  requireStudioAdmin: vi.fn(async () => {
    if (!h.profile || h.profile.role !== "admin") throw new Error("Unauthorized");
    return h.profile;
  }),
}));
vi.mock("@/lib/studio/ai", () => ({
  isAiAvailable: () => h.aiAvailable,
  extractCustomerFAQs: vi.fn(async () => h.aiResult),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      const record = (op: string) => (payload?: unknown) => {
        h.calls.push({ table, op, payload });
        return b;
      };
      for (const m of ["select", "eq", "neq", "order", "limit", "ilike", "or"]) b[m] = record(m);
      b.insert = record("insert");
      b.update = record("update");
      b.delete = record("delete");
      b.single = () => Promise.resolve(h.result);
      b.maybeSingle = () => Promise.resolve(h.result);
      (b as { then: unknown }).then = (r: (v: unknown) => unknown) => r(h.result);
      return b;
    },
  }),
}));

async function load() {
  return import("./actions");
}

const validKnowledge = {
  title: "GPS บอกอะไรได้",
  content: "GPS ระบุตำแหน่งอุปกรณ์ ไม่ใช่ตัวบุคคล",
  summary: null,
  source_type: "investigator_knowledge",
  category: "gps",
  tags: ["gps", "gps", "หลักฐาน"],
  sensitivity: "public",
  approved_for_content: true,
  origin_ref: null,
};

beforeEach(() => {
  h.profile = { id: "admin-1", role: "admin" };
  h.calls = [];
  h.result = { data: { id: "11111111-1111-4111-8111-111111111111" }, error: null };
  h.aiAvailable = true;
  h.aiResult = { ok: true, data: { questions: [] } };
  h.audit.mockClear();
});

describe("createKnowledge", () => {
  it("throws when the caller is not a studio admin", async () => {
    h.profile = { id: "agent-1", role: "agent" };
    const { createKnowledge } = await load();
    await expect(createKnowledge(validKnowledge)).rejects.toThrow("Unauthorized");
    expect(h.calls).toHaveLength(0);
  });

  it("rejects invalid input without touching the database", async () => {
    const { createKnowledge } = await load();
    const res = await createKnowledge({ ...validKnowledge, title: "" });
    expect(res.ok).toBe(false);
    expect(h.calls).toHaveLength(0);
    const bad = await createKnowledge({ ...validKnowledge, category: "not-a-category" });
    expect(bad.ok).toBe(false);
  });

  it("inserts a row with created_by, de-duplicated tags and audits the approval", async () => {
    const { createKnowledge } = await load();
    const res = await createKnowledge(validKnowledge);
    expect(res).toEqual({ ok: true, data: { id: "11111111-1111-4111-8111-111111111111" } });
    const insert = h.calls.find((c) => c.op === "insert");
    expect(insert?.table).toBe("studio_knowledge_sources");
    expect(insert?.payload).toMatchObject({ title: validKnowledge.title, created_by: "admin-1", tags: ["gps", "หลักฐาน"], approved_for_content: true });
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "STUDIO_KNOWLEDGE_APPROVE" }));
  });

  it("surfaces a safe error when the insert fails", async () => {
    h.result = { data: null, error: { message: "duplicate key", code: "23505" } };
    const { createKnowledge } = await load();
    const res = await createKnowledge(validKnowledge);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("duplicate key");
  });
});

describe("setKnowledgeApproved", () => {
  it("rejects a non-uuid id", async () => {
    const { setKnowledgeApproved } = await load();
    const res = await setKnowledgeApproved("nope", true);
    expect(res.ok).toBe(false);
    expect(h.calls).toHaveLength(0);
  });

  it("updates the flag and writes an audit row", async () => {
    h.result = { data: null, error: null };
    const { setKnowledgeApproved } = await load();
    const res = await setKnowledgeApproved("11111111-1111-4111-8111-111111111111", false);
    expect(res).toEqual({ ok: true });
    expect(h.calls.find((c) => c.op === "update")?.payload).toEqual({ approved_for_content: false });
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "STUDIO_KNOWLEDGE_APPROVE", metadata: { approved: false } }));
  });
});

describe("customer questions", () => {
  it("createQuestion validates and inserts with defaults", async () => {
    const { createQuestion } = await load();
    expect((await createQuestion({ question: "" })).ok).toBe(false);
    const res = await createQuestion({ question: "ราคาเท่าไหร่", source: "line_oa" });
    expect(res.ok).toBe(true);
    expect(h.calls.find((c) => c.op === "insert")?.payload).toMatchObject({ question: "ราคาเท่าไหร่", source: "line_oa", frequency: 1, approved_for_content: false, created_by: "admin-1" });
  });

  it("extractQuestionsFromText refuses when AI is unavailable and never saves", async () => {
    h.aiAvailable = false;
    const { extractQuestionsFromText } = await load();
    const res = await extractQuestionsFromText({ text: "ลูกค้า: สืบชู้ราคาเท่าไหร่ครับ ใช้เวลากี่วัน", source: "line_oa" });
    expect(res.ok).toBe(false);
    expect(h.calls).toHaveLength(0);
  });

  it("extractQuestionsFromText returns a clamped preview from the AI layer", async () => {
    h.aiResult = { ok: true, data: { questions: [{ question: " ราคาเท่าไหร่ ", answer_hint: "ขึ้นกับความซับซ้อน", frequency: 0, tags: ["ราคา", ""], content_idea: "อธิบายปัจจัยราคา" }] } };
    const { extractQuestionsFromText } = await load();
    const res = await extractQuestionsFromText({ text: "ลูกค้า: สืบชู้ราคาเท่าไหร่ครับ ใช้เวลากี่วัน", source: "line_oa" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.questions[0]).toEqual({ question: "ราคาเท่าไหร่", answer_hint: "ขึ้นกับความซับซ้อน", frequency: 1, tags: ["ราคา"], content_idea: "อธิบายปัจจัยราคา" });
    expect(h.calls).toHaveLength(0);
  });

  it("saveExtractedQuestions forces approved_for_content=false", async () => {
    h.result = { data: [{ id: "a" }, { id: "b" }], error: null };
    const { saveExtractedQuestions } = await load();
    const res = await saveExtractedQuestions({ source: "line_oa", questions: [{ question: "Q1", answer_hint: "A1", frequency: 3, tags: [] }, { question: "Q2", frequency: 1, tags: ["x"] }] });
    expect(res).toEqual({ ok: true, data: { inserted: 2 } });
    const rows = h.calls.find((c) => c.op === "insert")?.payload as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.approved_for_content === false && r.source === "line_oa")).toBe(true);
  });

  it("createIdeaFromQuestion seeds an Idea Bank row with a customer_question source ref", async () => {
    const qid = "22222222-2222-4222-8222-222222222222";
    h.result = { data: { id: qid, question: "GPS ติดยังไง", answer_hint: "ต้องประเมินก่อน", tags: ["gps"] }, error: null };
    const { createIdeaFromQuestion } = await load();
    const res = await createIdeaFromQuestion(qid);
    expect(res.ok).toBe(true);
    const insert = h.calls.find((c) => c.op === "insert");
    expect(insert?.table).toBe("studio_ideas");
    expect(insert?.payload).toMatchObject({ origin: "question", status: "new", pillar: "detective_knowledge", source_refs: [{ kind: "customer_question", id: qid, label: "GPS ติดยังไง" }] });
  });
});
