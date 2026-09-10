/**
 * Media action tests: admin gate, zod validation, server-side sourcing of the
 * voice text (never from the client), delete removes row + object.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const MASTER = "11111111-1111-4111-8111-111111111111";
const VARIANT = "22222222-2222-4222-8222-222222222222";
const ASSET = "33333333-3333-4333-8333-333333333333";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  profile: { id: "admin-1", role: "admin" } as { id: string; role: string } | null,
  rows: {} as Record<string, Row | null>,
  deletes: [] as string[],
  image: vi.fn(),
  voice: vi.fn(),
  removed: [] as (string | null)[],
  audit: [] as { action: string }[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async (e: { action: string }) => void h.audit.push(e)) }));
vi.mock("@/lib/studio/auth", () => ({ getStudioAdmin: vi.fn(async () => h.profile) }));
vi.mock("@/lib/studio/media/generate", () => ({
  generateImageAsset: (i: unknown) => h.image(i),
  generateVoiceoverAsset: (i: unknown) => h.voice(i),
  removeAssetObject: vi.fn(async (p: string | null) => void h.removed.push(p)),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      let op = "select";
      for (const m of ["select", "eq"]) b[m] = () => b;
      b.delete = () => ((op = "delete"), b);
      b.maybeSingle = async () => ({ data: h.rows[table] ?? null, error: null });
      b.then = (r: (v: unknown) => unknown) => {
        if (op === "delete") h.deletes.push(table);
        return Promise.resolve(r({ data: null, error: null }));
      };
      return b;
    },
  }),
}));

const okAsset = { id: ASSET, kind: "image", model: "m", master_id: MASTER };

beforeEach(() => {
  h.profile = { id: "admin-1", role: "admin" };
  h.rows = {
    studio_content_masters: { id: MASTER, title: "T", script: "สคริปต์หลักที่บันทึกไว้", hook: "hook ที่บันทึกไว้", creative_plan: null, status: "draft" },
    studio_content_variants: { id: VARIANT, platform: "tiktok", script: "สคริปต์ variant", hook: null },
    studio_creative_assets: { id: ASSET, master_id: MASTER, storage_path: `${MASTER}/${ASSET}.png` },
  };
  h.deletes = [];
  h.removed = [];
  h.audit = [];
  h.image.mockReset().mockResolvedValue({ ok: true, asset: okAsset });
  h.voice.mockReset().mockResolvedValue({ ok: true, asset: { ...okAsset, kind: "audio" } });
});

describe("generateImage", () => {
  it("rejects non-admins and invalid input before touching the generator", async () => {
    const { generateImage } = await import("./media-actions");
    h.profile = null;
    expect(await generateImage({ masterId: MASTER, target: { kind: "thumbnail" }, aspect: "9:16" })).toMatchObject({ ok: false, code: "unauthorized" });
    h.profile = { id: "admin-1", role: "admin" };
    expect(await generateImage({ masterId: "nope", target: { kind: "thumbnail" }, aspect: "9:16" })).toMatchObject({ ok: false, code: "invalid" });
    expect(await generateImage({ masterId: MASTER, target: { kind: "custom", text: "x".repeat(700) }, aspect: "9:16" })).toMatchObject({ ok: false, code: "invalid" });
    expect(await generateImage({ masterId: MASTER, target: { kind: "thumbnail" }, aspect: "3:2" })).toMatchObject({ ok: false, code: "invalid" });
    expect(h.image).not.toHaveBeenCalled();
  });
  it("passes the RLS-loaded master to the generator and audits success", async () => {
    const { generateImage } = await import("./media-actions");
    const r = await generateImage({ masterId: MASTER, target: { kind: "scene", index: 0 }, aspect: "1:1" });
    expect(r.ok).toBe(true);
    expect(h.image).toHaveBeenCalledWith(expect.objectContaining({ master: expect.objectContaining({ id: MASTER, title: "T" }), target: { kind: "scene", index: 0 }, aspect: "1:1", userId: "admin-1" }));
    expect(h.audit.map((a) => a.action)).toContain("STUDIO_MEDIA_GENERATE");
  });
  it("locks media on published content (generate + delete) server-side", async () => {
    h.rows.studio_content_masters = { ...(h.rows.studio_content_masters as Row), status: "published" };
    const { generateImage, generateVoiceover, deleteMediaAsset } = await import("./media-actions");
    expect(await generateImage({ masterId: MASTER, target: { kind: "thumbnail" }, aspect: "9:16" })).toMatchObject({ ok: false, code: "invalid" });
    expect(await generateVoiceover({ masterId: MASTER, source: { kind: "script" } })).toMatchObject({ ok: false, code: "invalid" });
    expect((await deleteMediaAsset({ assetId: ASSET })).ok).toBe(false);
    expect(h.image).not.toHaveBeenCalled();
    expect(h.voice).not.toHaveBeenCalled();
    expect(h.deletes).toHaveLength(0);
  });
  it("returns not_found when the master is invisible to the caller", async () => {
    h.rows.studio_content_masters = null;
    const { generateImage } = await import("./media-actions");
    expect(await generateImage({ masterId: MASTER, target: { kind: "thumbnail" }, aspect: "9:16" })).toMatchObject({ ok: false, code: "not_found" });
  });
});

describe("generateVoiceover", () => {
  it("reads the text server-side from the saved master / variant", async () => {
    const { generateVoiceover } = await import("./media-actions");
    await generateVoiceover({ masterId: MASTER, source: { kind: "script" } });
    expect(h.voice).toHaveBeenLastCalledWith(expect.objectContaining({ text: "สคริปต์หลักที่บันทึกไว้", label: "พากย์สคริปต์หลัก", variantId: null }));
    await generateVoiceover({ masterId: MASTER, source: { kind: "hook" } });
    expect(h.voice).toHaveBeenLastCalledWith(expect.objectContaining({ text: "hook ที่บันทึกไว้" }));
    await generateVoiceover({ masterId: MASTER, source: { kind: "variant", variantId: VARIANT } });
    expect(h.voice).toHaveBeenLastCalledWith(expect.objectContaining({ text: "สคริปต์ variant", variantId: VARIANT, label: "พากย์ variant tiktok" }));
  });
  it("ignores any client-supplied text and rejects unknown variants", async () => {
    const { generateVoiceover } = await import("./media-actions");
    await generateVoiceover({ masterId: MASTER, source: { kind: "script" }, text: "ข้อความจากฝั่ง client" });
    expect(h.voice).toHaveBeenLastCalledWith(expect.objectContaining({ text: "สคริปต์หลักที่บันทึกไว้" }));
    h.rows.studio_content_variants = null;
    expect(await generateVoiceover({ masterId: MASTER, source: { kind: "variant", variantId: VARIANT } })).toMatchObject({ ok: false, code: "not_found" });
  });
  it("surfaces generator errors unchanged (e.g. blocked)", async () => {
    h.voice.mockResolvedValue({ ok: false, error: "สคริปต์ยังมีข้อมูลที่ระบุตัวตนได้", code: "blocked" });
    const { generateVoiceover } = await import("./media-actions");
    expect(await generateVoiceover({ masterId: MASTER, source: { kind: "script" } })).toMatchObject({ ok: false, code: "blocked" });
    expect(h.audit).toHaveLength(0);
  });
});

describe("deleteMediaAsset", () => {
  it("deletes the row, removes the object and audits", async () => {
    const { deleteMediaAsset } = await import("./media-actions");
    expect(await deleteMediaAsset({ assetId: ASSET })).toEqual({ ok: true });
    expect(h.deletes).toEqual(["studio_creative_assets"]);
    expect(h.removed).toEqual([`${MASTER}/${ASSET}.png`]);
    expect(h.audit.map((a) => a.action)).toContain("STUDIO_MEDIA_DELETE");
  });
  it("refuses non-admins and unknown assets", async () => {
    const { deleteMediaAsset } = await import("./media-actions");
    h.profile = null;
    expect((await deleteMediaAsset({ assetId: ASSET })).ok).toBe(false);
    h.profile = { id: "admin-1", role: "admin" };
    h.rows.studio_creative_assets = null;
    expect((await deleteMediaAsset({ assetId: ASSET })).ok).toBe(false);
    expect(h.deletes).toHaveLength(0);
  });
});
