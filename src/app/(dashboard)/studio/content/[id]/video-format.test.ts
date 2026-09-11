import { describe, expect, it } from "vitest";
import type { CreativePlan } from "@/lib/studio/types";
import { MAX_SHOTS } from "@/lib/studio/video/timeline";
import {
  buildStoryboard,
  clampProgress,
  formatElapsed,
  imageReadiness,
  isActiveRenderStatus,
  jobVideoFormat,
  plannedTotalSec,
  PRESENTER_MISSING_REASON,
  readyImages,
  renderBlockedReason,
  renderStatusMeta,
  SHOT_ROLE_LABEL,
  VIDEO_FORMAT_META,
  videoAssets,
} from "./video-format";

type Lite = { id: string; kind: string; status: string; meta: unknown; mime: string | null };
const img = (id: string, kind: string, meta: unknown = null, status = "ready"): Lite => ({ id, kind, status, meta, mime: "image/png" });
const presenter = (id = "p", status = "ready") => img(id, "image", { aspect: "9:16", target: { kind: "presenter" } }, status);
const plan = (voices: (string | null)[]): CreativePlan => ({
  shots: voices.map((v, i) => ({ start_sec: i * 5, end_sec: i * 5 + 5, voice: v ?? "", visual: `ฉาก ${i + 1}` })),
  broll: [],
  text_overlays: [],
});

describe("video-format helpers", () => {
  it("formats elapsed time as m:ss and never negative", () => {
    expect(formatElapsed(-500)).toBe("0:00");
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(65_400)).toBe("1:05");
    expect(formatElapsed(10 * 60_000)).toBe("10:00");
  });

  it("clamps progress into 0–100", () => {
    expect(clampProgress(null)).toBe(0);
    expect(clampProgress(Number.NaN)).toBe(0);
    expect(clampProgress(-5)).toBe(0);
    expect(clampProgress(42.6)).toBe(43);
    expect(clampProgress(250)).toBe(100);
  });

  it("maps job statuses to Thai pills and treats unknown safely", () => {
    expect(renderStatusMeta("queued").label).toBe("รอเริ่ม");
    expect(renderStatusMeta("running").label).toBe("กำลังทำ");
    expect(renderStatusMeta("done").label).toBe("เสร็จ");
    expect(renderStatusMeta("failed").label).toBe("ล้มเหลว");
    expect(renderStatusMeta("weird").label).toBe("ไม่ทราบสถานะ");
    expect(isActiveRenderStatus("queued")).toBe(true);
    expect(isActiveRenderStatus("running")).toBe(true);
    expect(isActiveRenderStatus("done")).toBe(false);
  });

  it("filters ready images (thumbnail/image only) and video outputs", () => {
    const assets: Lite[] = [img("a", "thumbnail"), img("b", "image"), img("c", "image", null, "pending"), img("d", "broll"), img("e", "audio"), { id: "v", kind: "video", status: "ready", meta: null, mime: "video/mp4" }];
    expect(readyImages(assets).map((a) => a.id)).toEqual(["a", "b"]);
    expect(videoAssets(assets).map((a) => a.id)).toEqual(["v"]);
  });

  it("builds a storyboard with per-shot image resolution and warning flags", () => {
    const p = plan(["พูดหนึ่ง", null, "พูดสาม"]);
    const rows = buildStoryboard(p, [img("cover", "thumbnail"), img("s3", "image", { target: { kind: "scene", index: 2 } })]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ index: 0, imageAssetId: "cover", role: null, usesFallback: true, silent: false, dropped: false });
    expect(rows[1]).toMatchObject({ index: 1, imageAssetId: "cover", role: null, usesFallback: true, silent: true });
    expect(rows[2]).toMatchObject({ index: 2, imageAssetId: "s3", role: null, usesFallback: false, silent: false });
  });

  it("returns null images when nothing is ready, and no rows without a plan", () => {
    const rows = buildStoryboard(plan(["x"]), [img("p", "image", null, "pending")]);
    expect(rows[0].imageAssetId).toBeNull();
    expect(rows[0].usesFallback).toBe(false);
    expect(buildStoryboard(null, [])).toEqual([]);
    expect(buildStoryboard({ shots: [], broll: [], text_overlays: [] }, [])).toEqual([]);
  });

  it("flags shots beyond MAX_SHOTS as dropped and caps planned total to the kept shots", () => {
    const voices = Array.from({ length: MAX_SHOTS + 2 }, () => "พูด");
    const p = plan(voices);
    const rows = buildStoryboard(p, [img("cover", "thumbnail")]);
    expect(rows[MAX_SHOTS - 1].dropped).toBe(false);
    expect(rows[MAX_SHOTS].dropped).toBe(true);
    expect(plannedTotalSec(p)).toBe(MAX_SHOTS * 5);
    expect(plannedTotalSec(null)).toBe(0);
  });

  it("explains why rendering is blocked in gate order, else null", () => {
    const ok = { ttsAvailable: true, shotCount: 3, hasVoice: true, hasImage: true, hasPresenter: false, editable: true, jobActive: false };
    expect(renderBlockedReason(ok)).toBeNull();
    expect(renderBlockedReason({ ...ok, jobActive: true })).toContain("กำลัง render");
    expect(renderBlockedReason({ ...ok, editable: false })).toContain("ล็อก");
    expect(renderBlockedReason({ ...ok, ttsAvailable: false, ttsReason: "ไม่มี ELEVENLABS_API_KEY" })).toBe("ไม่มี ELEVENLABS_API_KEY");
    expect(renderBlockedReason({ ...ok, ttsAvailable: false })).toContain("TTS");
    expect(renderBlockedReason({ ...ok, shotCount: 0 })).toContain("creative plan");
    expect(renderBlockedReason({ ...ok, hasVoice: false })).toContain("voice");
    expect(renderBlockedReason({ ...ok, hasImage: false })).toContain("สื่อ");
  });
});

describe("storyteller format", () => {
  it("labels both formats and shot roles in Thai", () => {
    expect(VIDEO_FORMAT_META.template.label).toBe("ภาพประกอบ (ไวรัล)");
    expect(VIDEO_FORMAT_META.storyteller.label).toBe("นักสืบเล่าเรื่อง");
    expect(SHOT_ROLE_LABEL).toEqual({ presenter: "นักสืบ", broll: "ภาพประกอบ" });
  });

  it("reads a job's format from its params, defaulting to the template", () => {
    expect(jobVideoFormat({ format: "storyteller" })).toBe("storyteller");
    expect(jobVideoFormat({ format: "template" })).toBe("template");
    expect(jobVideoFormat({ aspect: "9:16" })).toBe("template");
    expect(jobVideoFormat({ format: "STORYTELLER" })).toBe("template");
    expect(jobVideoFormat(null)).toBe("template");
    expect(jobVideoFormat("storyteller")).toBe("template");
  });

  it("tells scene/cover stills apart from a ready presenter", () => {
    expect(imageReadiness([])).toEqual({ hasSceneImage: false, hasPresenter: false });
    expect(imageReadiness([presenter()])).toEqual({ hasSceneImage: false, hasPresenter: true });
    expect(imageReadiness([presenter("p", "pending"), img("cover", "thumbnail")])).toEqual({ hasSceneImage: true, hasPresenter: false });
  });

  it("exposes each shot's role: the presenter opens, closes and alternates with scene cut-aways", () => {
    const p = plan(["หนึ่ง", "สอง", "สาม", "สี่", "ห้า"]);
    const assets = [presenter("p"), img("cover", "thumbnail"), img("s2", "image", { target: { kind: "scene", index: 1 } })];
    const rows = buildStoryboard(p, assets, "storyteller");
    expect(rows.map((r) => r.role)).toEqual(["presenter", "broll", "presenter", "broll", "presenter"]);
    expect(rows[0]).toMatchObject({ imageAssetId: "p", usesFallback: false });
    expect(rows[1]).toMatchObject({ imageAssetId: "s2", usesFallback: false });
    expect(rows[3]).toMatchObject({ imageAssetId: "cover", usesFallback: true });
    expect(rows[4]).toMatchObject({ imageAssetId: "p", usesFallback: false });
  });

  it("storyteller without a presenter resolves no images; the template never shows the presenter", () => {
    const p = plan(["หนึ่ง", "สอง", "สาม"]);
    const noPresenter = buildStoryboard(p, [img("cover", "thumbnail")], "storyteller");
    expect(noPresenter.every((r) => r.imageAssetId == null && r.role == null)).toBe(true);
    const presenterOnly = buildStoryboard(p, [presenter()], "template");
    expect(presenterOnly.every((r) => r.imageAssetId == null)).toBe(true);
    const both = buildStoryboard(p, [presenter(), img("cover", "thumbnail")]);
    expect(both.map((r) => r.imageAssetId)).toEqual(["cover", "cover", "cover"]);
  });

  it("mirrors the server image gate for the chosen format", () => {
    const base = { ttsAvailable: true, shotCount: 3, hasVoice: true, editable: true, jobActive: false };
    expect(renderBlockedReason({ ...base, hasImage: true, hasPresenter: false }, "storyteller")).toBe(PRESENTER_MISSING_REASON);
    expect(renderBlockedReason({ ...base, hasImage: false, hasPresenter: true }, "storyteller")).toBeNull();
    expect(renderBlockedReason({ ...base, hasImage: false, hasPresenter: true }, "template")).toContain("ยังไม่มีรูปที่พร้อมใช้");
    // Earlier gates still win in storyteller mode.
    expect(renderBlockedReason({ ...base, ttsAvailable: false, hasImage: false, hasPresenter: false }, "storyteller")).toContain("TTS");
  });
});
