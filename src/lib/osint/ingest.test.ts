import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { decodeBase64, validateImage, IngestError } from "./ingest";

async function pngBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 32, height: 32, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .png()
    .toBuffer();
}

describe("decodeBase64", () => {
  it("decodes a bare base64 string", () => {
    const b64 = Buffer.from("hello").toString("base64");
    expect(decodeBase64(b64).toString()).toBe("hello");
  });
  it("strips a data: URL prefix", () => {
    const b64 = Buffer.from("hello").toString("base64");
    expect(decodeBase64(`data:image/png;base64,${b64}`).toString()).toBe("hello");
  });
  it("rejects non-base64 input", () => {
    expect(() => decodeBase64("!!!not base64!!!")).toThrow(IngestError);
  });
  it("rejects empty payload", () => {
    expect(() => decodeBase64("")).toThrow(IngestError);
  });
});

describe("validateImage", () => {
  it("accepts a real PNG and reports the sniffed MIME", async () => {
    const buf = await pngBuffer();
    const v = await validateImage(buf);
    expect(v.mime).toBe("image/png");
    expect(v.size).toBe(buf.length);
  });

  it("rejects a non-image buffer that lies about being an image", async () => {
    const buf = Buffer.from("this is definitely not an image");
    await expect(validateImage(buf)).rejects.toThrow(IngestError);
  });

  it("rejects an unsupported image type (gif)", async () => {
    const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .gif()
      .toBuffer();
    await expect(validateImage(gif)).rejects.toThrow(/Unsupported image type/);
  });

  it("rejects an empty buffer", async () => {
    await expect(validateImage(Buffer.alloc(0))).rejects.toThrow(IngestError);
  });
});
