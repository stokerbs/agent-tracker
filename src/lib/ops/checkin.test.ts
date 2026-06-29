import { describe, expect, it } from "vitest";
import { evaluateCheckin } from "./checkin";

const NOW = new Date("2026-06-30T12:00:00Z");
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

const base = { intervalMin: 30, graceMin: 15, now: NOW } as const;

describe("evaluateCheckin", () => {
  it("on track when the last report is within the interval", () => {
    const r = evaluateCheckin({ ...base, lastReportAt: minsAgo(10), stage: "ok" });
    expect(r).toMatchObject({ stage: "ok", action: "none" });
  });

  it("reminds once when overdue within the grace window", () => {
    const r = evaluateCheckin({ ...base, lastReportAt: minsAgo(35), stage: "ok" });
    expect(r).toMatchObject({ stage: "reminded", action: "remind" });
  });

  it("does not remind again once already reminded", () => {
    const r = evaluateCheckin({ ...base, lastReportAt: minsAgo(40), stage: "reminded" });
    expect(r).toMatchObject({ stage: "reminded", action: "none" });
  });

  it("escalates once past interval + grace", () => {
    const r = evaluateCheckin({ ...base, lastReportAt: minsAgo(50), stage: "reminded" });
    expect(r).toMatchObject({ stage: "escalated", action: "escalate" });
  });

  it("does not escalate again once already escalated", () => {
    const r = evaluateCheckin({ ...base, lastReportAt: minsAgo(120), stage: "escalated" });
    expect(r).toMatchObject({ stage: "escalated", action: "none" });
  });

  it("escalates directly from ok if badly overdue (e.g. cron was down)", () => {
    const r = evaluateCheckin({ ...base, lastReportAt: minsAgo(200), stage: "ok" });
    expect(r).toMatchObject({ stage: "escalated", action: "escalate" });
  });

  it("resets to ok after a fresh report (re-arms the cycle)", () => {
    const r = evaluateCheckin({ ...base, lastReportAt: minsAgo(2), stage: "escalated" });
    expect(r).toMatchObject({ stage: "ok", action: "none" });
  });

  it("never nags when there is no timestamp to judge against", () => {
    const r = evaluateCheckin({ ...base, lastReportAt: null, stage: "ok" });
    expect(r).toMatchObject({ stage: "ok", action: "none" });
  });

  it("honours a custom grace window", () => {
    // 35 min overdue with a 2-min grace → already past interval+grace → escalate.
    const r = evaluateCheckin({ intervalMin: 30, graceMin: 2, now: NOW, lastReportAt: minsAgo(35), stage: "ok" });
    expect(r.action).toBe("escalate");
  });
});
