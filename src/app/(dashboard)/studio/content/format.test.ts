import { describe, expect, it } from "vitest";
import { buildBangkokISO, timeInBangkok } from "../calendar/date-utils";
import { bangkokLocalInputToIso, formatTimeBkk, toBangkokLocalInput } from "./format";

describe("content/format ↔ calendar/date-utils parity", () => {
  it("datetime-local → ISO matches buildBangkokISO", () => {
    expect(bangkokLocalInputToIso("2026-09-09T19:00")).toBe(buildBangkokISO("2026-09-09", "19:00"));
    expect(bangkokLocalInputToIso("2026-09-09T19:00")).toBe("2026-09-09T12:00:00.000Z");
  });
  it("rejects malformed input", () => {
    expect(bangkokLocalInputToIso("nope")).toBeNull();
    expect(bangkokLocalInputToIso("2026-02-30T10:00")).toBeNull();
    expect(bangkokLocalInputToIso("2026-09-09T25:00")).toBeNull();
  });
  it("round-trips through the input value", () => {
    const iso = "2026-09-09T12:30:00.000Z";
    expect(toBangkokLocalInput(iso)).toBe("2026-09-09T19:30");
    expect(bangkokLocalInputToIso(toBangkokLocalInput(iso))).toBe(iso);
  });
  it("formats HH:mm in Bangkok consistently with the calendar helper", () => {
    const iso = "2026-09-09T17:05:00.000Z";
    expect(formatTimeBkk(iso)).toBe("00:05");
    expect(formatTimeBkk(iso)).toBe(timeInBangkok(iso));
  });
});
