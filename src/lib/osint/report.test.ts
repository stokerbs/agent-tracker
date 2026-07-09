import { describe, it, expect } from "vitest";
import { buildFactSheet, googleMapsUrl, normalizeReport, type ReportInput } from "./report";
import type { ImageHashes, ImageMetadata } from "./types";

const hashes: ImageHashes = {
  md5: "m".repeat(32),
  sha1: "s".repeat(40),
  sha256: "a".repeat(64),
  phash: "0123456789abcdef",
  dhash: "fedcba9876543210",
  ahash: "0f0f0f0f0f0f0f0f",
};

function baseMeta(over: Partial<ImageMetadata> = {}): ImageMetadata {
  return {
    width: 1920,
    height: 1080,
    mime: "image/jpeg",
    format: "jpeg",
    filesize: 500_000,
    dpi: 72,
    cameraMake: "Apple",
    cameraModel: "iPhone 15",
    lens: null,
    software: null,
    orientation: 1,
    gpsLat: null,
    gpsLng: null,
    gpsAltitude: null,
    takenAt: "2026-01-01T10:00:00.000Z",
    rawExif: { Image: {} },
    ...over,
  };
}

function input(over: Partial<ReportInput> = {}): ReportInput {
  return {
    metadata: baseMeta(),
    hashes,
    attribution: { host: "cdn.example.com", cloud: [{ provider: "Amazon S3", evidence: "x" }], cdn: [] },
    redirects: [],
    integrity: {
      metadataStripped: false,
      likelyResized: false,
      likelyScreenshot: false,
      likelyEditedSoftware: null,
      confidence: 0.4,
      signals: [],
    },
    finalImageUrl: "https://cdn.example.com/a.jpg",
    ...over,
  };
}

describe("googleMapsUrl", () => {
  it("builds a deterministic maps link", () => {
    expect(googleMapsUrl(13.7563, 100.5018)).toBe(
      "https://www.google.com/maps/search/?api=1&query=13.7563,100.5018",
    );
  });
});

describe("buildFactSheet", () => {
  it("includes the sha256 and attribution", () => {
    const sheet = buildFactSheet(input());
    expect(sheet).toContain("a".repeat(64));
    expect(sheet).toContain("Amazon S3");
    expect(sheet).toContain("cdn.example.com");
  });

  it("embeds a pre-built maps URL when GPS is present, and 'none' otherwise", () => {
    const withGps = buildFactSheet(input({ metadata: baseMeta({ gpsLat: 13.75, gpsLng: 100.5 }) }));
    expect(withGps).toContain("gps_maps_url: https://www.google.com/maps/search/?api=1&query=13.75,100.5");
    const noGps = buildFactSheet(input());
    expect(noGps).toContain("gps: none");
  });
});

describe("normalizeReport", () => {
  it("clamps scores to 0..100 and reads snake_case keys", () => {
    const r = normalizeReport({
      summary: "s",
      // model returns snake_case via the tool
      likely_origin: "hosted on S3",
      leads: ["one", "two"],
      recommendations: ["do x"],
      risk_score: 250,
      confidence: -5,
    } as never);
    expect(r.likelyOrigin).toBe("hosted on S3");
    expect(r.riskScore).toBe(100);
    expect(r.confidence).toBe(0);
    expect(r.leads).toEqual(["one", "two"]);
  });

  it("coerces bad arrays to empty", () => {
    const r = normalizeReport({ summary: "s", leads: "nope" } as never);
    expect(r.leads).toEqual([]);
    expect(r.recommendations).toEqual([]);
  });
});
