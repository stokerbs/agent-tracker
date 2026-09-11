import { describe, expect, it } from "vitest";
import type { AutopilotSettings } from "@/lib/studio/types";
import {
  AUTOPILOT_FORMAT_META,
  AUTOPILOT_FORMATS,
  autopilotIssues,
  formatDays,
  imageCostHint,
  nextRunDay,
  nextRunLabel,
  normaliseRunStatus,
  runReason,
  runStatsSummary,
  stopReasonTh,
} from "./autopilot-format";

/** Mirrors DEFAULT_AUTOPILOT (lib/studio/settings) — inlined so this test stays free of server-only imports. */
const BASE: AutopilotSettings = {
  enabled: false,
  days: [1, 4],
  platforms: ["facebook", "instagram"],
  pillar_mode: "rotate",
  pillar: null,
  target_seconds: 30,
  images_per_run: 1,
  auto_publish: true,
  publish_on_review_required: false,
  allow_unsupported_claims: false,
  max_runs_per_week: 3,
  video_format: "template",
};

const cfg = (over: Partial<AutopilotSettings> = {}): AutopilotSettings => ({ ...BASE, ...over });

describe("formatDays", () => {
  it("lists Thai day names in week order", () => {
    expect(formatDays([4, 1])).toBe("จันทร์ · พฤหัสบดี");
  });
  it("de-duplicates and ignores out-of-range days", () => {
    expect(formatDays([1, 1, 9, -2])).toBe("จันทร์");
  });
  it("never returns an empty string", () => {
    expect(formatDays([])).toBe("ยังไม่ได้เลือกวัน");
  });
});

describe("nextRunDay", () => {
  it("counts today as the next run", () => {
    expect(nextRunDay([1, 4], 1)).toEqual({ day: 1, inDays: 0 });
  });
  it("wraps around the week", () => {
    expect(nextRunDay([1], 5)).toEqual({ day: 1, inDays: 3 });
  });
  it("returns null with no days selected", () => {
    expect(nextRunDay([], 3)).toBeNull();
  });
});

describe("nextRunLabel", () => {
  it("says today / tomorrow / in N days", () => {
    expect(nextRunLabel([1, 4], 1)).toBe("วันนี้ (จันทร์)");
    expect(nextRunLabel([4], 3)).toBe("พรุ่งนี้ (พฤหัสบดี)");
    expect(nextRunLabel([1], 5)).toBe("วันจันทร์ (อีก 3 วัน)");
  });
});

describe("run status + reason", () => {
  it("falls back to skipped for unknown DB text", () => {
    expect(normaliseRunStatus("done")).toBe("done");
    expect(normaliseRunStatus("weird")).toBe("skipped");
  });
  it("translates known stop reasons and passes unknown keys through", () => {
    expect(stopReasonTh("privacy_blocked")).toBe("Privacy Check พบข้อมูลที่ระบุตัวตนได้");
    expect(stopReasonTh("something_new")).toBe("something_new");
    expect(stopReasonTh(null)).toBeNull();
  });
  it("prefers the stop reason over the step", () => {
    expect(runReason({ step: "กำลังเลือกหัวข้อ", stopped_at: "weekly_cap" })).toBe("ครบโควตาต่อสัปดาห์แล้ว");
    expect(runReason({ step: "เสร็จแล้ว", stopped_at: null })).toBe("เสร็จแล้ว");
    expect(runReason({ step: null, stopped_at: null })).toBe("—");
  });
});

describe("runStatsSummary", () => {
  it("summarises the jsonb counters", () => {
    expect(runStatsSummary({ images: 2, shots: 5, video_sec: 30, posts: 2 })).toBe("ภาพ 2 · ช็อต 5 · วิดีโอ 30 วิ · โพสต์ 2");
  });
  it("skips missing / malformed values", () => {
    expect(runStatsSummary({ images: 1, video_sec: null })).toBe("ภาพ 1");
    expect(runStatsSummary(null)).toBe("");
    expect(runStatsSummary([1, 2])).toBe("");
  });
  it("names the rendered clip format and flags a storyteller fallback", () => {
    expect(runStatsSummary({ images: 2, format: "storyteller" })).toBe("ภาพ 2 · คลิปนักสืบเล่าเรื่อง");
    expect(runStatsSummary({ images: 1, format: "template", format_fallback: "presenter_failed" })).toBe("ภาพ 1 · คลิปภาพประกอบ (แทนนักสืบเล่าเรื่อง)");
    expect(runStatsSummary({ images: 1, format: "alternate" })).toBe("ภาพ 1");
  });
});

describe("AUTOPILOT_FORMAT_META", () => {
  it("labels every autopilot clip format in select order", () => {
    expect(AUTOPILOT_FORMATS).toEqual(["template", "storyteller", "alternate"]);
    expect(AUTOPILOT_FORMATS.map((f) => AUTOPILOT_FORMAT_META[f].label)).toEqual(["ภาพประกอบ (ไวรัล)", "นักสืบนิรนามเล่าเรื่อง", "สลับกันทุกครั้ง"]);
  });
});

describe("imageCostHint", () => {
  it("multiplies by the per-image cost", () => {
    expect(imageCostHint(1)).toBe("~฿1.5");
    expect(imageCostHint(4)).toBe("~฿6");
    expect(imageCostHint(1, "template")).toBe("~฿1.5");
  });
  it("adds the presenter image for storyteller and shows a range for alternate", () => {
    expect(imageCostHint(1, "storyteller")).toBe("~฿3");
    expect(imageCostHint(3, "storyteller")).toBe("~฿6");
    expect(imageCostHint(1, "alternate")).toBe("~฿1.5–3");
    expect(imageCostHint(4, "alternate")).toBe("~฿6–7.5");
  });
});

describe("autopilotIssues", () => {
  it("passes the default config", () => {
    expect(autopilotIssues(cfg())).toEqual([]);
  });
  it("mirrors the server rules", () => {
    expect(autopilotIssues(cfg({ days: [] }))).toContain("เลือกอย่างน้อย 1 วัน");
    expect(autopilotIssues(cfg({ platforms: [] }))).toContain("เลือกอย่างน้อย 1 แพลตฟอร์ม");
    expect(autopilotIssues(cfg({ pillar_mode: "fixed", pillar: null }))).toContain("เลือกเสาคอนเทนต์ที่ต้องการกำหนดเอง");
    expect(autopilotIssues(cfg({ pillar_mode: "fixed", pillar: "case_story" }))).toEqual([]);
    expect(autopilotIssues(cfg({ images_per_run: 7 }))).toContain("จำนวนภาพต่อรอบต้องอยู่ระหว่าง 1–6");
    expect(autopilotIssues(cfg({ max_runs_per_week: 0 }))).toContain("จำนวนรอบต่อสัปดาห์ต้องอยู่ระหว่าง 1–14");
  });
});
