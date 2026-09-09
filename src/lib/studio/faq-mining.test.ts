import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  inbox: [] as Row[],
  existing: null as Row | null,
  inserts: [] as Row[],
  updates: [] as Row[],
  deleted: [] as Row[],
  insertError: null as null | { code: string; message: string },
  settingsDown: false,
  raceWinner: null as Row | null,
  ai: null as null | { ok: true; data: { questions: Row[] }; generationId: string; model: string } | { ok: false; error: string; code: string; generationId: null },
}));

vi.mock("@/lib/studio/ai/actions/knowledge", () => ({ extractCustomerFAQs: vi.fn(async () => h.ai) }));
vi.mock("@/lib/studio/settings", () => ({
  getStudioSettingsStrict: vi.fn(async () => {
    if (h.settingsDown) throw new Error("studio settings unavailable");
    return { privacy_rules: { denylist: [], custom_patterns: [], strict_mode: false } };
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const st = { op: "select" as string, single: false };
      const b: Record<string, unknown> = {};
      for (const m of ["select", "is", "order", "limit", "or", "in", "lt", "gte", "not", "eq"]) b[m] = () => b;
      b.maybeSingle = () => ((st.single = true), b);
      b.insert = (row: Row) => ((st.op = "insert"), h.inserts.push({ table, ...row }), b);
      b.eq = (col: string, v: unknown) => ((st as { eqKey?: unknown }).eqKey = col === "normalized_key" ? v : (st as { eqKey?: unknown }).eqKey, b);
      b.update = (row: Row) => ((st.op = "update"), h.updates.push({ table, ...row }), b);
      b.delete = () => ((st.op = "delete"), b);
      b.then = (resolve: (v: unknown) => unknown) => {
        let data: unknown = null;
        let error: unknown = null;
        if (st.op === "select") {
          if (table === "studio_line_inbox") data = h.inbox;
          if (table === "studio_customer_questions") data = st.single ? ((st as { eqKey?: unknown }).eqKey ? h.raceWinner : h.existing) : [];
        } else if (st.op === "delete") data = h.deleted;
        else if (st.op === "insert" && table === "studio_customer_questions" && h.insertError) error = h.insertError;
        return Promise.resolve(resolve({ data, error, count: 0 }));
      };
      return b;
    },
  }),
}));

const msg = (i: number, sender = "s1") => ({ id: `m${i}`, sender_hash: sender, text_redacted: `ข้อความ ${i}`, received_at: "2026-09-01T00:00:00Z" });

beforeEach(() => {
  h.inbox = [];
  h.existing = null;
  h.inserts = [];
  h.updates = [];
  h.deleted = [];
  h.insertError = null;
  h.raceWinner = null;
  h.settingsDown = false;
  h.ai = { ok: true, data: { questions: [] }, generationId: "g1", model: "m" };
});

describe("normalizeQuestionKey", () => {
  it("folds case, punctuation, whitespace and trailing particles", async () => {
    const { normalizeQuestionKey } = await import("./faq-mining");
    expect(normalizeQuestionKey("ติด GPS รถแฟนได้ไหม?")).toBe(normalizeQuestionKey("ติด gps รถแฟน ได้ไหมคะ"));
    expect(normalizeQuestionKey("ราคาเท่าไหร่ครับ")).toBe(normalizeQuestionKey("ราคาเท่าไหร่"));
  });
});

describe("mineLineInbox", () => {
  it("skips when too few messages (still purges)", async () => {
    h.inbox = [msg(1), msg(2)];
    const { mineLineInbox } = await import("./faq-mining");
    const r = await mineLineInbox({ userId: "u1" });
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("too_few");
    expect(h.inserts).toHaveLength(0);
  });
  it("inserts new questions, merges duplicates, marks processed", async () => {
    h.inbox = [msg(1), msg(2, "s2"), msg(3), msg(4, "s3"), msg(5)];
    h.ai = {
      ok: true,
      generationId: "g9",
      model: "m",
      data: { questions: [{ question: "ติด GPS รถแฟนได้ไหม", answer_hint: "มีข้อจำกัดทางกฎหมาย", frequency: 3, tags: ["gps"], content_idea: "x" }] },
    };
    const { mineLineInbox } = await import("./faq-mining");
    const r = await mineLineInbox({ userId: "u1" });
    expect(r.ok).toBe(true);
    expect(r.inserted).toBe(1);
    const q = h.inserts.find((i) => i.table === "studio_customer_questions");
    expect(q).toMatchObject({ source: "line_oa", approved_for_content: false, frequency: 3 });
    expect(h.updates.some((u) => u.table === "studio_line_inbox" && u.batch_id === "g9")).toBe(true);

    // second run with an existing match → merge
    h.inserts = [];
    h.existing = { id: "q1", frequency: 4, tags: ["เดิม"], answer_hint: "" };
    const r2 = await mineLineInbox({ userId: "u1" });
    expect(r2.merged).toBe(1);
    const upd = h.updates.find((u) => u.table === "studio_customer_questions");
    expect(upd).toMatchObject({ frequency: 7 });
    expect(upd?.tags).toEqual(expect.arrayContaining(["เดิม", "gps"]));
  });
  it("drops mined questions that still carry an identifier", async () => {
    h.inbox = Array.from({ length: 6 }, (_, i) => msg(i));
    h.ai = { ok: true, generationId: "g2", model: "m", data: { questions: [{ question: "คุณสมชาย 081-234-5678 ตามได้ไหม", answer_hint: null, frequency: 1, tags: [], content_idea: "" }] } };
    const { mineLineInbox } = await import("./faq-mining");
    const r = await mineLineInbox({ userId: null });
    expect(r.ok).toBe(true);
    expect(r.dropped).toBe(1);
    expect(h.inserts.filter((i) => i.table === "studio_customer_questions")).toHaveLength(0);
  });
  it("only marks the messages that fit the prompt window as processed", async () => {
    const { mineLineInbox, MAX_PROMPT_CHARS } = await import("./faq-mining");
    const big = "ก".repeat(Math.floor(MAX_PROMPT_CHARS * 0.6));
    h.inbox = [ { ...msg(1, "a"), text_redacted: big }, { ...msg(2, "b"), text_redacted: big }, msg(3, "c"), msg(4, "d"), msg(5, "e") ];
    const r = await mineLineInbox({ userId: null });
    expect(r.ok).toBe(true);
    expect(r.messages).toBeLessThan(5);
  });
  it("merges instead of losing a question when the unique key insert races (23505)", async () => {
    h.inbox = Array.from({ length: 6 }, (_, i) => msg(i));
    h.ai = { ok: true, generationId: "g5", model: "m", data: { questions: [{ question: "ราคาเท่าไหร่", answer_hint: null, frequency: 2, tags: ["ราคา"], content_idea: "" }] } };
    h.insertError = { code: "23505", message: "duplicate key" };
    h.raceWinner = { id: "q-win", frequency: 3, tags: [] };
    const { mineLineInbox } = await import("./faq-mining");
    const r = await mineLineInbox({ userId: null });
    expect(r.inserted).toBe(0);
    expect(r.merged).toBe(1);
    expect(h.updates.find((u) => u.table === "studio_customer_questions")).toMatchObject({ frequency: 5 });
  });
  it("fills a huge single-sender block message by message and marks only what fit", async () => {
    const { mineLineInbox, MAX_PROMPT_CHARS } = await import("./faq-mining");
    const big = "ก".repeat(Math.floor(MAX_PROMPT_CHARS / 3));
    h.inbox = Array.from({ length: 6 }, (_, i) => ({ ...msg(i, "same"), text_redacted: big }));
    const r = await mineLineInbox({ userId: null });
    expect(r.ok).toBe(true);
    expect(r.messages).toBeGreaterThan(0);
    expect(r.messages).toBeLessThan(6);
  });
  it("does not mine when the privacy settings cannot be loaded", async () => {
    h.inbox = Array.from({ length: 6 }, (_, i) => msg(i));
    h.settingsDown = true;
    const { mineLineInbox } = await import("./faq-mining");
    const r = await mineLineInbox({ userId: null });
    expect(r.ok).toBe(false);
    expect(h.updates.some((u) => u.table === "studio_line_inbox")).toBe(false);
  });
  it("returns the AI error without marking messages processed", async () => {
    h.inbox = Array.from({ length: 6 }, (_, i) => msg(i));
    h.ai = { ok: false, error: "AI ล้มเหลว", code: "failed", generationId: null };
    const { mineLineInbox } = await import("./faq-mining");
    const r = await mineLineInbox({ userId: null });
    expect(r.ok).toBe(false);
    expect(h.updates.some((u) => u.table === "studio_line_inbox")).toBe(false);
  });
});
