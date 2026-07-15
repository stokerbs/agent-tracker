/**
 * AI photo geolocation via Picarta (https://picarta.ai/api).
 *
 * Predicts WHERE a photo was taken from its visual content — architecture,
 * signage, vegetation, skyline — even when the image carries no EXIF GPS. This is
 * a separate, inferred signal from the EXIF coordinates in metadata.ts.
 *
 * Gated on PICARTA_API_TOKEN: without it the stage is skipped. Runs on the
 * downscaled working copy (pipeline passes mlBuf) to keep the request small.
 *
 * PDPA: an AI location guess about an identifiable person is sensitive personal
 * data. Only enable this where a lawful basis exists; we store the prediction
 * (geometry + place names) but no biometric data.
 */

import sharp from "sharp";
import type { GeoPrediction, GeoPredictionItem } from "./types";

const PICARTA_API = "https://picarta.ai/classify";
const TIMEOUT_MS = 30_000;

/** True when a Picarta token is configured. */
export function geolocationAvailable(): boolean {
  return Boolean(process.env.PICARTA_API_TOKEN);
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * Normalize a Picarta /classify response into our GeoPrediction shape.
 * Handles the top-level ai_* fields plus the ranked topk_predictions_dict.
 * Exported for unit testing.
 */
export function normalizeGeo(raw: unknown): GeoPrediction {
  const d = (raw ?? {}) as Record<string, unknown>;

  const predictions: GeoPredictionItem[] = [];
  const topk = d.topk_predictions_dict;
  if (topk && typeof topk === "object") {
    // Keys are "1", "2", … — iterate in rank order.
    for (const key of Object.keys(topk as Record<string, unknown>).sort()) {
      const p = (topk as Record<string, unknown>)[key] as Record<string, unknown>;
      if (!p) continue;
      const gps = Array.isArray(p.gps) ? p.gps.map(Number) : [];
      const addr = (p.address ?? {}) as Record<string, unknown>;
      const lat = gps.length >= 2 ? gps[0] : num(p.ai_lat);
      const lon = gps.length >= 2 ? gps[1] : num(p.ai_lon);
      if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      predictions.push({
        lat,
        lon,
        confidence: num(p.confidence),
        country: str(addr.country ?? p.ai_country),
        city: str(addr.city ?? p.city),
        province: str(addr.province ?? p.province),
      });
    }
  }

  return {
    provider: "picarta",
    lat: num(d.ai_lat),
    lon: num(d.ai_lon),
    confidence: num(d.ai_confidence),
    country: str(d.ai_country),
    city: str(d.city),
    province: str(d.province),
    predictions,
  };
}

/**
 * Geolocate an image with Picarta. Returns null when no token is configured.
 * Throws on API/transport failure so the pipeline marks the stage failed
 * (isolated) without losing the rest of the analysis.
 */
export async function geolocateImage(buffer: Buffer): Promise<GeoPrediction | null> {
  const token = process.env.PICARTA_API_TOKEN;
  if (!token) return null;

  // Re-encode to a compact JPEG and send as base64 (Picarta accepts base64 data).
  const jpeg = await sharp(buffer).jpeg({ quality: 88 }).toBuffer();
  const b64 = jpeg.toString("base64");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(PICARTA_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ TOKEN: token, IMAGE: b64, TOP_K: 3 }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`Picarta ${res.status}: ${await res.text()}`);
  return normalizeGeo(await res.json());
}
