import { describe, expect, it, vi } from "vitest";
import { attachMotionHook, motionHookEnabled } from "./hook-clip";
import type { TimedShot } from "./timeline";

const shots = (): TimedShot[] => [
  { index: 0, voice: "a", visual: "", imageAssetId: "c", voiceSec: 6, audioPath: null, imagePath: "/t/img.png", start: 0, duration: 6.35 },
  { index: 1, voice: "b", visual: "", imageAssetId: "c", voiceSec: 4, audioPath: null, imagePath: "/t/img.png", start: 6.35, duration: 4.35 },
];
const ready = { id: "a1", storage_path: "m1/a1.mp4" };
const deps = (over: Partial<Parameters<typeof attachMotionHook>[2]> = {}) => ({
  find: vi.fn(async () => ready),
  download: vi.fn(async () => new Uint8Array([1, 2])),
  write: vi.fn(async () => "/tmp/hook.mp4"),
  ...over,
});

describe("motionHookEnabled", () => {
  it("is on by default and only a literal false turns it off", () => {
    expect(motionHookEnabled(null)).toBe(true);
    expect(motionHookEnabled({})).toBe(true);
    expect(motionHookEnabled({ motion_hook: true })).toBe(true);
    expect(motionHookEnabled({ motion_hook: false })).toBe(false);
  });
});

describe("attachMotionHook", () => {
  it("puts the ready clip on the first shot", async () => {
    const s = shots();
    const d = deps();
    expect(await attachMotionHook(s, { format: "template" }, d)).toBe(true);
    expect(s[0].videoPath).toBe("/tmp/hook.mp4");
    expect(s[1].videoPath).toBeUndefined();
    expect(d.download).toHaveBeenCalledWith(ready);
  });
  it("does nothing when the job opted out", async () => {
    const s = shots();
    const d = deps();
    expect(await attachMotionHook(s, { motion_hook: false }, d)).toBe(false);
    expect(d.find).not.toHaveBeenCalled();
    expect(s[0].videoPath).toBeUndefined();
  });
  it("keeps the still when no clip is ready", async () => {
    const s = shots();
    expect(await attachMotionHook(s, {}, deps({ find: vi.fn(async () => null) }))).toBe(false);
    expect(s[0].videoPath).toBeUndefined();
  });
  it("keeps the still (and says why) when the lookup or the download fails", async () => {
    const skips: string[] = [];
    const s = shots();
    const lookupBroken = deps({ find: vi.fn(async () => { throw new Error("db down"); }), onSkip: (r) => skips.push(r) });
    expect(await attachMotionHook(s, {}, lookupBroken)).toBe(false);
    const downloadBroken = deps({ download: vi.fn(async () => { throw new Error("storage 404"); }), onSkip: (r) => skips.push(r) });
    expect(await attachMotionHook(s, {}, downloadBroken)).toBe(false);
    expect(s[0].videoPath).toBeUndefined();
    expect(skips.join(" ")).toContain("db down");
    expect(skips.join(" ")).toContain("storage 404");
  });
  it("does nothing for an empty shot list", async () => {
    const d = deps();
    expect(await attachMotionHook([], {}, d)).toBe(false);
    expect(d.find).not.toHaveBeenCalled();
  });
});
