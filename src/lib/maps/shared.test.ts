import { describe, expect, it } from "vitest";
import { formatBangkokTime, formatStopMinutes } from "@/lib/maps/shared";

describe("formatBangkokTime", () => {
  it("returns the em-dash for null / undefined / invalid", () => {
    expect(formatBangkokTime(null)).toBe("—");
    expect(formatBangkokTime(undefined)).toBe("—");
    expect(formatBangkokTime("not a date")).toBe("—");
  });

  it("renders a UTC instant in Asia/Bangkok (+7) with the GMT+7 suffix", () => {
    // 10:00 UTC → 17:00 Bangkok, same day.
    expect(formatBangkokTime("2026-06-25T10:00:00Z")).toBe("25 Jun 2026 17:00:00 GMT+7");
  });

  it("rolls over to the next day when +7 crosses midnight", () => {
    // 20:00 UTC → 03:00 Bangkok the next day.
    expect(formatBangkokTime("2026-06-25T20:00:00Z")).toBe("26 Jun 2026 03:00:00 GMT+7");
  });
});

describe("formatStopMinutes", () => {
  it("returns the em-dash for null / undefined / negative", () => {
    expect(formatStopMinutes(null)).toBe("—");
    expect(formatStopMinutes(undefined)).toBe("—");
    expect(formatStopMinutes(-5)).toBe("—");
  });

  it("formats zero and sub-hour durations as minutes", () => {
    expect(formatStopMinutes(0)).toBe("0m");
    expect(formatStopMinutes(45)).toBe("45m");
  });

  it("formats whole and mixed hours", () => {
    expect(formatStopMinutes(60)).toBe("1h");
    expect(formatStopMinutes(90)).toBe("1h 30m");
    expect(formatStopMinutes(125)).toBe("2h 5m");
  });
});
