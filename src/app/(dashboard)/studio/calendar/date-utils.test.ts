import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  buildBangkokISO,
  dayKeyInBangkok,
  formatThaiDayShort,
  formatThaiMonth,
  formatThaiWeekRange,
  isDayKey,
  isTimeString,
  monthGrid,
  rangeForView,
  shiftToDay,
  startOfWeek,
  timeInBangkok,
  weekDays,
  weekdayIndex,
} from "./date-utils";

describe("day keys", () => {
  it("validates YYYY-MM-DD including month lengths", () => {
    expect(isDayKey("2026-09-09")).toBe(true);
    expect(isDayKey("2026-02-29")).toBe(false); // 2026 is not a leap year
    expect(isDayKey("2028-02-29")).toBe(true);
    expect(isDayKey("2026-13-01")).toBe(false);
    expect(isDayKey("09/09/2026")).toBe(false);
    expect(isDayKey(undefined)).toBe(false);
  });

  it("validates HH:mm", () => {
    expect(isTimeString("19:00")).toBe(true);
    expect(isTimeString("23:59")).toBe(true);
    expect(isTimeString("24:00")).toBe(false);
    expect(isTimeString("7:00")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("navigates months to the first day", () => {
    expect(addMonths("2026-09-15", 1)).toBe("2026-10-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
    expect(addMonths("2026-12-05", 1)).toBe("2027-01-01");
  });
});

describe("Bangkok conversions", () => {
  it("builds an ISO instant from a Bangkok day + time with the +07:00 offset", () => {
    expect(buildBangkokISO("2026-09-09", "19:00")).toBe("2026-09-09T12:00:00.000Z");
    // Early-morning Bangkok is the previous UTC day.
    expect(buildBangkokISO("2026-09-09", "02:30")).toBe("2026-09-08T19:30:00.000Z");
  });

  it("defaults to 19:00 and rejects bad input", () => {
    expect(buildBangkokISO("2026-09-09")).toBe("2026-09-09T12:00:00.000Z");
    expect(() => buildBangkokISO("2026-9-9")).toThrow();
    expect(() => buildBangkokISO("2026-09-09", "25:00")).toThrow();
  });

  it("reads the Bangkok day and time back from a UTC instant", () => {
    expect(dayKeyInBangkok("2026-09-08T19:30:00.000Z")).toBe("2026-09-09");
    expect(timeInBangkok("2026-09-08T19:30:00.000Z")).toBe("02:30");
    expect(timeInBangkok("2026-09-09T12:00:00.000Z")).toBe("19:00");
    expect(timeInBangkok("2026-09-09T17:00:00.000Z")).toBe("00:00");
  });

  it("shifts to another day while keeping the Bangkok time-of-day", () => {
    const original = buildBangkokISO("2026-09-09", "21:15");
    const moved = shiftToDay(original, "2026-09-20");
    expect(moved).toBe("2026-09-20T14:15:00.000Z");
    expect(dayKeyInBangkok(moved)).toBe("2026-09-20");
    expect(timeInBangkok(moved)).toBe("21:15");
  });
});

describe("grids", () => {
  it("uses Monday as the first weekday", () => {
    expect(weekdayIndex("2026-09-07")).toBe(0); // Monday
    expect(weekdayIndex("2026-09-13")).toBe(6); // Sunday
    expect(startOfWeek("2026-09-09")).toBe("2026-09-07");
    expect(startOfWeek("2026-09-13")).toBe("2026-09-07");
  });

  it("returns a 7-day week starting Monday", () => {
    const days = weekDays("2026-09-09");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-09-07");
    expect(days[6]).toBe("2026-09-13");
  });

  it("builds a full-week month grid with only the rows needed", () => {
    // September 2026 starts on a Tuesday and has 30 days → 5 rows.
    const sep = monthGrid("2026-09-09");
    expect(sep).toHaveLength(35);
    expect(sep[0]).toBe("2026-08-31");
    expect(sep[34]).toBe("2026-10-04");
    // June 2026 starts Monday, 30 days → exactly 5 rows with no leading days.
    const jun = monthGrid("2026-06-01");
    expect(jun[0]).toBe("2026-06-01");
    expect(jun).toHaveLength(35);
    // August 2026 starts Saturday, 31 days → 6 rows.
    expect(monthGrid("2026-08-01")).toHaveLength(42);
  });

  it("derives a half-open UTC query range for a view", () => {
    const week = rangeForView("week", "2026-09-09");
    expect(week.days[0]).toBe("2026-09-07");
    expect(week.start).toBe("2026-09-06T17:00:00.000Z");
    expect(week.end).toBe("2026-09-13T17:00:00.000Z");
  });
});

describe("Thai formatting (Gregorian)", () => {
  it("formats month names with a Gregorian year", () => {
    expect(formatThaiMonth("2026-09-09")).toBe("กันยายน 2026");
    expect(formatThaiMonth("2026-01-01")).toBe("มกราคม 2026");
  });

  it("formats short days and week ranges", () => {
    expect(formatThaiDayShort("2026-09-09")).toBe("9 ก.ย.");
    expect(formatThaiWeekRange("2026-09-09")).toBe("7 – 13 ก.ย. 2026");
    expect(formatThaiWeekRange("2026-09-30")).toBe("28 ก.ย. – 4 ต.ค. 2026");
  });
});
