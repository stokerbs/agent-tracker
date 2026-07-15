import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import sharp from "sharp";
import {
  normalizeFaces,
  getInferenceAdapter,
  noopInferenceAdapter,
  isReplicateHost,
  buildModelInput,
  retryAfterMs,
} from "./inference";

describe("retryAfterMs", () => {
  it("reads the header seconds, adds jitter", () => {
    expect(retryAfterMs("10", undefined)).toBe(10_250);
  });
  it("falls back to the JSON body value", () => {
    expect(retryAfterMs(null, 3)).toBe(3_250);
  });
  it("defaults to 5s when neither is present", () => {
    expect(retryAfterMs(null, undefined)).toBe(5_250);
  });
  it("clamps to [1,30] seconds", () => {
    expect(retryAfterMs("0", undefined)).toBe(1_250);
    expect(retryAfterMs("999", undefined)).toBe(30_250);
  });
});

// Real output captured from adirik/grounding-dino (query "face. person. hat")
// on a 512x512 image — the exact shape our normalizers must handle.
const GROUNDING_DINO_OUTPUT = {
  detections: [
    { bbox: [57, 43, 418, 511], confidence: 0.51, label: "person" },
    { bbox: [217, 202, 356, 388], confidence: 0.8, label: "face" },
    { bbox: [117, 43, 418, 253], confidence: 0.34, label: "hat" },
  ],
  result_image: "https://replicate.delivery/x.png",
};

describe("Grounding DINO real output", () => {
  it("normalizeFaces reads a face detection with pose/quality left null", () => {
    const faces = normalizeFaces({ detections: [GROUNDING_DINO_OUTPUT.detections[1]] }, 512, 512);
    expect(faces).toHaveLength(1);
    expect(faces[0].confidence).toBeCloseTo(0.8);
    expect(faces[0].bbox.x).toBeCloseTo(217 / 512);
    expect(faces[0].yaw).toBeNull();
    expect(faces[0].hasGlasses).toBeNull();
  });
});

describe("buildModelInput", () => {
  it("sends only the image when no query is configured", () => {
    expect(buildModelInput("data:image/jpeg;base64,x", undefined)).toEqual({
      image: "data:image/jpeg;base64,x",
    });
  });
  it("includes query + box_threshold when a query is given", () => {
    const input = buildModelInput("data:...", "face");
    expect(input.query).toBe("face");
    expect(input.box_threshold).toBe(0.3);
  });
});

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

  it("retries once on 429 (throttled) then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => null },
        clone: () => ({ json: async () => ({ retry_after: 1 }) }),
        text: async () => "throttled",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "p1", status: "succeeded", output: [{ bbox: [0, 0, 20, 20], score: 0.9 }] }),
      });
    const faces = await getInferenceAdapter().detectFaces(await png());
    expect(faces).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 6000);

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
