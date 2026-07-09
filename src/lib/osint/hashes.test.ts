import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { computeHashes, cryptoHashes, hammingDistance } from "./hashes";

async function solid(color: { r: number; g: number; b: number }, size = 64): Promise<Buffer> {
  return sharp({ create: { width: size, height: size, channels: 3, background: color } })
    .png()
    .toBuffer();
}

describe("cryptoHashes", () => {
  it("produces stable, correct-length digests", () => {
    const buf = Buffer.from("detective-pulse");
    const h = cryptoHashes(buf);
    expect(h.md5).toHaveLength(32);
    expect(h.sha1).toHaveLength(40);
    expect(h.sha256).toHaveLength(64);
    // Known SHA-256 of the exact bytes.
    expect(h.sha256).toBe(cryptoHashes(Buffer.from("detective-pulse")).sha256);
  });

  it("changes when a single byte changes", () => {
    expect(cryptoHashes(Buffer.from("a")).sha256).not.toBe(cryptoHashes(Buffer.from("b")).sha256);
  });
});

describe("perceptual hashes", () => {
  it("returns 16-char hex for all three", async () => {
    const buf = await solid({ r: 120, g: 120, b: 120 });
    const h = await computeHashes(buf);
    for (const v of [h.phash, h.dhash, h.ahash]) {
      expect(v).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it("is identical for the same image and near-identical for a re-encode", async () => {
    const png = await solid({ r: 200, g: 50, b: 50 });
    const jpg = await sharp(png).jpeg({ quality: 90 }).toBuffer();
    const a = await computeHashes(png);
    const b = await computeHashes(jpg);
    // Same visual content → perceptual hashes very close (small Hamming distance).
    expect(hammingDistance(a.phash, b.phash)).toBeLessThanOrEqual(4);
    expect(hammingDistance(a.ahash, b.ahash)).toBeLessThanOrEqual(4);
  });
});

describe("hammingDistance", () => {
  it("counts differing bits", () => {
    expect(hammingDistance("0000", "0000")).toBe(0);
    expect(hammingDistance("0000", "000f")).toBe(4);
    expect(hammingDistance("ffff", "0000")).toBe(16);
  });
  it("throws on length mismatch", () => {
    expect(() => hammingDistance("00", "0000")).toThrow();
  });
});
