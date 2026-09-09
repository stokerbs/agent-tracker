import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  doneRefs: [] as string[],
  inserts: [] as Row[],
  updates: [] as Row[],
  existingQuestion: null as Row | null,
  ai: null as null | { ok: true; data: Row; generationId: string; model: string } | { ok: false; error: string; code: string; generationId: null },
  aiCalls: 0,
}));

vi.mock("@/lib/studio/ai/actions/chat-knowledge", () => ({
  extractChatKnowledge: vi.fn(async () => {
    h.aiCalls += 1;
    return h.ai;
  }),
}));
vi.mock("@/lib/studio/settings", () => ({ getStudioSettings: vi.fn(async () => ({ privacy_rules: { denylist: ["Pimchanok"], custom_patterns: [], strict_mode: false } })) }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const st = { op: "select", single: false };
      const b: Record<string, unknown> = {};
      for (const m of ["select", "like", "or", "limit", "eq", "order", "is", "in"]) b[m] = () => b;
      b.maybeSingle = () => ((st.single = true), b);
      b.insert = (rows: Row | Row[]) => ((st.op = "insert"), h.inserts.push(...(Array.isArray(rows) ? rows : [rows]).map((r) => ({ table, ...r }))), b);
      b.update = (row: Row) => ((st.op = "update"), h.updates.push({ table, ...row }), b);
      b.then = (resolve: (v: unknown) => unknown) => {
        let data: unknown = null;
        if (st.op === "select") {
          if (table === "studio_knowledge_sources") data = h.doneRefs.map((origin_ref) => ({ origin_ref }));
          if (table === "studio_customer_questions") data = st.single ? h.existingQuestion : [];
        }
        return Promise.resolve(resolve({ data, error: null }));
      };
      return b;
    },
  }),
}));

const CSV =
  "ชื่อบัญชี,Detective+\r\nไทม์โซน,'+07:00\r\nวันดาวน์โหลด,2026/06/13 02:24\r\nประเภทผู้ส่ง,ชื่อผู้ส่ง,วันส่ง,เวลาส่ง,ข้อความ\r\n" +
  'User,Pimchanok,2026/06/02,07:29:10,"อยากสืบแฟนค่ะ ชื่อสมชาย โทร 081-234-5678 ใช้เวลากี่วัน"\r\n' +
  'Account,Detective+,2026/06/02,07:35:02,"ปกติ 3-5 วันครับ ขึ้นกับพฤติกรรมเป้าหมาย ต้องมัดจำก่อนเริ่ม"\r\n';

const goodOutput = {
  questions: [{ question: "สืบแฟนใช้เวลากี่วัน", answer_hint: "ปกติ 3–5 วัน ขึ้นกับพฤติกรรม", frequency: 1, tags: ["ระยะเวลา"] }],
  knowledge: [
    { title: "ระยะเวลางานสืบชู้สาวขึ้นกับพฤติกรรมเป้าหมาย", content: "งานเฝ้าติดตามทั่วไปใช้เวลาประมาณสามถึงห้าวัน เพราะต้องเห็นรูปแบบซ้ำก่อนสรุป ไม่ใช่ภาพเดียว", category: "investigator_knowledge", tags: ["ระยะเวลา"], evidence: "stated_by_investigator" },
    { title: "ลูกค้าบอกว่าแฟนชื่อสมชาย", content: "ลูกค้ารายหนึ่งเล่าว่าแฟนชื่อสมชาย โทร 081-234-5678 และทำงานที่บริษัทหนึ่ง", category: "other", tags: [], evidence: "customer_claim" },
  ],
  case_lessons: [{ title: "ลูกค้าเร่งผลลัพธ์", situation: "ลูกค้ารายหนึ่งต้องการผลภายในวันเดียว", lesson: "ต้องตั้งความคาดหวังเรื่องเวลาก่อนเริ่ม", pillar: "detective_pov", privacy_status: "safe" }],
  service_facts: [{ fact: "มัดจำก่อนเริ่มงาน", confidence: "stated" }],
};

beforeEach(() => {
  h.doneRefs = [];
  h.inserts = [];
  h.updates = [];
  h.existingQuestion = null;
  h.aiCalls = 0;
  h.ai = { ok: true, data: goodOutput, generationId: "g1", model: "m" };
});

describe("makeRedactor", () => {
  it("redacts studio denylist and the file's customer names", async () => {
    const { makeRedactor } = await import("./line-history");
    const r = makeRedactor({ denylist: ["Pimchanok"], custom_patterns: [], strict_mode: false }, ["Jason J.📈"]);
    const out = r("Pimchanok กับ Jason นัดกัน โทร 081-234-5678");
    expect(out).not.toContain("Pimchanok");
    expect(out).not.toContain("Jason");
    expect(out).not.toContain("081-234-5678");
  });
});

describe("importLineHistoryFile", () => {
  it("dry-run parses and windows without AI or writes", async () => {
    const { importLineHistoryFile } = await import("./line-history");
    const r = await importLineHistoryFile("a.csv", CSV, { dryRun: true });
    expect(r.messages).toBe(2);
    expect(r.windows).toBe(1);
    expect(h.aiCalls).toBe(0);
    expect(h.inserts).toHaveLength(0);
  });
  it("persists investigator knowledge, drops customer claims / PII, upserts questions", async () => {
    const { importLineHistoryFile } = await import("./line-history");
    const r = await importLineHistoryFile("a.csv", CSV, {});
    expect(h.aiCalls).toBe(1);
    expect(r.errors).toEqual([]);
    const knowledge = h.inserts.filter((i) => i.table === "studio_knowledge_sources");
    // 1 knowledge + 1 case lesson + 1 service-facts row; the customer_claim row is skipped
    expect(knowledge).toHaveLength(3);
    expect(knowledge.every((k) => k.approved_for_content === false)).toBe(true);
    expect(knowledge.every((k) => String(k.origin_ref).startsWith(`line-import:${r.fileHash}:0`))).toBe(true);
    expect(knowledge.some((k) => String(k.content).includes("081-234-5678"))).toBe(false);
    expect(r.knowledgeInserted).toBe(1);
    expect(r.caseLessonsInserted).toBe(1);
    expect(r.serviceFactsInserted).toBe(1);
    const q = h.inserts.find((i) => i.table === "studio_customer_questions");
    expect(q).toMatchObject({ source: "import", approved_for_content: false });
  });
  it("skips windows already imported (idempotent)", async () => {
    const { importLineHistoryFile, fileHashOf } = await import("./line-history");
    h.doneRefs = [`line-import:${fileHashOf(CSV)}:0`];
    const r = await importLineHistoryFile("a.csv", CSV, {});
    expect(r.windowsSkipped).toBe(1);
    expect(h.aiCalls).toBe(0);
  });
  it("records AI failures per window and continues", async () => {
    h.ai = { ok: false, error: "AI ล้มเหลว", code: "failed", generationId: null };
    const { importLineHistoryFile } = await import("./line-history");
    const r = await importLineHistoryFile("a.csv", CSV, {});
    expect(r.errors[0]).toContain("AI ล้มเหลว");
    expect(h.inserts).toHaveLength(0);
  });
});
