import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  doneRefs: [] as string[],
  inserts: [] as Row[],
  updates: [] as Row[],
  existingQuestion: null as Row | null,
  ai: null as null | { ok: true; data: Row; generationId: string; model: string } | { ok: false; error: string; code: string; generationId: null },
  aiCalls: 0,
  labels: [] as string[],
  doneGenerationRefs: [] as string[],
  settingsDown: false,
}));

vi.mock("@/lib/studio/ai/actions/chat-knowledge", () => ({
  extractChatKnowledge: vi.fn(async (input: { windowLabel: string }) => {
    h.aiCalls += 1;
    h.labels.push(input.windowLabel);
    return h.ai;
  }),
}));
vi.mock("@/lib/studio/settings", () => ({
  getStudioSettingsStrict: vi.fn(async () => {
    if (h.settingsDown) throw new Error("studio settings unavailable: boom");
    return { privacy_rules: { denylist: ["Pimchanok"], custom_patterns: [], strict_mode: false } };
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const st = { op: "select", single: false };
      const b: Record<string, unknown> = {};
      for (const m of ["select", "like", "or", "limit", "eq", "order", "is", "in", "filter"]) b[m] = () => b;
      b.maybeSingle = () => ((st.single = true), b);
      b.insert = (rows: Row | Row[]) => ((st.op = "insert"), h.inserts.push(...(Array.isArray(rows) ? rows : [rows]).map((r) => ({ table, ...r }))), b);
      b.update = (row: Row) => ((st.op = "update"), h.updates.push({ table, ...row }), b);
      b.then = (resolve: (v: unknown) => unknown) => {
        let data: unknown = null;
        if (st.op === "select") {
          if (table === "studio_knowledge_sources") data = h.doneRefs.map((origin_ref) => ({ origin_ref }));
          if (table === "studio_ai_generations") data = h.doneGenerationRefs.map((ref) => ({ input_refs: { ref } }));
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
  h.labels = [];
  h.doneGenerationRefs = [];
  h.settingsDown = false;
  h.ai = { ok: true, data: goodOutput, generationId: "g1", model: "m" };
});

describe("makeRedactor", () => {
  it("redacts studio denylist and the file's customer names", async () => {
    const { makeRedactor } = await import("./line-history");
    const { redact: r, rules } = makeRedactor({ denylist: ["Pimchanok"], custom_patterns: [], strict_mode: false }, ["Jason J.📈"]);
    expect(rules.denylist).toEqual(expect.arrayContaining(["Pimchanok", "Jason"]));
    const out = r("Pimchanok กับ Jason นัดกัน โทร 081-234-5678");
    expect(out).not.toContain("Pimchanok");
    expect(out).not.toContain("Jason");
    expect(out).not.toContain("081-234-5678");
  });
});

describe("importLineHistoryFile", () => {
  it("dry-run parses and windows without AI or writes", async () => {
    const { importLineHistoryFile } = await import("./line-history");
    const r = await importLineHistoryFile("a.csv", CSV, { dryRun: true, minUserMessages: 1 });
    expect(r.messages).toBe(2);
    expect(r.windows).toBe(1);
    expect(h.aiCalls).toBe(0);
    expect(h.inserts).toHaveLength(0);
  });
  it("persists investigator knowledge, drops customer claims / PII, upserts questions", async () => {
    const { importLineHistoryFile } = await import("./line-history");
    const r = await importLineHistoryFile("a.csv", CSV, { minUserMessages: 1 });
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
  it("skips windows already imported (idempotent via knowledge rows OR logged generations)", async () => {
    const { importLineHistoryFile, fileHashOf } = await import("./line-history");
    h.doneRefs = [`line-import:${fileHashOf(CSV)}:0`];
    let r = await importLineHistoryFile("a.csv", CSV, { minUserMessages: 1 });
    expect(r.windowsSkipped).toBe(1);
    expect(h.aiCalls).toBe(0);
    h.doneRefs = [];
    h.doneGenerationRefs = [`line-import:${fileHashOf(CSV)}:0`];
    r = await importLineHistoryFile("a.csv", CSV, { minUserMessages: 1 });
    expect(r.windowsSkipped).toBe(1);
    expect(h.aiCalls).toBe(0);
  });
  it("never sends the filename to the model; the label is the opaque ref; hash ignores the download header", async () => {
    const { importLineHistoryFile, fileHashOf } = await import("./line-history");
    await importLineHistoryFile("20260602_20260609_Pimchanok.csv", CSV, { minUserMessages: 1 });
    expect(h.labels[0]).toBe(`line-import:${fileHashOf(CSV)}:0`);
    expect(h.labels[0]).not.toContain("Pimchanok");
    const reExport = CSV.replace("2026/06/13 02:24", "2026/09/01 10:00");
    expect(fileHashOf(reExport)).toBe(fileHashOf(CSV));
  });
  it("drops LINE handles and flagged service facts", async () => {
    h.ai = {
      ok: true, generationId: "g4", model: "m",
      data: {
        questions: [],
        knowledge: [{ title: "ติดต่อผ่านไลน์ @somchai_k", content: "ลูกค้าติดต่อผ่าน LINE @somchai_k เพื่อขอคำปรึกษาเบื้องต้นก่อนตัดสินใจจ้างงานสืบ", category: "services", tags: [], evidence: "stated_by_investigator" }],
        case_lessons: [],
        service_facts: [{ fact: "นัดส่งรายงานวันที่ 12/03/2568 ที่ร้านกาแฟ", confidence: "stated" }, { fact: "ชำระมัดจำ 50% ก่อนเริ่มงานทุกครั้ง", confidence: "stated" }],
      },
    };
    const { importLineHistoryFile } = await import("./line-history");
    const r = await importLineHistoryFile("a.csv", CSV, { minUserMessages: 1 });
    const rows = h.inserts.filter((i) => i.table === "studio_knowledge_sources");
    expect(rows).toHaveLength(1); // only the service-facts row
    expect(String(rows[0].content)).not.toContain("12/03/2568");
    expect(String(rows[0].content)).toContain("มัดจำ 50%");
    expect(r.dropped).toBe(1);
  });
  it("flags medium findings for review instead of dropping them (names are heuristic)", async () => {
    h.ai = {
      ok: true, generationId: "g3", model: "m",
      data: {
        questions: [],
        knowledge: [
          { title: "นัดคุยวันที่ 12/03/2568", content: "การนัดคุยรายละเอียดควรทำก่อนเริ่มงานเสมอเพื่อตั้งความคาดหวังเรื่องเวลาและงบประมาณ", category: "owner_experience", tags: [], evidence: "stated_by_investigator" },
          { title: "คุณควรเตรียมอะไรก่อนจ้างนักสืบ", content: "คุณควรเตรียมรูปถ่ายล่าสุดและตารางชีวิตของเป้าหมาย เพื่อให้ทีมวางแผนเฝ้าติดตามได้ตรงจุด", category: "investigator_knowledge", tags: [], evidence: "stated_by_investigator" },
          { title: "ลูกค้าเล่าว่าแฟนชื่อสมชาย", content: "ลูกค้ารายหนึ่งเล่าว่าแฟนชื่อสมชายและมักกลับดึก ทีมจึงเฝ้าช่วงค่ำ", category: "investigator_knowledge", tags: [], evidence: "stated_by_investigator" },
        ],
        case_lessons: [], service_facts: [],
      },
    };
    const { importLineHistoryFile } = await import("./line-history");
    const r = await importLineHistoryFile("a.csv", CSV, { minUserMessages: 1 });
    const rows = h.inserts.filter((i) => i.table === "studio_knowledge_sources");
    expect(rows).toHaveLength(3);
    const byTitle = Object.fromEntries(rows.map((x) => [String(x.title), x.tags as string[]]));
    expect(byTitle["นัดคุยวันที่ 12/03/2568"]).toContain("ต้องตรวจ privacy"); // date → flag
    expect(byTitle["คุณควรเตรียมอะไรก่อนจ้างนักสืบ"]).not.toContain("ต้องตรวจ privacy"); // pronoun, not a name
    expect(byTitle["ลูกค้าเล่าว่าแฟนชื่อสมชาย"]).toContain("ต้องตรวจ privacy"); // cue-word name → flag for review
    expect(r.dropped).toBe(0);
  });
  it("records AI failures per window and continues", async () => {
    h.ai = { ok: false, error: "AI ล้มเหลว", code: "failed", generationId: null };
    const { importLineHistoryFile } = await import("./line-history");
    const r = await importLineHistoryFile("a.csv", CSV, { minUserMessages: 1 });
    expect(r.errors[0]).toContain("AI ล้มเหลว");
    expect(h.inserts).toHaveLength(0);
  });
});

describe("tiny-chat skip", () => {
  it("skips chats with fewer customer messages than the threshold (default 2) without calling AI", async () => {
    const { importLineHistoryFile } = await import("./line-history");
    const r = await importLineHistoryFile("a.csv", CSV, {});
    expect(r.errors[0]).toMatch(/^skipped:/);
    expect(h.aiCalls).toBe(0);
  });
});

describe("settings outage", () => {
  it("aborts a real import (no AI calls, no writes) when the privacy rules cannot be loaded", async () => {
    h.settingsDown = true;
    vi.resetModules();
    const { importLineHistoryFile } = await import("./line-history");
    const r = await importLineHistoryFile("a.csv", CSV, { minUserMessages: 1 });
    expect(r.errors[0]).toMatch(/^aborted:/);
    expect(h.aiCalls).toBe(0);
    expect(h.inserts).toHaveLength(0);
  });
});
