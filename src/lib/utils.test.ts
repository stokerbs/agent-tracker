import { describe, expect, it } from "vitest";
import {
  bangkokDateKey,
  batteryColor,
  formatCurrency,
  formatDate,
} from "@/lib/utils";

// TD-3 (Golden Rule 5): pin the CURRENT behavior of the centralized helpers.
// These tests document existing output; they must NOT drive any change to the
// helper bodies. Display formatting here is intentionally en-US/USD — call
// sites that render to users localize separately and are out of scope.

describe("formatDate", () => {
  it("returns the em-dash placeholder for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("renders the en-US short form 'MMM D, YYYY'", () => {
    // Construct at local noon so the rendered day cannot shift across the
    // CI timezone (formatDate uses no timeZone option → local time).
    const d = new Date(2026, 5, 25, 12, 0, 0);
    expect(formatDate(d)).toBe("Jun 25, 2026");
    expect(formatDate(d)).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  });
});

describe("formatCurrency", () => {
  it("formats USD by default with symbol, grouping and 2 decimals", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("formats THB using the en-US currency-code form", () => {
    // Intl separates the currency code from the amount with a non-breaking
    // space (U+00A0), not an ASCII space.
    expect(formatCurrency(1234.56, "THB")).toBe("THB\u00A01,234.56");
  });
});

describe("batteryColor", () => {
  it("returns the slate token for null", () => {
    expect(batteryColor(null)).toBe("text-slate-400");
  });

  it("returns red at and below the 15 boundary", () => {
    expect(batteryColor(15)).toBe("text-red-500");
  });

  it("returns amber across the 16–35 band (inclusive boundaries)", () => {
    expect(batteryColor(16)).toBe("text-amber-500");
    expect(batteryColor(35)).toBe("text-amber-500");
  });

  it("returns emerald above 35", () => {
    expect(batteryColor(36)).toBe("text-emerald-500");
  });
});

describe("bangkokDateKey", () => {
  it("returns a YYYY-MM-DD shaped key", () => {
    expect(bangkokDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("preserves the Asia/Bangkok (UTC+7) timezone for a cross-day instant", () => {
    // 2026-06-25T20:00:00Z is already 2026-06-26 03:00 in Bangkok.
    const instant = new Date("2026-06-25T20:00:00Z");
    expect(bangkokDateKey(instant)).toBe("2026-06-26");
  });

  it("formats an explicit date argument as its Bangkok date key", () => {
    const instant = new Date("2026-06-25T10:00:00Z"); // 17:00 Bangkok, same day
    expect(bangkokDateKey(instant)).toBe("2026-06-25");
  });
});
