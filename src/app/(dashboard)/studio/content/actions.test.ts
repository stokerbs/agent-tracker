/**
 * Content CRUD actions: authorization, validation, autosave estimate, sources.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const MASTER = "11111111-1111-4111-8111-111111111111";
const KNOWLEDGE = "22222222-2222-4222-8222-222222222222";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  profile: { id: "admin-1", role: "admin" } as { id: string; role: string } | null,
  rows: {} as Record<string, Row[]>,
  inserts: {} as Record<string, Row[]>,
  updates: {} as Record<string, Row[]>,
  deletes: [] as string[],
  errors: {} as Record<string, { message: string } | null>,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/auth", () => ({ getStudioAdmin: vi.fn(async () => h.profile) }));
vi.mock("@/lib/studio/settings", () => ({ getStudioSettings: vi.fn(async () => ({ approval_rules: { require_privacy_safe: true, allow_override: true }, privacy_rules: {} })) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => undefined) }));
vi.mock("@/lib/studio/ai", () => ({
  runPrivacyCheck: vi.fn(async () => ({ status: "safe", findings: [], summary: "ok", suggestions: [], checked_by: "deterministic", model: null })),
}));

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
  return import("./actions");
}

beforeEach(() => {
  h.profile = { id: "admin-1", role: "admin" };
  h.rows = { studio_content_masters: [], studio_content_sources: [], studio_content_variants: [], studio_content_claims: [], studio_privacy_checks: [] };
  h.inserts = {};
  h.updates = {};
  h.deletes = [];
  h.errors = {};
});

describe("createContentMaster", () => {
  it("refuses non-admins", async () => {
    h.profile = null;
    const { createContentMaster } = await load();
    expect(await createContentMaster({ title: "x", pillar: "service", primaryPlatform: "tiktok" })).toMatchObject({ ok: false });
    expect(h.inserts.studio_content_masters).toBeUndefined();
  });
  it("validates title / pillar / platform / duration", async () => {
    const { createContentMaster } = await load();
    expect(await createContentMaster({ title: "", pillar: "service", primaryPlatform: "tiktok" })).toMatchObject({ ok: false });
    expect(await createContentMaster({ title: "x", pillar: "nope", primaryPlatform: "tiktok" })).toMatchObject({ ok: false });
    expect(await createContentMaster({ title: "x", pillar: "service", primaryPlatform: "myspace" })).toMatchObject({ ok: false });
    expect(await createContentMaster({ title: "x", pillar: "service", primaryPlatform: "tiktok", targetDurationSec: 42 })).toMatchObject({ ok: false });
  });
  it("inserts a draft owned by the admin", async () => {
    const { createContentMaster } = await load();
    const res = await createContentMaster({ title: "  Hook test ", pillar: "case_story", primaryPlatform: "instagram_reel", targetDurationSec: 30 });
    expect(res).toMatchObject({ ok: true, data: { id: "studio_content_masters-new" } });
    expect(h.inserts.studio_content_masters?.[0]).toMatchObject({ title: "Hook test", pillar: "case_story", primary_platform: "instagram_reel", target_duration_sec: 30, status: "draft", created_by: "admin-1" });
  });
});

describe("saveMasterFields", () => {
  it("refuses non-admins", async () => {
    h.profile = null;
    const { saveMasterFields } = await load();
    expect(await saveMasterFields({ id: MASTER, hook: "x" })).toMatchObject({ ok: false });
  });
  it("patches only provided fields and derives estimated duration from the script", async () => {
    const { saveMasterFields } = await load();
    const res = await saveMasterFields({ id: MASTER, script: "สวัสดีครับ วันนี้เรามาดูกันว่านักสืบมองหาอะไรในสิบนาทีแรก" });
    expect(res).toMatchObject({ ok: true });
    const patch = h.updates.studio_content_masters?.[0] ?? {};
    expect(Object.keys(patch).sort()).toEqual(["estimated_duration_sec", "script"]);
    expect(typeof patch.estimated_duration_sec).toBe("number");
    expect(patch.estimated_duration_sec as number).toBeGreaterThan(0);
    if (res.ok) expect(res.data.estimatedDurationSec).toBe(patch.estimated_duration_sec);
  });
  it("rejects an empty title", async () => {
    const { saveMasterFields } = await load();
    expect(await saveMasterFields({ id: MASTER, title: "   " })).toMatchObject({ ok: false });
  });
  it("surfaces db errors honestly", async () => {
    h.errors.studio_content_masters = { message: "boom" };
    const { saveMasterFields } = await load();
    expect(await saveMasterFields({ id: MASTER, hook: "x" })).toMatchObject({ ok: false });
  });
});

describe("sources", () => {
  it("requires a source id for knowledge kinds, allows external without", async () => {
    const { addContentSource } = await load();
    expect(await addContentSource({ masterId: MASTER, kind: "knowledge", label: "K" })).toMatchObject({ ok: false });
    expect(await addContentSource({ masterId: MASTER, kind: "external", label: "PDPA ม.24", note: "law" })).toMatchObject({ ok: true });
    expect(h.inserts.studio_content_sources?.[0]).toMatchObject({ source_kind: "external", source_id: null, label: "PDPA ม.24" });
  });
  it("blocks duplicates", async () => {
    h.rows.studio_content_sources = [{ id: "s1" }];
    const { addContentSource } = await load();
    expect(await addContentSource({ masterId: MASTER, kind: "knowledge", sourceId: KNOWLEDGE, label: "K" })).toMatchObject({ ok: false });
    expect(h.inserts.studio_content_sources).toBeUndefined();
  });
});

describe("upsertVariants", () => {
  it("replaces existing rows for the same platforms then inserts", async () => {
    const { upsertVariants } = await load();
    const res = await upsertVariants({
      masterId: MASTER,
      variants: [{ platform: "facebook", format: "post", hook: "h", script: null, caption: "cap", cta: "c" }],
    });
    expect(res).toMatchObject({ ok: true, data: { count: 1 } });
    expect(h.deletes).toEqual(["studio_content_variants"]);
    expect(h.inserts.studio_content_variants?.[0]).toMatchObject({ platform: "facebook", format: "post", char_count: 3 });
  });
  it("rejects unknown platforms", async () => {
    const { upsertVariants } = await load();
    expect(await upsertVariants({ masterId: MASTER, variants: [{ platform: "myspace", format: "post" }] })).toMatchObject({ ok: false });
  });
});

describe("applyGeneratedScript", () => {
  it("writes copy, replaces claims, merges sources and stores a privacy check", async () => {
    h.rows.studio_content_masters = [{ id: MASTER, title: "T", hook: "h", script: "s", caption: "c", cta: "x" }];
    h.rows.studio_content_sources = [{ source_kind: "knowledge", source_id: KNOWLEDGE }];
    const { applyGeneratedScript } = await load();
    const res = await applyGeneratedScript({
      masterId: MASTER,
      hook: "H",
      script: "สคริปต์ใหม่",
      caption: "C",
      cta: "CTA",
      aiNotes: "n",
      sourceRefs: [
        { kind: "knowledge", id: KNOWLEDGE, label: "dup" },
        { kind: "ai_general", id: null, label: "general" },
      ],
      claims: [{ claim: "x", support_status: "ai_suggestion", source: null }],
    });
    expect(res).toMatchObject({ ok: true, data: { privacyStatus: "safe" } });
    expect(h.updates.studio_content_masters?.[0]).toMatchObject({ hook: "H", script: "สคริปต์ใหม่", ai_notes: "n" });
    expect(h.inserts.studio_content_claims?.length).toBe(1);
    // the knowledge ref already existed → only ai_general is added
    expect(h.inserts.studio_content_sources?.map((s) => s.source_kind)).toEqual(["ai_general"]);
    expect(h.inserts.studio_privacy_checks?.[0]).toMatchObject({ master_id: MASTER, checked_by: "deterministic" });
  });
});
