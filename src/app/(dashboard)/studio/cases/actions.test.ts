/**
 * Case Insights server-action tests: auth gate, validation, privacy gating of
 * approvals (blocked insight / high-severity findings) and AI extraction wiring.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Call { table: string; op: string; payload?: unknown }

const h = vi.hoisted(() => ({
  profile: { id: "admin-1", role: "admin" } as { id: string; role: string } | null,
  calls: [] as Call[],
  /** Per-table terminal results (single/maybeSingle/await). Falls back to `default`. */
  results: {} as Record<string, { data: unknown; error: unknown } | Array<{ data: unknown; error: unknown }>>,
  aiAvailable: true,
  aiResult: { ok: true, data: { insights: [], anonymized_version: "" }, generationId: "gen-1", model: "claude-test" } as unknown,
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
  extractCaseInsights: vi.fn(async () => h.aiResult),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      const record = (op: string) => (payload?: unknown) => {
        h.calls.push({ table, op, payload });
        return b;
      };
      for (const m of ["select", "eq", "neq", "order", "limit"]) b[m] = record(m);
      b.insert = record("insert");
      b.update = record("update");
      b.delete = record("delete");
      const resolve = () => {
        const r = h.results[table] ?? h.results.default ?? { data: null, error: null };
        if (Array.isArray(r)) return r.length > 1 ? r.shift()! : r[0];
        return r;
      };
      b.single = () => Promise.resolve(resolve());
      b.maybeSingle = () => Promise.resolve(resolve());
      (b as { then: unknown }).then = (r: (v: unknown) => unknown) => r(resolve());
      return b;
    },
  }),
}));

async function load() {
  return import("./actions");
}

const CASE_ID = "33333333-3333-4333-8333-333333333333";
const INSIGHT_ID = "44444444-4444-4444-8444-444444444444";

const validCase = {
  case_code: "dp-k-0007",
  case_type: "surveillance",
  title: "รถจอดที่เดิม แต่คนไม่ได้อยู่กับรถ",
  situation: "ลูกค้าสงสัยพฤติกรรมคู่สมรสช่วงเย็น",
  content_potential: "high",
  sensitivity: "confidential",
  approved_for_content: false,
  tags: ["gps"],
  linked_case_id: null,
};

beforeEach(() => {
  h.profile = { id: "admin-1", role: "admin" };
  h.calls = [];
  h.results = { default: { data: null, error: null } };
  h.aiAvailable = true;
  h.aiResult = { ok: true, data: { insights: [], anonymized_version: "" }, generationId: "gen-1", model: "claude-test" };
  h.audit.mockClear();
});

describe("createCase", () => {
  it("throws for non-admins", async () => {
    h.profile = { id: "agent-1", role: "agent" };
    const { createCase } = await load();
    await expect(createCase(validCase)).rejects.toThrow("Unauthorized");
    expect(h.calls).toHaveLength(0);
  });

  it("rejects missing required fields and bad case types", async () => {
    const { createCase } = await load();
    expect((await createCase({ ...validCase, case_code: "" })).ok).toBe(false);
    expect((await createCase({ ...validCase, title: "" })).ok).toBe(false);
    expect((await createCase({ ...validCase, case_type: "alien" })).ok).toBe(false);
    expect((await createCase({ ...validCase, linked_case_id: "not-a-uuid" })).ok).toBe(false);
    expect(h.calls).toHaveLength(0);
  });

  it("refuses a duplicate case_code", async () => {
    h.results = { studio_cases: { data: { id: "existing" }, error: null }, default: { data: null, error: null } };
    const { createCase } = await load();
    const res = await createCase(validCase);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("DP-K-0007");
    expect(h.calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("inserts with an upper-cased code and reports zero findings for clean text", async () => {
    h.results = {
      // 1st studio_cases call = dupe check (none), 2nd = insert().single()
      studio_cases: [{ data: null, error: null }, { data: { id: CASE_ID }, error: null }],
      studio_settings: { data: { privacy_rules: { denylist: [] } }, error: null },
    };
    const { createCase } = await load();
    const res = await createCase(validCase);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ id: CASE_ID, findings: [], approvalDowngraded: false });
    }
    expect(h.calls.find((c) => c.op === "insert")?.payload).toMatchObject({ case_code: "DP-K-0007", created_by: "admin-1", approved_for_content: false });
  });

  it("saves but downgrades approval when high-severity PII is present", async () => {
    h.results = {
      studio_cases: [{ data: null, error: null }, { data: { id: CASE_ID }, error: null }],
      studio_settings: { data: { privacy_rules: { denylist: ["สมชาย"] } }, error: null },
    };
    const { createCase } = await load();
    const res = await createCase({ ...validCase, approved_for_content: true, observations: "พบคุณสมชาย โทร 081-234-5678 ที่ซอย 12" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.approvalDowngraded).toBe(true);
      expect(res.data.findings.some((f) => f.severity === "high")).toBe(true);
    }
    expect(h.calls.find((c) => c.op === "insert")?.payload).toMatchObject({ approved_for_content: false });
    expect(h.audit).not.toHaveBeenCalled();
  });
});

describe("setCaseApproved", () => {
  it("refuses to approve while the case text still contains high-severity identifiers", async () => {
    h.results = {
      studio_cases: { data: { ...validCase, id: CASE_ID, case_code: "DP-K-0007", observations: "ทะเบียน กข 1234 จอดหน้าบ้านเลขที่ 99/1 ซอยสุขใจ" }, error: null },
      studio_settings: { data: { privacy_rules: {} }, error: null },
    };
    const { setCaseApproved } = await load();
    const res = await setCaseApproved(CASE_ID, true);
    expect(res.ok).toBe(false);
    expect(h.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("un-approving never runs the scan and audits", async () => {
    const { setCaseApproved } = await load();
    const res = await setCaseApproved(CASE_ID, false);
    expect(res).toEqual({ ok: true });
    expect(h.calls.find((c) => c.op === "update")?.payload).toEqual({ approved_for_content: false });
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "STUDIO_CASE_APPROVE" }));
  });
});

describe("setInsightApproved", () => {
  it("refuses when privacy_status is blocked", async () => {
    h.results = {
      studio_case_insights: { data: { id: INSIGHT_ID, case_id: CASE_ID, privacy_status: "blocked", title: "t", insight: "i", lesson: null, content_angle: null }, error: null },
    };
    const { setInsightApproved } = await load();
    const res = await setInsightApproved(INSIGHT_ID, true);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("บล็อก");
    expect(h.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("approves a safe insight and audits", async () => {
    h.results = {
      studio_case_insights: { data: { id: INSIGHT_ID, case_id: CASE_ID, privacy_status: "safe", title: "GPS ไม่ยืนยันตัวคน", insight: "ตำแหน่งรถไม่เท่ากับตำแหน่งคน", lesson: null, content_angle: null }, error: null },
      studio_settings: { data: { privacy_rules: {} }, error: null },
    };
    const { setInsightApproved } = await load();
    const res = await setInsightApproved(INSIGHT_ID, true);
    expect(res).toEqual({ ok: true });
    expect(h.calls.find((c) => c.op === "update")?.payload).toEqual({ approved_for_content: true });
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "STUDIO_INSIGHT_APPROVE" }));
  });

  it("rejects a non-uuid id", async () => {
    const { setInsightApproved } = await load();
    expect((await setInsightApproved("x", true)).ok).toBe(false);
    expect(h.calls).toHaveLength(0);
  });
});

describe("extractInsightsForCase", () => {
  it("returns an honest error when AI is not configured", async () => {
    h.aiAvailable = false;
    const { extractInsightsForCase } = await load();
    const res = await extractInsightsForCase(CASE_ID);
    expect(res.ok).toBe(false);
    expect(h.calls).toHaveLength(0);
  });

  it("surfaces the RunResult error without inserting", async () => {
    h.results = { studio_cases: { data: { id: CASE_ID, case_code: "DP-K-0007", anonymized_version: null }, error: null } };
    h.aiResult = { ok: false, error: "AI ปฏิเสธคำขอนี้", code: "refused", generationId: null };
    const { extractInsightsForCase } = await load();
    const res = await extractInsightsForCase(CASE_ID);
    expect(res).toEqual({ ok: false, error: "AI ปฏิเสธคำขอนี้" });
    expect(h.calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("inserts AI insights unapproved, tightens privacy via the deterministic scan, and fills anonymized_version", async () => {
    h.results = {
      studio_cases: { data: { id: CASE_ID, case_code: "DP-K-0007", anonymized_version: null }, error: null },
      studio_settings: { data: { privacy_rules: {} }, error: null },
      studio_case_insights: { data: [{ id: "i1" }, { id: "i2" }], error: null },
    };
    h.aiResult = {
      ok: true,
      generationId: "gen-9",
      model: "claude-test",
      data: {
        anonymized_version: "เรื่องเล่าแบบไม่ระบุตัวตน",
        insights: [
          { title: "ปลอดภัย", insight: "GPS บอกตำแหน่งรถ ไม่ใช่คน", lesson: "ต้องมีการเฝ้าสังเกตยืนยัน", content_angle: "myth vs reality", pillar: "detective_knowledge", privacy_status: "safe", privacy_note: null },
          { title: "หลุด PII", insight: "เป้าหมายใช้เบอร์ 089-111-2222 นัดพบ", lesson: "x", content_angle: "y", pillar: "case_story", privacy_status: "safe", privacy_note: null },
        ],
      },
    };
    const { extractInsightsForCase } = await load();
    const res = await extractInsightsForCase(CASE_ID);
    expect(res).toEqual({ ok: true, data: { inserted: 2, anonymizedUpdated: true } });
    const rows = h.calls.find((c) => c.op === "insert" && c.table === "studio_case_insights")?.payload as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ privacy_status: "safe", approved_for_content: false, generated_by: "ai", generation_id: "gen-9" });
    expect(rows[1]).toMatchObject({ privacy_status: "blocked", approved_for_content: false });
    expect(h.calls.find((c) => c.op === "update" && c.table === "studio_cases")?.payload).toEqual({ anonymized_version: "เรื่องเล่าแบบไม่ระบุตัวตน" });
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "STUDIO_CASE_INSIGHTS_EXTRACT" }));
  });
});

describe("createIdeaFromInsight", () => {
  it("refuses blocked insights", async () => {
    h.results = { studio_case_insights: { data: { id: INSIGHT_ID, case_id: CASE_ID, title: "t", insight: "i", lesson: null, content_angle: null, pillar: "case_story", privacy_status: "blocked" }, error: null } };
    const { createIdeaFromInsight } = await load();
    expect((await createIdeaFromInsight(INSIGHT_ID)).ok).toBe(false);
    expect(h.calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("seeds an idea with origin 'case' and a case_insight source ref", async () => {
    h.results = {
      studio_case_insights: { data: { id: INSIGHT_ID, case_id: CASE_ID, title: "GPS ไม่ยืนยันตัวคน", insight: "i", lesson: "l", content_angle: "hook", pillar: "detective_pov", privacy_status: "safe" }, error: null },
      studio_ideas: { data: { id: "idea-1" }, error: null },
    };
    const { createIdeaFromInsight } = await load();
    const res = await createIdeaFromInsight(INSIGHT_ID);
    expect(res).toEqual({ ok: true, data: { ideaId: "idea-1" } });
    expect(h.calls.find((c) => c.table === "studio_ideas" && c.op === "insert")?.payload).toMatchObject({
      origin: "case",
      pillar: "detective_pov",
      hook: "hook",
      source_refs: [{ kind: "case_insight", id: INSIGHT_ID, label: "GPS ไม่ยืนยันตัวคน" }],
    });
  });
});
