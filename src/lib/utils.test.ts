import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bangkokDateKey,
  batteryColor,
  formatCurrency,
  formatDate,
  initials,
  timeAgo,
} from "@/lib/utils";

// TD-3b: pin the CANONICAL display behavior of the centralized helpers —
// day-first en-GB dates, THB (฿) currency by default, and battery thresholds
// ≤20 red / ≤50 amber / >50 green. These are the app-wide display standards.

describe("formatDate", () => {
  it("returns the em-dash placeholder for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("renders the en-GB day-first short form 'D MMM YYYY'", () => {
    // Construct at local noon so the rendered day cannot shift across the
    // CI timezone (formatDate uses no timeZone option → local time).
    const d = new Date(2026, 5, 25, 12, 0, 0);
    expect(formatDate(d)).toBe("25 Jun 2026");
    expect(formatDate(d)).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
  });
});

describe("formatCurrency", () => {
  it("formats THB by default with the \u0E3F narrow symbol, grouping and 2 decimals", () => {
    expect(formatCurrency(1234.56)).toBe("\u0E3F1,234.56");
  });

  it("honors an explicit currency (USD narrow symbol)", () => {
    expect(formatCurrency(1234.56, "USD")).toBe("$1,234.56");
  });
});

describe("batteryColor", () => {
  it("returns the slate token for null", () => {
    expect(batteryColor(null)).toBe("text-slate-400");
  });

  it("returns red at and below the 20 boundary", () => {
    expect(batteryColor(20)).toBe("text-red-500");
  });

  it("returns amber across the 21–50 band (inclusive boundaries)", () => {
    expect(batteryColor(21)).toBe("text-amber-500");
    expect(batteryColor(50)).toBe("text-amber-500");
  });

  it("returns emerald above 50", () => {
    expect(batteryColor(51)).toBe("text-emerald-500");
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

describe("initials", () => {
  it("returns ?? for null / undefined / empty", () => {
    expect(initials(null)).toBe("??");
    expect(initials(undefined)).toBe("??");
    expect(initials("")).toBe("??");
  });

  it("takes the first letter of a single name, uppercased", () => {
    expect(initials("john")).toBe("J");
  });

  it("takes the first two words' initials and caps at two", () => {
    expect(initials("John Smith")).toBe("JS");
    expect(initials("john smith doe")).toBe("JS");
  });

  it("ignores surrounding / repeated whitespace", () => {
    expect(initials("  alice  ")).toBe("A");
  });
});

describe("timeAgo", () => {
  afterEach(() => vi.useRealTimers());

  function at(deltaMs: number): Date {
    return new Date(Date.now() - deltaMs);
  }

  it("returns the em-dash for null", () => {
    expect(timeAgo(null)).toBe("—");
  });

  it("buckets recent instants into relative phrases", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T12:00:00Z"));
    expect(timeAgo(at(2_000))).toBe("just now");          // < 5s
    expect(timeAgo(at(30_000))).toBe("30s ago");          // < 60s
    expect(timeAgo(at(5 * 60_000))).toBe("5m ago");       // < 60m
    expect(timeAgo(at(3 * 3_600_000))).toBe("3h ago");    // < 24h
    expect(timeAgo(at(5 * 86_400_000))).toBe("5d ago");   // < 30d
  });
});
