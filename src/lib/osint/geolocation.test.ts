import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import sharp from "sharp";
import { normalizeGeo, geolocateImage, geolocationAvailable } from "./geolocation";

// Real Picarta /classify response shape (from their API docs).
const PICARTA_RESPONSE = {
  topk_predictions_dict: {
    "1": {
      address: { city: "San Gimignano", country: "Italy", province: "Tuscany" },
      confidence: 0.9429,
      gps: [43.4672, 11.0435],
    },
    "2": {
      address: { city: "Siena", country: "Italy", province: "Tuscany" },
      confidence: 0.21,
      gps: [43.3188, 11.3308],
    },
  },
  ai_confidence: 0.9429,
  ai_country: "Italy",
  ai_lat: 43.4672,
  ai_lon: 11.0435,
  city: "San Gimignano",
  province: "Tuscany",
};

describe("normalizeGeo", () => {
  it("reads top-level fields and ranked predictions", () => {
    const g = normalizeGeo(PICARTA_RESPONSE);
    expect(g.provider).toBe("picarta");
    expect(g.lat).toBeCloseTo(43.4672);
    expect(g.lon).toBeCloseTo(11.0435);
    expect(g.confidence).toBeCloseTo(0.9429);
    expect(g.country).toBe("Italy");
    expect(g.city).toBe("San Gimignano");
    expect(g.predictions).toHaveLength(2);
    expect(g.predictions[0]).toMatchObject({ lat: 43.4672, lon: 11.0435, city: "San Gimignano" });
    expect(g.predictions[1].city).toBe("Siena");
  });

  it("skips predictions without valid gps and degrades to nulls", () => {
    const g = normalizeGeo({ topk_predictions_dict: { "1": { address: {}, confidence: 0.1 } } });
    expect(g.predictions).toHaveLength(0);
    expect(g.lat).toBeNull();
  });

  it("handles an empty/garbage response", () => {
    expect(normalizeGeo({}).predictions).toEqual([]);
    expect(normalizeGeo(null).lat).toBeNull();
  });
});

describe("geolocateImage (mocked API)", () => {
  const fetchMock = vi.fn();
  async function png(): Promise<Buffer> {
    return sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .png()
      .toBuffer();
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns null when no token is configured", async () => {
    vi.stubEnv("PICARTA_API_TOKEN", "");
    expect(geolocationAvailable()).toBe(false);
    expect(await geolocateImage(await png())).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts base64 + token and normalizes the response", async () => {
    vi.stubEnv("PICARTA_API_TOKEN", "pk_test");
    fetchMock.mockResolvedValue({ ok: true, json: async () => PICARTA_RESPONSE });
    const g = await geolocateImage(await png());
    expect(g?.city).toBe("San Gimignano");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://picarta.ai/classify");
    const body = JSON.parse((opts as { body: string }).body);
    expect(body.TOKEN).toBe("pk_test");
    expect(typeof body.IMAGE).toBe("string");
    expect(body.TOP_K).toBe(3);
  });

  it("throws on API failure", async () => {
    vi.stubEnv("PICARTA_API_TOKEN", "pk_test");
    fetchMock.mockResolvedValue({ ok: false, status: 402, text: async () => "no credit" });
    await expect(geolocateImage(await png())).rejects.toThrow(/Picarta 402/);
  });
});
