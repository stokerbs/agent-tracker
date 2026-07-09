import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { extractMetadata } from "./metadata";

describe("extractMetadata", () => {
  it("reads container dimensions and format from a PNG", async () => {
    const buf = await sharp({ create: { width: 120, height: 80, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .png()
      .toBuffer();
    const m = await extractMetadata(buf);
    expect(m.width).toBe(120);
    expect(m.height).toBe(80);
    expect(m.format).toBe("png");
    expect(m.mime).toBe("image/png");
    expect(m.filesize).toBe(buf.length);
  });

  it("degrades to nulls (never throws) on an undecodable buffer", async () => {
    const m = await extractMetadata(Buffer.from("garbage-not-an-image"));
    expect(m.width).toBeNull();
    expect(m.format).toBeNull();
    // filesize is still the byte length of what we were given.
    expect(m.filesize).toBe(20);
    expect(m.gpsLat).toBeNull();
  });

  it("leaves EXIF-derived fields null when there is no EXIF", async () => {
    const buf = await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .jpeg()
      .toBuffer();
    const m = await extractMetadata(buf);
    expect(m.cameraMake).toBeNull();
    expect(m.takenAt).toBeNull();
    expect(m.gpsLat).toBeNull();
  });
});
