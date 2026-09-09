/**
 * Content workflow tests — the approval gate is the critical path:
 * unauthorized · blocked privacy refuses · review_required needs override ·
 * safe approves · unsupported claims need acknowledgement · schedule needs approved.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const MASTER = "11111111-1111-4111-8111-111111111111";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  profile: { id: "admin-1", role: "admin" } as { id: string; role: string } | null,
  rows: {} as Record<string, Row[]>,
  inserts: {} as Record<string, Row[]>,
  updates: {} as Record<string, Row[]>,
  deletes: [] as string[],
  errors: {} as Record<string, { message: string } | null>,
  settings: { approval_rules: { require_privacy_safe: true, allow_override: true }, privacy_rules: { denylist: [], custom_patterns: [], strict_mode: false } },
  privacyResult: { status: "safe", findings: [] as unknown[], summary: "ok", suggestions: [] as string[], checked_by: "deterministic", model: null as string | null },
  audit: [] as { action: string }[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/auth", () => ({
  getStudioAdmin: vi.fn(async () => h.profile),
  requireStudioAdmin: vi.fn(async () => {
    if (!h.profile) throw new Error("Unauthorized");
    return h.profile;
  }),
}));
vi.mock("@/lib/studio/settings", () => ({ getStudioSettings: vi.fn(async () => h.settings) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async (e: { action: string }) => void h.audit.push(e)) }));
vi.mock("@/lib/studio/ai", () => ({ runPrivacyCheck: vi.fn(async () => h.privacyResult) }));

/** Chainable PostgREST-ish mock: rows per table, records inserts/updates/deletes. */
function builder(table: string) {
  const state = { op: "select" as "select" | "insert" | "update" | "delete", single: false };
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "in", "order", "limit", "gte", "lte", "ilike", "or"]) b[m] = () => b;
  b.insert = (payload: Row | Row[]) => {
    state.op = "insert";
    (h.inserts[table] ??= []).push(...(Array.isArray(payload) ? payload : [payload]));
    return b;
  };
  b.update = (payload: Row) => {
    state.op = "update";
    (h.updates[table] ??= []).push(payload);
    return b;
  };
  b.delete = () => {
    state.op = "delete";
    h.deletes.push(table);
    return b;
  };
  b.maybeSingle = () => {
    state.single = true;
    return b;
  };
  b.single = b.maybeSingle;
  b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
    const error = h.errors[table] ?? null;
    const rows = h.rows[table] ?? [];
    let data: unknown = null;
    if (!error) {
      if (state.op === "select") data = state.single ? (rows[0] ?? null) : rows;
      else if (state.op === "insert") data = state.single ? { id: `${table}-new` } : null;
    }
    return Promise.resolve({ data, error }).then(resolve, reject);
  };
  return b;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (t: string) => builder(t) }),
  createServiceClient: () => {
    throw new Error("service client must not be used in content actions");
  },
}));

async function load() {
  return import("./workflow-actions");
}

beforeEach(() => {
  h.profile = { id: "admin-1", role: "admin" };
  h.rows = {
    studio_content_masters: [{ id: MASTER, title: "Test", status: "review", scheduled_at: null, hook: "h", script: "s", caption: "c", cta: "x" }],
    studio_privacy_checks: [],
    studio_content_claims: [],
    studio_content_variants: [],
  };
  h.inserts = {};
  h.updates = {};
  h.deletes = [];
  h.errors = {};
  h.settings = { approval_rules: { require_privacy_safe: true, allow_override: true }, privacy_rules: { denylist: [], custom_patterns: [], strict_mode: false } };
  h.privacyResult = { status: "safe", findings: [], summary: "ok", suggestions: [], checked_by: "deterministic", model: null };
  h.audit = [];
});

describe("authorization", () => {
  it("refuses every transition for non-admins", async () => {
    h.profile = null;
    const a = await load();
    for (const fn of [a.submitForReview, a.archiveContent, a.unarchiveContent, a.unscheduleContent, a.deleteContent]) {
      expect(await fn(MASTER)).toMatchObject({ ok: false });
    }
    expect(await a.approveContent({ masterId: MASTER })).toMatchObject({ ok: false });
    expect(await a.scheduleContent({ masterId: MASTER, scheduledAt: new Date().toISOString() })).toMatchObject({ ok: false });
    expect(await a.markPublished({ masterId: MASTER })).toMatchObject({ ok: false });
    expect(h.updates.studio_content_masters).toBeUndefined();
  });

  it("rejects malformed ids", async () => {
    const { approveContent } = await load();
    expect(await approveContent({ masterId: "nope" })).toMatchObject({ ok: false });
  });
});

describe("approveContent — privacy gate", () => {
  it("refuses when the latest privacy check is blocked", async () => {
    h.rows.studio_privacy_checks = [{ id: "pc1", status: "blocked", created_at: "2026-09-09T00:00:00Z" }];
    const { approveContent } = await load();
    const res = await approveContent({ masterId: MASTER, overridePrivacy: true });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("BLOCKED");
    expect(h.updates.studio_content_masters).toBeUndefined();
    expect(h.audit.find((a) => a.action === "STUDIO_CONTENT_APPROVE")).toBeUndefined();
  });

  it("requires an explicit override when review_required", async () => {
    h.rows.studio_privacy_checks = [{ id: "pc1", status: "review_required", created_at: "2026-09-09T00:00:00Z" }];
    const { approveContent } = await load();
    const res = await approveContent({ masterId: MASTER });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("override");
    expect(h.updates.studio_content_masters).toBeUndefined();
  });

  it("refuses override when settings disallow it", async () => {
    h.rows.studio_privacy_checks = [{ id: "pc1", status: "review_required", created_at: "2026-09-09T00:00:00Z" }];
    h.settings = { ...h.settings, approval_rules: { require_privacy_safe: true, allow_override: false } };
    const { approveContent } = await load();
    const res = await approveContent({ masterId: MASTER, overridePrivacy: true });
    expect(res.ok).toBe(false);
    expect(h.updates.studio_content_masters).toBeUndefined();
  });

  it("approves review_required with override and records both review rows + audit", async () => {
    h.rows.studio_privacy_checks = [{ id: "pc1", status: "review_required", created_at: "2026-09-09T00:00:00Z" }];
    const { approveContent } = await load();
    const res = await approveContent({ masterId: MASTER, overridePrivacy: true, note: "checked" });
    expect(res).toMatchObject({ ok: true, data: { status: "approved" } });
    const decisions = (h.inserts.studio_content_reviews ?? []).map((r) => r.decision);
    expect(decisions).toEqual(["override_privacy", "approve"]);
    expect(h.updates.studio_content_masters?.[0]).toMatchObject({ status: "approved", approved_by: "admin-1" });
    expect(h.audit.map((a) => a.action)).toEqual(["STUDIO_PRIVACY_OVERRIDE", "STUDIO_CONTENT_APPROVE"]);
  });

  it("approves when the latest check is safe", async () => {
    h.rows.studio_privacy_checks = [{ id: "pc1", status: "safe", created_at: "2026-09-09T00:00:00Z" }];
    const { approveContent } = await load();
    const res = await approveContent({ masterId: MASTER });
    expect(res).toMatchObject({ ok: true });
    expect(h.updates.studio_content_masters?.[0]).toMatchObject({ status: "approved" });
    expect((h.inserts.studio_content_reviews ?? []).map((r) => r.decision)).toEqual(["approve"]);
    expect(h.audit.map((a) => a.action)).toEqual(["STUDIO_CONTENT_APPROVE"]);
  });

  it("runs + stores a deterministic check first when none exists", async () => {
    h.rows.studio_privacy_checks = [];
    const { approveContent } = await load();
    const res = await approveContent({ masterId: MASTER });
    expect(res).toMatchObject({ ok: true });
    expect(h.inserts.studio_privacy_checks?.[0]).toMatchObject({ master_id: MASTER, status: "safe", checked_by: "deterministic" });
  });

  it("refuses when the fresh deterministic check is blocked", async () => {
    h.rows.studio_privacy_checks = [];
    h.privacyResult = { ...h.privacyResult, status: "blocked", findings: [{ kind: "phone" }] };
    const { approveContent } = await load();
    const res = await approveContent({ masterId: MASTER });
    expect(res.ok).toBe(false);
    expect(h.inserts.studio_privacy_checks?.[0]).toMatchObject({ status: "blocked" });
    expect(h.updates.studio_content_masters).toBeUndefined();
  });

  it("requires acknowledgement of unsupported claims", async () => {
    h.rows.studio_privacy_checks = [{ id: "pc1", status: "safe", created_at: "2026-09-09T00:00:00Z" }];
    h.rows.studio_content_claims = [{ id: "c1", support_status: "unsupported" }, { id: "c2", support_status: "supported" }];
    const { approveContent } = await load();
    expect(await approveContent({ masterId: MASTER })).toMatchObject({ ok: false });
    expect(h.updates.studio_content_masters).toBeUndefined();
    const ok = await approveContent({ masterId: MASTER, acknowledgeUnsupported: true });
    expect(ok).toMatchObject({ ok: true });
    expect(String(h.inserts.studio_content_reviews?.[0]?.note)).toContain("1");
  });

  it("only approves from review/draft", async () => {
    h.rows.studio_content_masters[0].status = "published";
    h.rows.studio_privacy_checks = [{ id: "pc1", status: "safe", created_at: "2026-09-09T00:00:00Z" }];
    const { approveContent } = await load();
    expect(await approveContent({ masterId: MASTER })).toMatchObject({ ok: false });
  });
});

describe("scheduleContent", () => {
  it("requires approved status", async () => {
    h.rows.studio_content_masters[0].status = "draft";
    const { scheduleContent } = await load();
    const res = await scheduleContent({ masterId: MASTER, scheduledAt: "2026-10-01T10:00:00.000Z" });
    expect(res.ok).toBe(false);
    expect(h.updates.studio_content_masters).toBeUndefined();
  });

  it("schedules an approved piece and stores scheduled_at", async () => {
    h.rows.studio_content_masters[0].status = "approved";
    const { scheduleContent } = await load();
    const res = await scheduleContent({ masterId: MASTER, scheduledAt: "2026-10-01T10:00:00.000Z" });
    expect(res).toMatchObject({ ok: true, data: { scheduledAt: "2026-10-01T10:00:00.000Z" } });
    expect(h.updates.studio_content_masters?.[0]).toMatchObject({ status: "scheduled", scheduled_at: "2026-10-01T10:00:00.000Z" });
  });

  it("rejects an invalid date", async () => {
    h.rows.studio_content_masters[0].status = "approved";
    const { scheduleContent } = await load();
    expect(await scheduleContent({ masterId: MASTER, scheduledAt: "not-a-date" })).toMatchObject({ ok: false });
  });
});

describe("other transitions", () => {
  it("submitForReview runs a privacy check when none exists and moves to review", async () => {
    h.rows.studio_content_masters[0].status = "draft";
    const { submitForReview } = await load();
    expect(await submitForReview(MASTER)).toMatchObject({ ok: true });
    expect(h.inserts.studio_privacy_checks?.length).toBe(1);
    expect(h.updates.studio_content_masters?.[0]).toMatchObject({ status: "review" });
  });

  it("markPublished only from approved/scheduled and audits", async () => {
    h.rows.studio_content_masters[0].status = "draft";
    const { markPublished } = await load();
    expect(await markPublished({ masterId: MASTER })).toMatchObject({ ok: false });
    h.rows.studio_content_masters[0].status = "scheduled";
    expect(await markPublished({ masterId: MASTER, publishedUrl: "https://www.tiktok.com/@x/video/1" })).toMatchObject({ ok: true });
    expect(h.updates.studio_content_masters?.[0]).toMatchObject({ status: "published", published_url: "https://www.tiktok.com/@x/video/1" });
    expect(h.audit.map((a) => a.action)).toContain("STUDIO_CONTENT_PUBLISH");
  });

  it("deleteContent refuses non-draft/rejected/archived and audits on success", async () => {
    h.rows.studio_content_masters[0].status = "approved";
    const { deleteContent } = await load();
    expect(await deleteContent(MASTER)).toMatchObject({ ok: false });
    expect(h.deletes).toEqual([]);
    h.rows.studio_content_masters[0].status = "draft";
    expect(await deleteContent(MASTER)).toMatchObject({ ok: true });
    expect(h.deletes).toEqual(["studio_content_masters"]);
    expect(h.audit.map((a) => a.action)).toContain("STUDIO_CONTENT_DELETE");
  });

  it("requestChanges needs a note and review status", async () => {
    const { requestChanges } = await load();
    expect(await requestChanges({ masterId: MASTER, note: "" })).toMatchObject({ ok: false });
    expect(await requestChanges({ masterId: MASTER, note: "tighten hook" })).toMatchObject({ ok: true });
    expect(h.updates.studio_content_masters?.[0]).toMatchObject({ status: "draft" });
    expect(h.inserts.studio_content_reviews?.[0]).toMatchObject({ decision: "request_changes", note: "tighten hook" });
  });
});
