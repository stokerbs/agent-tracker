import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  rows: [] as Row[],
  inserts: [] as Row[],
  updates: [] as { payload: Row; ids: unknown }[],
  ai: null as null | { ok: true; data: Row; generationId: string; model: string } | { ok: false; error: string; code: string; generationId: null },
  aiCalls: 0,
}));

vi.mock("@/lib/studio/ai/actions/consolidate", () => ({
  consolidateKnowledgeBatch: vi.fn(async () => {
    h.aiCalls += 1;
    return h.ai;
  }),
  consolidateQuestionsBatch: vi.fn(async () => {
    h.aiCalls += 1;
    return h.ai;
  }),
}));
vi.mock("@/lib/studio/settings", () => ({ getStudioSettingsStrict: vi.fn(async () => ({ privacy_rules: { denylist: [], custom_patterns: [], strict_mode: false } })) }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => {
      const st = { op: "select", inIds: null as unknown, payload: null as Row | null };
      const b: Record<string, unknown> = {};
      for (const m of ["select", "contains", "is", "eq", "order", "limit", "in", "maybeSingle"]) b[m] = (...a: unknown[]) => ((m === "in" && (st.inIds = a[1])), b);
      b.single = () => b;
      b.insert = (row: Row) => ((st.op = "insert"), (st.payload = row), h.inserts.push(row), b);
      b.update = (row: Row) => ((st.op = "update"), (st.payload = row), b);
      b.then = (resolve: (v: unknown) => unknown) => {
        if (st.op === "update") h.updates.push({ payload: st.payload!, ids: st.inIds });
        const data = st.op === "select" ? h.rows : st.op === "insert" ? { id: `canon-${h.inserts.length}` } : null;
        return Promise.resolve(resolve({ data, error: null }));
      };
      return b;
    },
  }),
}));

const K = (i: number, title: string, category = "surveillance") => ({ id: `k${i}`, title, content: `เนื้อหาความรู้ข้อที่ ${i} ยาวพอสำหรับการทดสอบการรวม`, category, tags: ["line-import"] });

beforeEach(() => {
  h.rows = [];
  h.inserts = [];
  h.updates = [];
  h.aiCalls = 0;
  h.ai = { ok: true, data: { groups: [] }, generationId: "g1", model: "m" };
});

describe("makeBatches / validGroups", () => {
  it("batches and folds a tiny tail into the previous batch", async () => {
    const { makeBatches } = await import("./consolidate");
    const b = makeBatches(Array.from({ length: 47 }, (_, i) => i), 45);
    expect(b).toHaveLength(1);
    expect(b[0]).toHaveLength(47);
    expect(makeBatches(Array.from({ length: 92 }, (_, i) => i), 45).map((x) => x.length)).toEqual([45, 47]);
    expect(makeBatches(Array.from({ length: 95 }, (_, i) => i), 45).map((x) => x.length)).toEqual([45, 45, 5]);
  });
  it("rejects singleton, out-of-range and overlapping groups", async () => {
    const { validGroups } = await import("./consolidate");
    const g = validGroups([{ member_ids: [0, 1] }, { member_ids: [1, 2] }, { member_ids: [3] }, { member_ids: [4, 99] }, { member_ids: [5, 5, 6] }], 10);
    expect(g.map((x) => x.member_ids)).toEqual([[0, 1], [5, 6]]);
  });
});

describe("consolidateKnowledge", () => {
  it("dry-run counts batches without AI or writes", async () => {
    h.rows = [K(1, "a"), K(2, "b"), K(3, "c")];
    const { consolidateKnowledge } = await import("./consolidate");
    const r = await consolidateKnowledge({ dryRun: true });
    expect(r.scanned).toBe(3);
    expect(r.batches).toBe(1);
    expect(h.aiCalls).toBe(0);
    expect(h.inserts).toHaveLength(0);
  });
  it("inserts one canonical row per group and supersedes members", async () => {
    h.rows = [K(1, "ยืนยันเป้าหมายก่อนตาม"), K(2, "ยืนยันตัวเป้าหมายก่อนเริ่ม"), K(3, "อย่างอื่น")];
    h.ai = { ok: true, generationId: "g7", model: "m", data: { groups: [{ member_ids: [0, 1], title: "ยืนยันตัวเป้าหมายก่อนเริ่มติดตาม", content: "ก่อนเริ่มติดตามต้องยืนยันตัวเป้าหมายด้วยรูปและการแต่งกายของวันนั้น เพื่อไม่ตามผิดคน", category: "surveillance", tags: ["identification"], confidence: "high" }] } };
    const { consolidateKnowledge } = await import("./consolidate");
    const r = await consolidateKnowledge({ userId: "u1" });
    expect(r.groups).toBe(1);
    expect(r.merged).toBe(2);
    expect(h.inserts[0]).toMatchObject({ approved_for_content: false, member_count: 2, category: "surveillance" });
    expect(h.inserts[0].tags).toEqual(expect.arrayContaining(["line-import", "consolidated"]));
    expect(String(h.inserts[0].origin_ref)).toContain("consolidate:g7");
    const sup = h.updates.find((u) => u.payload.superseded_by);
    expect(sup?.ids).toEqual(["k1", "k2"]);
  });
  it("drops a canonical row that still carries an identifier", async () => {
    h.rows = [K(1, "a"), K(2, "b")];
    h.ai = { ok: true, generationId: "g8", model: "m", data: { groups: [{ member_ids: [0, 1], title: "ลูกค้าโทร 081-234-5678", content: "ลูกค้ารายหนึ่งโทรมาที่เบอร์ 081-234-5678 เพื่อขอคำปรึกษาเบื้องต้นก่อนเริ่ม", category: "services", tags: [], confidence: "high" }] } };
    const { consolidateKnowledge } = await import("./consolidate");
    const r = await consolidateKnowledge({});
    expect(r.dropped).toBe(1);
    expect(h.inserts).toHaveLength(0);
  });
  it("records AI errors and continues", async () => {
    h.rows = [K(1, "a"), K(2, "b")];
    h.ai = { ok: false, error: "AI ล้มเหลว", code: "failed", generationId: null };
    const { consolidateKnowledge } = await import("./consolidate");
    const r = await consolidateKnowledge({});
    expect(r.errors[0]).toContain("AI ล้มเหลว");
  });
});
