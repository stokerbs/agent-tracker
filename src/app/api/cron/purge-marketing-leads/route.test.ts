/** Lead retention cron: auth, flag gating (off / dry / on), rule application, storage-first delete, audit counts only. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  logAudit: vi.fn(),
  reportError: vi.fn(),
  rows: [] as unknown[],
  selectError: null as unknown,
  list: vi.fn(),
  remove: vi.fn(),
  deleted: [] as string[],
  deleteError: null as unknown,
}));
vi.mock("@/lib/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/errors", () => ({ reportError: h.reportError }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ is: () => ({ lt: () => ({ order: () => ({ limit: async () => ({ data: h.rows, error: h.selectError }) }) }) }) }),
      delete: () => ({ eq: (_c: string, id: string) => ({ is: async () => { if (!h.deleteError) h.deleted.push(id); return { error: h.deleteError }; } }) }),
    }),
    storage: { from: () => ({ list: h.list, remove: h.remove }) },
  }),
}));

import { GET } from "./route";

function req(auth?: string): NextRequest {
  const headers = new Map<string, string>();
  if (auth) headers.set("authorization", auth);
  return { headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null } } as unknown as NextRequest;
}
const OLD = "2024-01-01T00:00:00Z";
const DEAD_OLD = { id: "a", stage: "closed", lead_quality: "unrated", converted_at: null, stage_changed_at: OLD, created_at: OLD };
const LIVE_OLD = { id: "b", stage: "quotation_sent", lead_quality: "unrated", converted_at: null, stage_changed_at: OLD, created_at: OLD };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "s3cret");
  h.rows = [DEAD_OLD, LIVE_OLD];
  h.selectError = null;
  h.deleted = [];
  h.deleteError = null;
  h.list.mockResolvedValue({ data: [{ name: "f1.jpg" }, { name: "f2.pdf" }], error: null });
  h.remove.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/purge-marketing-leads", () => {
  it("401 without / with a wrong bearer, and fails closed when CRON_SECRET is unset", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(401);
  });

  it("is a no-op unless MARKETING_LEAD_PURGE is set", async () => {
    vi.stubEnv("MARKETING_LEAD_PURGE", "");
    const res = await GET(req("Bearer s3cret"));
    expect(await res.json()).toMatchObject({ ok: true, mode: "off", purged: 0 });
    expect(h.deleted).toEqual([]);
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("dry mode reports candidates without deleting anything", async () => {
    vi.stubEnv("MARKETING_LEAD_PURGE", "dry");
    const body = await (await GET(req("Bearer s3cret"))).json();
    expect(body).toMatchObject({ ok: true, mode: "dry", purged: 0, candidates: 1 }); // only the dead lead qualifies
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.deleted).toEqual([]);
  });

  it("on: removes attachments first, deletes only purgeable leads, audits counts", async () => {
    vi.stubEnv("MARKETING_LEAD_PURGE", "1");
    const body = await (await GET(req("Bearer s3cret"))).json();
    expect(body).toMatchObject({ ok: true, mode: "on", purged: 1, files: 2, candidates: 1, more: false });
    expect(h.remove).toHaveBeenCalledWith(["a/f1.jpg", "a/f2.pdf"]);
    expect(h.deleted).toEqual(["a"]);
    expect(h.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "LEAD_RETENTION_PURGE", metadata: expect.objectContaining({ purged: 1, files: 2 }) }));
    expect(JSON.stringify(h.logAudit.mock.calls[0]![0])).not.toContain('"a"');
  });

  it("keeps the row when its files cannot be removed; 500 when the query fails", async () => {
    vi.stubEnv("MARKETING_LEAD_PURGE", "1");
    h.remove.mockResolvedValueOnce({ error: { message: "storage down" } });
    expect(await (await GET(req("Bearer s3cret"))).json()).toMatchObject({ purged: 0 });
    expect(h.deleted).toEqual([]);
    expect(h.reportError).toHaveBeenCalled();

    h.selectError = { message: "boom" };
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(500);
  });
});
