import { describe, it, expect } from "vitest";
import { assessIntegrity } from "./integrity";
import type { ImageMetadata } from "./types";

function meta(over: Partial<ImageMetadata>): ImageMetadata {
  return {
    width: 4000,
    height: 3000,
    mime: "image/jpeg",
    format: "jpeg",
    filesize: 1_000_000,
    dpi: 72,
    cameraMake: null,
    cameraModel: null,
    lens: null,
    software: null,
    orientation: null,
    gpsLat: null,
    gpsLng: null,
    gpsAltitude: null,
    takenAt: null,
    rawExif: null,
    ...over,
  };
}

describe("assessIntegrity", () => {
  it("flags a JPEG with no EXIF as metadata-stripped", () => {
    const r = assessIntegrity(meta({ format: "jpeg", rawExif: null }));
    expect(r.metadataStripped).toBe(true);
    expect(r.signals.some((s) => s.key === "metadata_stripped")).toBe(true);
  });

  it("does not flag metadata-stripped when EXIF is present", () => {
    const r = assessIntegrity(meta({ format: "jpeg", rawExif: { Image: {} } }));
    expect(r.metadataStripped).toBe(false);
  });

  it("detects editing software", () => {
    const r = assessIntegrity(meta({ software: "Adobe Photoshop 25.0", rawExif: { Image: {} } }));
    expect(r.likelyEditedSoftware).toMatch(/Photoshop/);
  });

  it("detects a screenshot by device dimensions with no camera", () => {
    const r = assessIntegrity(meta({ width: 1170, height: 2532, format: "png", cameraMake: null }));
    expect(r.likelyScreenshot).toBe(true);
  });

  it("detects a screenshot by software tag", () => {
    const r = assessIntegrity(meta({ software: "CleanShot X", rawExif: { Image: {} } }));
    expect(r.likelyScreenshot).toBe(true);
  });

  it("does not claim a camera-original JPEG is resized", () => {
    const r = assessIntegrity(
      meta({ cameraMake: "Canon", cameraModel: "EOS R5", rawExif: { Image: {} }, width: 8192, height: 5464 }),
    );
    expect(r.likelyResized).toBe(false);
    expect(r.likelyScreenshot).toBe(false);
  });

  it("confidence rises with corroborating signals", () => {
    const none = assessIntegrity(meta({ cameraMake: "Canon", rawExif: { Image: {} }, width: 8000, height: 6000 }));
    const many = assessIntegrity(meta({ format: "jpeg", rawExif: null, software: "Adobe Photoshop" }));
    expect(many.confidence).toBeGreaterThan(none.confidence);
    expect(many.confidence).toBeLessThanOrEqual(1);
  });
});
