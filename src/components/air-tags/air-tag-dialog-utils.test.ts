import { describe, it, expect } from "vitest";
import {
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  isLatInRange,
  isLngInRange,
  isPositiveIntString,
  buildAirTagCsvTemplate,
  isCsvFileName,
  AIR_TAG_CSV_TEMPLATE_HEADER,
} from "./air-tag-dialog-utils";

describe("toDatetimeLocalValue / fromDatetimeLocalValue", () => {
  it("round-trips a date through the datetime-local format", () => {
    const d = new Date(2026, 0, 15, 8, 30, 0);
    const s = toDatetimeLocalValue(d);
    expect(s).toBe("2026-01-15T08:30");
    const back = fromDatetimeLocalValue(s);
    expect(back?.getFullYear()).toBe(2026);
    expect(back?.getMonth()).toBe(0);
    expect(back?.getDate()).toBe(15);
    expect(back?.getHours()).toBe(8);
    expect(back?.getMinutes()).toBe(30);
  });

  it("zero-pads single-digit month/day/hour/minute", () => {
    const d = new Date(2026, 8, 2, 3, 5, 0);
    expect(toDatetimeLocalValue(d)).toBe("2026-09-02T03:05");
  });

  it("returns null for an empty or unparseable datetime-local value", () => {
    expect(fromDatetimeLocalValue("")).toBeNull();
    expect(fromDatetimeLocalValue("not-a-date")).toBeNull();
  });
});

describe("isLatInRange", () => {
  it("accepts values within -90..90", () => {
    expect(isLatInRange("13.7")).toBe(true);
    expect(isLatInRange("-90")).toBe(true);
    expect(isLatInRange("90")).toBe(true);
  });
  it("rejects out-of-range, empty, or non-numeric values", () => {
    expect(isLatInRange("91")).toBe(false);
    expect(isLatInRange("-91")).toBe(false);
    expect(isLatInRange("")).toBe(false);
    expect(isLatInRange("abc")).toBe(false);
  });
});

describe("isLngInRange", () => {
  it("accepts values within -180..180", () => {
    expect(isLngInRange("100.5")).toBe(true);
    expect(isLngInRange("-180")).toBe(true);
    expect(isLngInRange("180")).toBe(true);
  });
  it("rejects out-of-range, empty, or non-numeric values", () => {
    expect(isLngInRange("181")).toBe(false);
    expect(isLngInRange("-181")).toBe(false);
    expect(isLngInRange("")).toBe(false);
    expect(isLngInRange("xyz")).toBe(false);
  });
});

describe("isPositiveIntString", () => {
  it("treats an empty string as valid (optional field)", () => {
    expect(isPositiveIntString("")).toBe(true);
    expect(isPositiveIntString("   ")).toBe(true);
  });
  it("accepts positive integers", () => {
    expect(isPositiveIntString("5")).toBe(true);
    expect(isPositiveIntString("500")).toBe(true);
  });
  it("rejects zero, negatives, decimals, and non-numeric strings", () => {
    expect(isPositiveIntString("0")).toBe(false);
    expect(isPositiveIntString("-5")).toBe(false);
    expect(isPositiveIntString("5.5")).toBe(false);
    expect(isPositiveIntString("abc")).toBe(false);
  });
});

describe("buildAirTagCsvTemplate", () => {
  it("starts with the required header row matching importAirTagPingsCsv's expected columns", () => {
    const tpl = buildAirTagCsvTemplate();
    expect(tpl.startsWith(AIR_TAG_CSV_TEMPLATE_HEADER)).toBe(true);
  });
  it("includes an example data row so users see the expected format", () => {
    const lines = buildAirTagCsvTemplate().trim().split("\n");
    expect(lines).toHaveLength(2);
  });
});

describe("isCsvFileName", () => {
  it("accepts .csv (any case)", () => {
    expect(isCsvFileName("pings.csv")).toBe(true);
    expect(isCsvFileName("PINGS.CSV")).toBe(true);
  });
  it("rejects non-csv extensions", () => {
    expect(isCsvFileName("pings.txt")).toBe(false);
    expect(isCsvFileName("pings.xlsx")).toBe(false);
    expect(isCsvFileName("pings")).toBe(false);
  });
});
