import { describe, it, expect } from "vitest";
import {
  airTagBangkokDateOf,
  airTagMinDate,
  shiftAirTagDay,
  formatSourceLabel,
  pageCountFor,
  clampPage,
} from "./air-tag-replay-utils";

describe("airTagBangkokDateOf", () => {
  it("converts a UTC timestamp to its Bangkok (GMT+7) calendar day", () => {
    // 2026-06-07T18:00:00Z is 2026-06-08 01:00 in Bangkok.
    expect(airTagBangkokDateOf("2026-06-07T18:00:00.000Z")).toBe("2026-06-08");
  });

  it("returns null for null/undefined/invalid input", () => {
    expect(airTagBangkokDateOf(null)).toBeNull();
    expect(airTagBangkokDateOf(undefined)).toBeNull();
    expect(airTagBangkokDateOf("not-a-date")).toBeNull();
  });
});

describe("shiftAirTagDay", () => {
  it("shifts forward and backward across a month boundary", () => {
    expect(shiftAirTagDay("2026-06-30", 1)).toBe("2026-07-01");
    expect(shiftAirTagDay("2026-07-01", -1)).toBe("2026-06-30");
  });

  it("is a no-op for delta 0", () => {
    expect(shiftAirTagDay("2026-06-15", 0)).toBe("2026-06-15");
  });
});

describe("airTagMinDate — unbounded-back-to-tracker-creation (no 30-day cap unlike GPS903)", () => {
  it("uses the tracker's created_at Bangkok day when valid", () => {
    expect(airTagMinDate("2024-01-01T00:00:00.000Z")).toBe("2024-01-01");
  });

  it("falls back to a fixed floor when created_at is missing", () => {
    expect(airTagMinDate(null)).toBe("2000-01-01");
    expect(airTagMinDate(undefined)).toBe("2000-01-01");
  });

  it("falls back to a fixed floor when created_at is unparseable", () => {
    expect(airTagMinDate("garbage")).toBe("2000-01-01");
  });
});

describe("formatSourceLabel", () => {
  it("labels manual entries", () => {
    expect(formatSourceLabel("manual")).toBe("Manual");
  });
  it("labels CSV imports", () => {
    expect(formatSourceLabel("csv_import")).toBe("CSV import");
  });
  it("passes through an unrecognized source rather than throwing", () => {
    expect(formatSourceLabel("something_new")).toBe("something_new");
  });
});

describe("pageCountFor", () => {
  it("computes page count from total/pageSize", () => {
    expect(pageCountFor(0, 25)).toBe(1);
    expect(pageCountFor(25, 25)).toBe(1);
    expect(pageCountFor(26, 25)).toBe(2);
    expect(pageCountFor(250, 25)).toBe(10);
  });
  it("never returns less than 1, even for a zero/negative pageSize", () => {
    expect(pageCountFor(10, 0)).toBe(1);
    expect(pageCountFor(10, -5)).toBe(1);
  });
});

describe("clampPage", () => {
  it("clamps below the range up to 1", () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(-3, 5)).toBe(1);
  });
  it("clamps above the range down to pageCount", () => {
    expect(clampPage(99, 5)).toBe(5);
  });
  it("passes through an in-range page unchanged", () => {
    expect(clampPage(3, 5)).toBe(3);
  });
  it("treats non-finite input as page 1", () => {
    expect(clampPage(Number.NaN, 5)).toBe(1);
  });
});
