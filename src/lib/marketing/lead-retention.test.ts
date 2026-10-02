import { describe, expect, it } from "vitest";
import { LEAD_RETENTION_DAYS, isPurgeable, purgeMode, retentionCutoff } from "./lead-retention";

const NOW = new Date("2026-10-02T00:00:00Z");
const old = "2025-06-01T00:00:00Z"; // > 365 days before NOW
const recent = "2026-08-01T00:00:00Z";
const base = { id: "l", stage: "closed", lead_quality: "unrated", converted_at: null, stage_changed_at: old, created_at: old };

describe("lead retention", () => {
  it("12-month window", () => {
    expect(LEAD_RETENTION_DAYS).toBe(365);
    expect(retentionCutoff(NOW).toISOString()).toBe("2025-10-02T00:00:00.000Z");
  });

  it("never purges converted leads, whatever their age or stage", () => {
    expect(isPurgeable({ ...base, converted_at: "2025-01-01T00:00:00Z" }, NOW)).toBe(false);
    expect(isPurgeable({ ...base, stage: "closed", converted_at: "2025-01-01T00:00:00Z", lead_quality: "spam" }, NOW)).toBe(false);
  });

  it("purges only dead leads older than the window", () => {
    expect(isPurgeable(base, NOW)).toBe(true); // closed, old
    expect(isPurgeable({ ...base, stage: "referral" }, NOW)).toBe(true);
    expect(isPurgeable({ ...base, stage: "contacted", lead_quality: "spam" }, NOW)).toBe(true);
    expect(isPurgeable({ ...base, stage: "qualified", lead_quality: "unqualified" }, NOW)).toBe(true);
    expect(isPurgeable({ ...base, stage: "new", stage_changed_at: null }, NOW)).toBe(true); // never touched
    expect(isPurgeable({ ...base, stage: null, stage_changed_at: null }, NOW)).toBe(true);
    // Live pipeline stages are kept even when old.
    expect(isPurgeable({ ...base, stage: "quotation_sent" }, NOW)).toBe(false);
    expect(isPurgeable({ ...base, stage: "follow_up" }, NOW)).toBe(false);
    // Recent dead leads are kept until the window passes; last change wins over creation.
    expect(isPurgeable({ ...base, stage_changed_at: recent }, NOW)).toBe(false);
    expect(isPurgeable({ ...base, stage_changed_at: null, created_at: recent }, NOW)).toBe(false);
    expect(isPurgeable({ ...base, stage_changed_at: "garbage" }, NOW)).toBe(false);
  });

  it("purge mode is off unless the flag is exactly '1' or 'dry'", () => {
    expect(purgeMode({})).toBe("off");
    expect(purgeMode({ MARKETING_LEAD_PURGE: "true" })).toBe("off");
    expect(purgeMode({ MARKETING_LEAD_PURGE: "dry" })).toBe("dry");
    expect(purgeMode({ MARKETING_LEAD_PURGE: "1" })).toBe("on");
  });
});
