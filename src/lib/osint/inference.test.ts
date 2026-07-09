import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import sharp from "sharp";
import {
  normalizeFaces,
  normalizeObjects,
  getInferenceAdapter,
  noopInferenceAdapter,
  isReplicateHost,
} from "./inference";

describe("isReplicateHost (token-leak guard)", () => {
  it.each([
    ["https://api.replicate.com/v1/predictions/p1", true],
    ["https://api.replicate.com/anything", true],
    ["https://evil.com/steal", false],
    ["https://api.replicate.com.evil.com/x", false],
    ["http://api.replicate.com/x", true],
    [undefined, false],
    ["not a url", false],
  ])("%s → %s", (url, expected) => {
    expect(isReplicateHost(url as string | undefined)).toBe(expected);
  });
});

describe("normalizeFaces", () => {
  it("normalizes pixel bbox to 0..1 and reads pose/quality", () => {
    const out = [
      { bbox: [100, 50, 300, 250], score: 0.98, pose: { yaw: 5, pitch: -2, roll: 1 }, glasses: true, mask: false, blur: 12 },
    ];
    const [f] = normalizeFaces(out, 1000, 500);
    expect(f.bbox).toEqual({ x: 0.1, y: 0.1, w: 0.2, h: 0.4 });
    expect(f.confidence).toBeCloseTo(0.98);
    expect(f.yaw).toBe(5);
    expect(f.hasGlasses).toBe(true);
    expect(f.hasMask).toBe(false);
    expect(f.blurScore).toBe(12);
    expect(f.faceIndex).toBe(0);
  });

  it("treats already-normalized bbox as-is", () => {
    const [f] = normalizeFaces([{ bbox: [0.2, 0.2, 0.6, 0.8], score: 0.9 }], 1000, 500);
    expect(f.bbox.x).toBeCloseTo(0.2);
    expect(f.bbox.y).toBeCloseTo(0.2);
    expect(f.bbox.w).toBeCloseTo(0.4);
    expect(f.bbox.h).toBeCloseTo(0.6);
  });

  it("NEVER exposes an embedding field (PDPA)", () => {
    const out = [{ bbox: [0, 0, 10, 10], embedding: [0.1, 0.2, 0.3], score: 0.9 }];
    const [f] = normalizeFaces(out, 100, 100);
    expect(Object.keys(f)).not.toContain("embedding");
    expect(JSON.stringify(f)).not.toContain("0.1,0.2,0.3");
  });

  it("reads a { faces: [...] } wrapper shape", () => {
    const out = { faces: [{ facial_area: { x: 0, y: 0, w: 50, h: 50 }, det_score: 0.7 }] };
    const faces = normalizeFaces(out, 100, 100);
    expect(faces).toHaveLength(1);
    expect(faces[0].confidence).toBeCloseTo(0.7);
  });
});

describe("normalizeObjects", () => {
  it("maps labels to coarse categories and normalizes bbox", () => {
    const out = [
      { label: "car", box: [0, 0, 100, 100], confidence: 0.8 },
      { class: "person", bbox: [10, 10, 20, 20], score: 0.6 },
      { name: "cell phone", confidence: 0.5 },
    ];
    const objs = normalizeObjects(out, 200, 200);
    expect(objs.map((o) => o.category)).toEqual(["vehicle", "person", "device"]);
    expect(objs[0].bbox).toEqual({ x: 0, y: 0, w: 0.5, h: 0.5 });
    expect(objs[2].bbox).toBeNull();
  });

  it("drops detections with no label and buckets unknown labels as 'other'", () => {
    const objs = normalizeObjects([{ confidence: 0.9 }, { label: "umbrella", confidence: 0.4 }], 100, 100);
    expect(objs).toHaveLength(1);
    expect(objs[0].category).toBe("other");
  });
});

describe("getInferenceAdapter", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns the no-op adapter with no token", () => {
    vi.stubEnv("REPLICATE_API_TOKEN", "");
    expect(getInferenceAdapter()).toBe(noopInferenceAdapter);
    expect(noopInferenceAdapter.available).toBe(false);
  });

  it("returns an available adapter when a token is set", () => {
    vi.stubEnv("REPLICATE_API_TOKEN", "r8_test");
    expect(getInferenceAdapter().available).toBe(true);
  });
});

describe("ReplicateInferenceAdapter.detectFaces (mocked API)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("REPLICATE_API_TOKEN", "r8_test");
    vi.stubEnv("OSINT_REPLICATE_FACE_MODEL", "acme/retinaface");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function png(): Promise<Buffer> {
    return sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .png()
      .toBuffer();
  }

  it("posts to the model endpoint and normalizes a succeeded prediction", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "p1", status: "succeeded", output: [{ bbox: [0, 0, 20, 20], score: 0.9 }] }),
    });
    const faces = await getInferenceAdapter().detectFaces(await png());
    expect(faces).toHaveLength(1);
    expect(faces[0].confidence).toBeCloseTo(0.9);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/models/acme/retinaface/predictions");
    expect((opts as { headers: Record<string, string> }).headers.authorization).toBe("Bearer r8_test");
  });

  it("returns [] when no face model is configured", async () => {
    vi.stubEnv("OSINT_REPLICATE_FACE_MODEL", "");
    const faces = await getInferenceAdapter().detectFaces(await png());
    expect(faces).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on a failed prediction", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "p1", status: "failed", error: "OOM" }),
    });
    await expect(getInferenceAdapter().detectFaces(await png())).rejects.toThrow(/failed/i);
  });
});
