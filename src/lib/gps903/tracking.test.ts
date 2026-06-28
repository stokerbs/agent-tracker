import { describe, expect, it } from "vitest";
import { gps903DateToIso } from "@/lib/gps903/tracking";

describe("gps903DateToIso", () => {
  it("returns null for empty input", () => {
    expect(gps903DateToIso("")).toBeNull();
  });

  it("returns null for an unparseable string", () => {
    expect(gps903DateToIso("not a date")).toBeNull();
  });

  it("passes through an explicit-UTC (Z) timestamp", () => {
    expect(gps903DateToIso("2026-06-25T10:00:00Z")).toBe("2026-06-25T10:00:00.000Z");
  });

  it("honors an explicit timezone offset", () => {
    // +07:00 means 03:00 UTC.
    expect(gps903DateToIso("2026-06-25T10:00:00+07:00")).toBe("2026-06-25T03:00:00.000Z");
  });

  it("treats a bare space-separated GPS903 date as UTC", () => {
    // "deviceUtcDate" has no zone; the function appends Z and reads it as UTC.
    expect(gps903DateToIso("2026-06-25 10:00:00")).toBe("2026-06-25T10:00:00.000Z");
  });

  it("normalizes slash-separated dates", () => {
    expect(gps903DateToIso("2026/06/25 10:00:00")).toBe("2026-06-25T10:00:00.000Z");
  });
});
