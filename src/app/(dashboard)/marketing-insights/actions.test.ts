/** Admin ad-spend import: auth gate, validation, upsert payload, audit (counts only). */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireRole: vi.fn(),
  logAudit: vi.fn(),
  revalidatePath: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/errors", () => ({ handleDbError: () => "safe message", reportError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => ({ upsert: h.upsert }) }) }));

import { importAdSpend } from "./actions";

const CSV = "Day,Campaign,Cost,Clicks\n2026-09-01,TH | สืบชู้สาว,1250.50,30\nbad-date,x,1,1\n2026-09-02,EN | Partner,980,14";
function fd(over: Record<string, string> = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ platform: "google_ads", locale: "th", csv: CSV, ...over })) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
  h.upsert.mockResolvedValue({ error: null });
});

describe("importAdSpend", () => {
  it("requires an admin before parsing or writing", async () => {
    h.requireRole.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(importAdSpend(fd())).rejects.toThrow();
    expect(h.upsert).not.toHaveBeenCalled();
    expect(h.requireRole).toHaveBeenCalledWith(["admin"]);
  });

  it("rejects bad input and empty imports without writing", async () => {
    expect(await importAdSpend(fd({ platform: "tiktok" }))).toEqual({ ok: false, error: "invalid_input" });
    expect(await importAdSpend(fd({ csv: "" }))).toEqual({ ok: false, error: "invalid_input" });
    const none = await importAdSpend(fd({ csv: "Day,Cost\nnot-a-date,5" }));
    expect(none).toMatchObject({ ok: false, error: "no_rows" });
    expect((none as { skipped: unknown[] }).skipped).toHaveLength(1);
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("caps very large pastes", async () => {
    const big = "Day,Cost\n" + Array.from({ length: 2001 }, (_, i) => `2026-01-${String((i % 28) + 1).padStart(2, "0")},${i}`).join("\n");
    expect(await importAdSpend(fd({ csv: big, locale: "all" }))).toEqual({ ok: false, error: "too_many_rows" });
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("upserts valid rows with the admin as importer, reports skipped lines, audits counts only, revalidates", async () => {
    const res = await importAdSpend(fd());
    expect(res).toMatchObject({ ok: true, imported: 2 });
    expect((res as { skipped: { line: number }[] }).skipped.map((s) => s.line)).toEqual([3]);
    const [rows, opts] = h.upsert.mock.calls[0]!;
    expect(opts).toEqual({ onConflict: "spend_date,platform,campaign,locale" });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ spend_date: "2026-09-01", platform: "google_ads", locale: "th", cost: 1250.5, clicks: 30, imported_by: "admin-1" });
    expect(rows[1]).toMatchObject({ spend_date: "2026-09-02", locale: "en" }); // guessed from the campaign name
    const audit = h.logAudit.mock.calls[0]![0];
    expect(audit).toMatchObject({ action: "AD_SPEND_IMPORT", entity: "marketing_ad_spend", metadata: { platform: "google_ads", locale: "th", rows: 2, skipped: 1 } });
    expect(JSON.stringify(audit.metadata)).not.toContain("สืบชู้สาว");
    expect(h.revalidatePath).toHaveBeenCalledWith("/marketing-insights");
  });

  it("returns a safe message on a DB error", async () => {
    h.upsert.mockResolvedValueOnce({ error: { message: "violates check constraint" } });
    expect(await importAdSpend(fd())).toEqual({ ok: false, error: "safe message" });
  });
});
