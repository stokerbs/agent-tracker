import { describe, expect, it, vi } from "vitest";
import { insertLeadResilient, isMissingColumnError, withoutOptionalColumns } from "./lead-insert";

describe("lead insert resilience (deploy before migrations 0127/0128)", () => {
  it("recognises undefined-column and schema-cache errors only", () => {
    expect(isMissingColumnError({ code: "42703" })).toBe(true);
    expect(isMissingColumnError({ code: "PGRST204", message: "Could not find the 'channel' column of 'marketing_leads' in the schema cache" })).toBe(true);
    expect(isMissingColumnError({ code: null, message: 'column "gclid" of relation "marketing_leads" does not exist' })).toBe(true);
    expect(isMissingColumnError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingColumnError({ code: "23514", message: "check constraint" })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });

  it("strips only the optional attribution columns", () => {
    const row = { name: "a", phone: "1", utm_source: "google", utm_content: "ad1", gclid: "g", fbclid: "f", channel: "paid_search", lead_ref: "TH-1" };
    expect(withoutOptionalColumns(row)).toEqual({ name: "a", phone: "1", utm_source: "google", lead_ref: "TH-1" });
  });

  it("retries once without the optional columns on a missing-column error, and never otherwise", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const exec = vi.fn()
      .mockResolvedValueOnce({ error: { code: "PGRST204", message: "Could not find the 'channel' column" } })
      .mockResolvedValueOnce({ error: null });
    const res = await insertLeadResilient({ name: "a", channel: "paid_search", gclid: "g" }, exec);
    expect(res.error).toBeNull();
    expect(exec).toHaveBeenCalledTimes(2);
    expect(exec.mock.calls[1]![0]).toEqual({ name: "a" });
    expect(warn).toHaveBeenCalledTimes(1);

    const dup = vi.fn().mockResolvedValue({ error: { code: "23505", message: "duplicate" } });
    const r2 = await insertLeadResilient({ name: "a", channel: "x" }, dup);
    expect(r2.error?.code).toBe("23505");
    expect(dup).toHaveBeenCalledTimes(1);

    const ok = vi.fn().mockResolvedValue({ error: null, data: { id: "1" } });
    await insertLeadResilient({ name: "a" }, ok);
    expect(ok).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
