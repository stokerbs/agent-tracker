import { describe, expect, it } from "vitest";
import { DEFAULT_AUTOPILOT, normaliseAutopilot } from "./settings";

describe("normaliseAutopilot video_format", () => {
  // Production rows predate video_format; the settings form indexes its labels by this value and the autopilot
  // spends an extra image per storyteller run, so anything unexpected must read as the plain template.
  it("defaults a row without video_format to template", () => {
    const { video_format: _omit, ...legacy } = DEFAULT_AUTOPILOT;
    void _omit;
    expect(normaliseAutopilot(legacy).video_format).toBe("template");
    expect(normaliseAutopilot({}).video_format).toBe("template");
    expect(normaliseAutopilot(null).video_format).toBe("template");
    expect(DEFAULT_AUTOPILOT.video_format).toBe("template");
  });
  it("turns unknown values into template", () => {
    for (const bad of ["vlog", 1, true, "", "Storyteller", null]) {
      expect(normaliseAutopilot({ ...DEFAULT_AUTOPILOT, video_format: bad as never }).video_format).toBe("template");
    }
  });
  it("keeps every supported format", () => {
    for (const ok of ["template", "storyteller", "alternate"] as const) {
      expect(normaliseAutopilot({ ...DEFAULT_AUTOPILOT, video_format: ok }).video_format).toBe(ok);
    }
  });
});

describe("normaliseAutopilot images_per_run", () => {
  // One image per shot: the ceiling covers the whole run, so it has to allow more than the old 6.
  it("keeps every value in 1–10 and clamps outside it", () => {
    expect(DEFAULT_AUTOPILOT.images_per_run).toBe(7);
    for (const n of [1, 6, 7, 10]) expect(normaliseAutopilot({ ...DEFAULT_AUTOPILOT, images_per_run: n }).images_per_run).toBe(n);
    expect(normaliseAutopilot({ ...DEFAULT_AUTOPILOT, images_per_run: 11 }).images_per_run).toBe(10);
    expect(normaliseAutopilot({ ...DEFAULT_AUTOPILOT, images_per_run: 0 }).images_per_run).toBe(1);
    expect(normaliseAutopilot({ ...DEFAULT_AUTOPILOT, images_per_run: "x" as never }).images_per_run).toBe(DEFAULT_AUTOPILOT.images_per_run);
  });
});
