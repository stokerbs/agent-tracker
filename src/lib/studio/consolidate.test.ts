import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type Filter = { table: string; m: string; args: unknown[] };
const h = vi.hoisted(() => ({
  /** Rows returned for a select on each table (paged by .range when present). */
  tables: {} as Record<string, Row[]>,
  inserts: [] as { table: string; row: Row }[],
  updates: [] as { table: string; payload: Row; ids: unknown; eqId: unknown }[],
  filters: [] as Filter[],
  /** Error returned by the next insert (once). */
  insertError: null as null | { code?: string; message: string },
  /** Row returned by .maybeSingle() lookups. */
  lookup: null as Row | null,
  ranges: [] as [number, number][],
  ai: null as null | { ok: true; data: Row; generationId: string; model: string } | { ok: false; error: string; code: string; generationId: null; transient?: boolean },
  /** Per-call AI results consumed before falling back to `ai`. */
  aiQueue: [] as unknown[],
  aiCalls: 0,
}));

vi.mock("@/lib/studio/ai/actions/consolidate", () => ({
  consolidateKnowledgeBatch: vi.fn(async () => {
    h.aiCalls += 1;
    return h.aiQueue.length ? h.aiQueue.shift() : h.ai;
  }),
  consolidateQuestionsBatch: vi.fn(async () => {
    h.aiCalls += 1;
    return h.aiQueue.length ? h.aiQueue.shift() : h.ai;
  }),
}));
vi.mock("@/lib/studio/settings", () => ({ getStudioSettingsStrict: vi.fn(async () => ({ privacy_rules: { denylist: [], custom_patterns: [], strict_mode: false } })) }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const st = { op: "select", inIds: null as unknown, eqId: null as unknown, payload: null as Row | null, range: null as null | [number, number] };
      const b: Record<string, unknown> = {};
      for (const m of ["select", "contains", "is", "eq", "neq", "order", "limit", "in"]) {
        b[m] = (...a: unknown[]) => {
          h.filters.push({ table, m, args: a });
          if (m === "in") st.inIds = a[1];
          if (m === "eq" && a[0] === "id") st.eqId = a[1];
          return b;
        };
      }
      b.range = (from: number, to: number) => ((st.range = [from, to]), h.ranges.push([from, to]), b);
      b.single = () => b;
      b.maybeSingle = () => ((st.op = "maybeSingle"), b);
      b.insert = (row: Row) => ((st.op = "insert"), (st.payload = row), b);
      b.update = (row: Row) => ((st.op = "update"), (st.payload = row), b);
      b.then = (resolve: (v: unknown) => unknown) => {
        let data: unknown = null;
        let error: unknown = null;
        if (st.op === "select") {
          const rows = h.tables[table] ?? [];
          data = st.range ? rows.slice(st.range[0], st.range[1] + 1) : rows;
        } else if (st.op === "insert") {
          if (h.insertError) {
            error = h.insertError;
            h.insertError = null;
          } else {
            h.inserts.push({ table, row: st.payload! });
            data = { id: `canon-${h.inserts.length}` };
          }
        } else if (st.op === "update") {
          h.updates.push({ table, payload: st.payload!, ids: st.inIds, eqId: st.eqId });
        } else if (st.op === "maybeSingle") {
          data = h.lookup;
        }
        return Promise.resolve(resolve({ data, error }));
      };
      return b;
    },
  }),
}));

const KT = "studio_knowledge_sources";
const QT = "studio_customer_questions";
const K = (i: number, title: string, category = "surveillance") => ({ id: `k${i}`, title, content: `เนื้อหาความรู้ข้อที่ ${i} ยาวพอสำหรับการทดสอบการรวม`, category, tags: ["line-import"], member_count: 1, sensitivity: "internal" });
const Q = (i: number, question: string, frequency = 1, member_count = 1) => ({ id: `q${i}`, question, answer_hint: null, frequency, tags: ["line-import"], normalized_key: question, member_count });
const GROUP_Q = (ids: number[], question = "บริการสืบราคาเท่าไหร่") => ({ ok: true as const, generationId: "gq", model: "m", data: { groups: [{ member_ids: ids, question, answer_hint: "ขึ้นกับขอบเขตงาน", tags: ["ราคา"] }] } });

beforeEach(() => {
  h.tables = {};
  h.inserts = [];
  h.updates = [];
  h.filters = [];
  h.ranges = [];
  h.insertError = null;
  h.lookup = null;
  h.aiCalls = 0;
  h.ai = { ok: true, data: { groups: [] }, generationId: "g1", model: "m" };
  h.aiQueue = [];
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
    h.tables[KT] = [K(1, "a"), K(2, "b"), K(3, "c")];
    const { consolidateKnowledge } = await import("./consolidate");
    const r = await consolidateKnowledge({ dryRun: true });
    expect(r.scanned).toBe(3);
    expect(r.batches).toBe(1);
    expect(h.aiCalls).toBe(0);
    expect(h.inserts).toHaveLength(0);
  });
  it("pages through the PostgREST 1000-row cap and never loads restricted rows", async () => {
    h.tables[KT] = Array.from({ length: 1002 }, (_, i) => K(i, `t${String(i).padStart(4, "0")}`));
    const { consolidateKnowledge } = await import("./consolidate");
    const r = await consolidateKnowledge({ dryRun: true });
    expect(r.scanned).toBe(1002);
    expect(h.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(h.filters.some((f) => f.table === KT && f.m === "neq" && f.args[0] === "sensitivity" && f.args[1] === "restricted")).toBe(true);
  });
  it("inserts one canonical row per group and supersedes members", async () => {
    h.tables[KT] = [K(1, "ยืนยันเป้าหมายก่อนตาม"), K(2, "ยืนยันตัวเป้าหมายก่อนเริ่ม"), K(3, "อย่างอื่น")];
    h.ai = { ok: true, generationId: "g7", model: "m", data: { groups: [{ member_ids: [0, 1], title: "ยืนยันตัวเป้าหมายก่อนเริ่มติดตาม", content: "ก่อนเริ่มติดตามต้องยืนยันตัวเป้าหมายด้วยรูปและการแต่งกายของวันนั้น เพื่อไม่ตามผิดคน", category: "surveillance", tags: ["identification"], confidence: "high" }] } };
    const { consolidateKnowledge } = await import("./consolidate");
    const r = await consolidateKnowledge({ userId: "u1" });
    expect(r.groups).toBe(1);
    expect(r.merged).toBe(2);
    expect(h.inserts[0].row).toMatchObject({ approved_for_content: false, member_count: 2, category: "surveillance" });
    expect(h.inserts[0].row.tags).toEqual(expect.arrayContaining(["line-import", "consolidated"]));
    expect(h.inserts[0].row.tags).not.toContain("ต้องตรวจ privacy");
    expect(String(h.inserts[0].row.origin_ref)).toContain("consolidate:g7");
    const sup = h.updates.find((u) => u.payload.superseded_by);
    expect(sup?.ids).toEqual(["k1", "k2"]);
  });
  it("drops a canonical row that still carries an identifier", async () => {
    h.tables[KT] = [K(1, "a"), K(2, "b")];
    h.ai = { ok: true, generationId: "g8", model: "m", data: { groups: [{ member_ids: [0, 1], title: "ลูกค้าโทร 081-234-5678", content: "ลูกค้ารายหนึ่งโทรมาที่เบอร์ 081-234-5678 เพื่อขอคำปรึกษาเบื้องต้นก่อนเริ่ม", category: "services", tags: [], confidence: "high" }] } };
    const { consolidateKnowledge } = await import("./consolidate");
    const r = await consolidateKnowledge({});
    expect(r.dropped).toBe(1);
    expect(h.inserts).toHaveLength(0);
  });
  it("tags a canonical row for review when softer findings (dates/names) remain", async () => {
    h.tables[KT] = [K(1, "a"), K(2, "b")];
    h.ai = { ok: true, generationId: "g9", model: "m", data: { groups: [{ member_ids: [0, 1], title: "นัดหมายลูกค้า", content: "ลูกค้านัดพบเมื่อ 12/03/2567 เพื่อคุยขอบเขตงานเบื้องต้น ก่อนตกลงราคาและระยะเวลา", category: "services", tags: [], confidence: "high" }] } };
    const { consolidateKnowledge } = await import("./consolidate");
    const r = await consolidateKnowledge({});
    expect(r.dropped).toBe(0);
    expect(h.inserts[0].row.tags).toContain("ต้องตรวจ privacy");
  });
  it("records AI errors and continues", async () => {
    h.tables[KT] = [K(1, "a"), K(2, "b")];
    h.ai = { ok: false, error: "AI ล้มเหลว", code: "failed", generationId: null };
    const { consolidateKnowledge } = await import("./consolidate");
    const r = await consolidateKnowledge({});
    expect(r.errors[0]).toContain("AI ล้มเหลว");
  });
});

describe("consolidateQuestions", () => {
  it("sums frequency and member_count across members and supersedes them", async () => {
    h.tables[QT] = [Q(1, "ราคาเท่าไหร่", 3), Q(2, "ค่าบริการเท่าไร", 2, 4), Q(3, "อย่างอื่น")];
    h.ai = GROUP_Q([0, 1]);
    const { consolidateQuestions } = await import("./consolidate");
    const r = await consolidateQuestions({ userId: "u1" });
    expect(r.groups).toBe(1);
    expect(r.merged).toBe(2);
    expect(h.inserts[0].row).toMatchObject({ frequency: 5, member_count: 5, approved_for_content: false, source: "import" });
    expect(h.inserts[0].row.tags).toEqual(expect.arrayContaining(["line-import", "consolidated"]));
    const sup = h.updates.find((u) => u.payload.superseded_by);
    expect(sup?.ids).toEqual(["q1", "q2"]);
    expect(sup?.payload.superseded_by).toBe("canon-1");
  });
  it("on a normalized_key collision merges into the ACTIVE winner without superseding it", async () => {
    h.tables[QT] = [Q(1, "บริการสืบราคาเท่าไหร่", 3, 2), Q(2, "ค่าบริการเท่าไร", 2)];
    h.ai = GROUP_Q([0, 1]);
    h.insertError = { code: "23505", message: "duplicate key" };
    h.lookup = { id: "q1", frequency: 3, member_count: 2, approved_for_content: false };
    const { consolidateQuestions } = await import("./consolidate");
    const r = await consolidateQuestions({});
    expect(r.groups).toBe(1);
    expect(h.inserts).toHaveLength(0);
    // lookup must be restricted to active rows
    const lookupIs = h.filters.filter((f) => f.table === QT && f.m === "is" && f.args[0] === "superseded_by" && f.args[1] === null);
    expect(lookupIs.length).toBeGreaterThanOrEqual(2); // load + collision lookup
    const merge = h.updates.find((u) => u.eqId === "q1");
    expect(merge?.payload).toMatchObject({ frequency: 5, member_count: 3 }); // existing 3+2, members 2+1 (q1 itself excluded)
    const sup = h.updates.find((u) => u.payload.superseded_by);
    expect(sup?.payload.superseded_by).toBe("q1");
    expect(sup?.ids).toEqual(["q2"]);
  });
  it("skips the group when the colliding active row is already approved", async () => {
    h.tables[QT] = [Q(1, "a", 1), Q(2, "b", 1)];
    h.ai = GROUP_Q([0, 1]);
    h.insertError = { code: "23505", message: "duplicate key" };
    h.lookup = { id: "other", frequency: 9, member_count: 4, approved_for_content: true };
    const { consolidateQuestions } = await import("./consolidate");
    const r = await consolidateQuestions({});
    expect(r.groups).toBe(0);
    expect(h.updates).toHaveLength(0);
    expect(r.errors[0]).toContain("approved");
  });
  it("does not supersede anything when no active winner exists for the colliding key", async () => {
    h.tables[QT] = [Q(1, "a", 1), Q(2, "b", 1)];
    h.ai = GROUP_Q([0, 1]);
    h.insertError = { code: "23505", message: "duplicate key" };
    h.lookup = null;
    const { consolidateQuestions } = await import("./consolidate");
    const r = await consolidateQuestions({});
    expect(r.groups).toBe(0);
    expect(h.updates).toHaveLength(0);
    expect(r.errors[0]).toContain("no active row");
  });
  it("drops a canonical question that carries an identifier", async () => {
    h.tables[QT] = [Q(1, "a", 1), Q(2, "b", 1)];
    h.ai = GROUP_Q([0, 1], "โทร 081-234-5678 ได้ไหม");
    const { consolidateQuestions } = await import("./consolidate");
    const r = await consolidateQuestions({});
    expect(r.dropped).toBe(1);
    expect(h.inserts).toHaveLength(0);
  });
});

describe("resilience", () => {
  const policy = { attempts: 4, baseDelayMs: 1, maxDelayMs: 2 };
  const noSleep = async () => {};
  const mergeGroup = { ok: true as const, generationId: "g9", model: "m", data: { groups: [{ member_ids: [0, 1], title: "ยืนยันตัวเป้าหมายก่อนเริ่มติดตาม", content: "ก่อนเริ่มติดตามต้องยืนยันตัวเป้าหมายด้วยรูปและการแต่งกายของวันนั้น เพื่อไม่ตามผิดคน", category: "surveillance", tags: [], confidence: "high" }] } };

  it("retries a transient settings load and still fails closed on a permanent one", async () => {
    const settings = await import("@/lib/studio/settings");
    const { consolidateKnowledge } = await import("./consolidate");
    h.tables[KT] = [K(1, "a"), K(2, "b")];
    vi.mocked(settings.getStudioSettingsStrict).mockRejectedValueOnce(new Error("studio settings unavailable: TypeError: fetch failed"));
    expect((await consolidateKnowledge({ dryRun: true, retry: policy, sleep: noSleep })).scanned).toBe(2);
    vi.mocked(settings.getStudioSettingsStrict).mockRejectedValueOnce(new Error("studio settings unavailable: permission denied for table studio_settings"));
    await expect(consolidateKnowledge({ dryRun: true, retry: policy, sleep: noSleep })).rejects.toThrow(/permission denied/);
  });

  it("passes the retry policy through to the AI batch call", async () => {
    const ai = await import("@/lib/studio/ai/actions/consolidate");
    const { consolidateKnowledge } = await import("./consolidate");
    h.tables[KT] = [K(1, "a"), K(2, "b")];
    await consolidateKnowledge({ retry: policy, sleep: noSleep });
    expect(vi.mocked(ai.consolidateKnowledgeBatch).mock.calls.at(-1)?.[0]).toMatchObject({ retry: policy });
  });

  it("stops after consecutive batches fail on network errors and keeps the partial result", async () => {
    const { consolidateKnowledge, ConsolidateAbortedError } = await import("./consolidate");
    h.tables[KT] = Array.from({ length: 140 }, (_, i) => K(i, `t${String(i).padStart(3, "0")}`));
    h.ai = { ok: false, error: "สร้างด้วย AI ไม่สำเร็จ", code: "failed", generationId: null, transient: true };
    const err = await consolidateKnowledge({ retry: policy, sleep: noSleep }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConsolidateAbortedError);
    expect(h.aiCalls).toBe(3); // 4 batches, stopped on the 3rd
    expect((err as InstanceType<typeof ConsolidateAbortedError>).result.errors).toHaveLength(3);
  });

  it("does not stop on model errors, and a success resets the network-error streak", async () => {
    const { consolidateKnowledge } = await import("./consolidate");
    h.tables[KT] = Array.from({ length: 140 }, (_, i) => K(i, `t${String(i).padStart(3, "0")}`));
    const net = { ok: false, error: "x", code: "failed", generationId: null, transient: true };
    h.aiQueue = [net, net, { ok: true, data: { groups: [] }, generationId: "g", model: "m" }, net];
    expect((await consolidateKnowledge({ retry: policy, sleep: noSleep })).errors).toHaveLength(3);
    h.aiQueue = [];
    h.ai = { ok: false, error: "parse", code: "failed", generationId: null, transient: false };
    expect((await consolidateKnowledge({ retry: policy, sleep: noSleep })).errors).toHaveLength(4);
  });

  it("adopts a knowledge row whose insert committed before the connection dropped", async () => {
    h.tables[KT] = [K(1, "a"), K(2, "b")];
    h.ai = mergeGroup;
    h.insertError = { message: "TypeError: fetch failed" };
    h.lookup = { id: "k-committed" };
    const { consolidateKnowledge } = await import("./consolidate");
    const r = await consolidateKnowledge({ retry: policy, sleep: noSleep });
    expect(r.groups).toBe(1);
    expect(h.inserts).toHaveLength(0); // never written twice
    expect(h.updates.find((u) => u.payload.superseded_by)?.payload.superseded_by).toBe("k-committed");
    expect(h.filters.some((f) => f.table === KT && f.m === "eq" && f.args[0] === "origin_ref")).toBe(true);
  });

  it("inserts again only after the lookup confirms nothing was committed", async () => {
    h.tables[KT] = [K(1, "a"), K(2, "b")];
    h.ai = mergeGroup;
    h.insertError = { message: "TypeError: fetch failed" };
    h.lookup = null;
    const { consolidateKnowledge } = await import("./consolidate");
    const r = await consolidateKnowledge({ retry: policy, sleep: noSleep });
    expect(r.groups).toBe(1);
    expect(h.inserts).toHaveLength(1);
    expect(h.updates.find((u) => u.payload.superseded_by)?.payload.superseded_by).toBe("canon-1");
  });

  it("without a retry policy a transient insert failure is recorded, not repeated", async () => {
    h.tables[KT] = [K(1, "a"), K(2, "b")];
    h.ai = mergeGroup;
    h.insertError = { message: "TypeError: fetch failed" };
    const { consolidateKnowledge } = await import("./consolidate");
    const r = await consolidateKnowledge({});
    expect(r.groups).toBe(0);
    expect(h.inserts).toHaveLength(0);
    expect(r.errors[0]).toContain("insert");
  });

  it("adopts a question canonical only when the active row matches what was written", async () => {
    const { consolidateQuestions } = await import("./consolidate");
    h.tables[QT] = [Q(1, "ราคาเท่าไหร่", 3), Q(2, "ค่าบริการเท่าไร", 2, 4)];
    h.ai = GROUP_Q([0, 1]);
    h.insertError = { message: "TypeError: fetch failed" };
    h.lookup = { id: "q-committed", frequency: 5, member_count: 5, tags: ["line-import", "consolidated"] };
    const r = await consolidateQuestions({ retry: policy, sleep: noSleep });
    expect(r.groups).toBe(1);
    expect(h.inserts).toHaveLength(0);
    expect(h.updates.find((u) => u.payload.superseded_by)?.payload.superseded_by).toBe("q-committed");

    // a different active row with the same key is not ours: insert again (the unique index guards the rest)
    h.inserts = [];
    h.updates = [];
    h.insertError = { message: "TypeError: fetch failed" };
    h.lookup = { id: "someone-else", frequency: 9, member_count: 2, tags: [] };
    await consolidateQuestions({ retry: policy, sleep: noSleep });
    expect(h.inserts).toHaveLength(1);
  });
});
