/**
 * Cryptographic + perceptual image hashes.
 *
 *  • md5 / sha1 / sha256 — exact-file identity (dedupe, evidence integrity).
 *  • aHash / dHash / pHash — perceptual: survive re-encoding / resizing so we can
 *    find near-duplicate imagery across the web. All returned as 64-bit hex (16
 *    chars). Hamming distance between two hex hashes = number of differing bits.
 *
 * Perceptual hashes are computed from a downscaled grayscale raster via sharp;
 * no external phash dependency. DCT for pHash is a direct O(n²) implementation —
 * fine for the fixed 32×32 input.
 */

import { createHash } from "node:crypto";
import sharp from "sharp";
import type { ImageHashes } from "./types";

/** Cryptographic digests of the exact bytes. */
export function cryptoHashes(buf: Buffer): Pick<ImageHashes, "md5" | "sha1" | "sha256"> {
  return {
    md5: createHash("md5").update(buf).digest("hex"),
    sha1: createHash("sha1").update(buf).digest("hex"),
    sha256: createHash("sha256").update(buf).digest("hex"),
  };
}

/** Pack a 64-length 0/1 array into 16-char hex (MSB first). */
function bitsToHex(bits: number[]): string {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    const nibble = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
    hex += nibble.toString(16);
  }
  return hex;
}

/** Grayscale raster at w×h as a flat Uint8 array (one byte per pixel). */
async function grayRaster(buf: Buffer, w: number, h: number): Promise<Uint8Array> {
  const raw = await sharp(buf)
    .greyscale()
    .resize(w, h, { fit: "fill" })
    .raw()
    .toBuffer();
  return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
}

/** Average hash: 8×8, bit = pixel brighter than the mean. */
export async function aHash(buf: Buffer): Promise<string> {
  const px = await grayRaster(buf, 8, 8);
  const mean = px.reduce((s, v) => s + v, 0) / px.length;
  return bitsToHex(Array.from(px, (v) => (v >= mean ? 1 : 0)));
}

/** Difference hash: 9×8, bit = pixel brighter than its right neighbour. */
export async function dHash(buf: Buffer): Promise<string> {
  const w = 9;
  const h = 8;
  const px = await grayRaster(buf, w, h);
  const bits: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      bits.push(px[i] > px[i + 1] ? 1 : 0);
    }
  }
  return bitsToHex(bits);
}

/** 1-D DCT-II coefficients for a single row/column (length n). */
function dct1d(vec: number[]): number[] {
  const n = vec.length;
  const out = new Array<number>(n).fill(0);
  for (let k = 0; k < n; k++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += vec[i] * Math.cos((Math.PI / n) * (i + 0.5) * k);
    }
    out[k] = sum;
  }
  return out;
}

/**
 * Perceptual hash: 32×32 grayscale → 2-D DCT → take the low-frequency top-left
 * 8×8 block (excluding the DC term) → bit = coefficient above the median.
 */
export async function pHash(buf: Buffer): Promise<string> {
  const size = 32;
  const px = await grayRaster(buf, size, size);

  // Rows, then columns.
  const rows: number[][] = [];
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) row.push(px[y * size + x]);
    rows.push(dct1d(row));
  }
  const dct: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  for (let x = 0; x < size; x++) {
    const col: number[] = [];
    for (let y = 0; y < size; y++) col.push(rows[y][x]);
    const c = dct1d(col);
    for (let y = 0; y < size; y++) dct[y][x] = c[y];
  }

  // Low-frequency 8×8 block, excluding DC (0,0).
  const coeffs: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (x === 0 && y === 0) continue;
      coeffs.push(dct[y][x]);
    }
  }
  const sorted = [...coeffs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const bits = coeffs.map((c) => (c > median ? 1 : 0));
  // 63 coeffs → pad to 64 for a clean 16-char hex.
  bits.push(0);
  return bitsToHex(bits);
}

/** Compute the full hash set for an image buffer. */
export async function computeHashes(buf: Buffer): Promise<ImageHashes> {
  const [ahash, dhash, phash] = await Promise.all([aHash(buf), dHash(buf), pHash(buf)]);
  return { ...cryptoHashes(buf), ahash, dhash, phash };
}

/** Hamming distance between two equal-length hex hashes (differing bit count). */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) throw new Error("hash length mismatch");
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}
