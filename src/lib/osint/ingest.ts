/**
 * Input ingestion for the OSINT analyzer.
 *
 * Turns any accepted input (uploaded bytes, base64, direct URL) into a
 * validated image Buffer. Validation NEVER trusts the client:
 *   • size cap enforced before and after decode
 *   • MIME determined by magic bytes (file-type), not extension/Content-Type
 *   • the buffer must actually decode via sharp, else it's rejected as malformed
 *
 * Redirect-URL inputs are resolved to a final image URL by redirect.ts first,
 * then downloaded here via downloadImage().
 */

import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { MAX_IMAGE_BYTES, ACCEPTED_MIME, type AcceptedMime } from "./types";
import { safeFetch, type GuardedResponse } from "./fetch-guard";

export class IngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestError";
  }
}

export interface ValidatedImage {
  buffer: Buffer;
  mime: AcceptedMime;
  size: number;
}

/** Strip an optional `data:<mime>;base64,` prefix and decode to a Buffer. */
export function decodeBase64(input: string): Buffer {
  const comma = input.indexOf(",");
  const payload = input.startsWith("data:") && comma !== -1 ? input.slice(comma + 1) : input;
  const cleaned = payload.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) {
    throw new IngestError("Invalid base64 payload");
  }
  const buf = Buffer.from(cleaned, "base64");
  if (buf.length === 0) throw new IngestError("Empty image payload");
  return buf;
}

/**
 * Validate that a buffer is an accepted, decodable image within size limits.
 * Returns the magic-byte-derived MIME. Throws IngestError otherwise.
 */
export async function validateImage(buf: Buffer): Promise<ValidatedImage> {
  if (buf.length === 0) throw new IngestError("Empty image");
  if (buf.length > MAX_IMAGE_BYTES) {
    throw new IngestError(`Image exceeds ${MAX_IMAGE_BYTES} bytes`);
  }

  const sniffed = await fileTypeFromBuffer(buf);
  if (!sniffed) throw new IngestError("Could not determine file type");
  if (!(ACCEPTED_MIME as readonly string[]).includes(sniffed.mime)) {
    throw new IngestError(`Unsupported image type: ${sniffed.mime}`);
  }

  // Must actually decode — defeats polyglot/malformed files that pass a sniff.
  // HEIC may not decode if the libvips build lacks libheif; treat that as a
  // soft failure so the caller can surface a clear "HEIC unsupported" message.
  try {
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) throw new Error("no dimensions");
  } catch (err) {
    throw new IngestError(`Malformed or undecodable image: ${(err as Error).message}`);
  }

  return { buffer: buf, mime: sniffed.mime as AcceptedMime, size: buf.length };
}

/**
 * Download an image from a URL through the SSRF guard and validate it.
 * Returns the validated image plus the guarded response (for hop forensics).
 */
export async function downloadImage(
  url: string,
): Promise<{ image: ValidatedImage; response: GuardedResponse }> {
  const response = await safeFetch(url, { maxBytes: MAX_IMAGE_BYTES });
  if (response.status >= 400) {
    throw new IngestError(`Image URL returned HTTP ${response.status}`);
  }
  const image = await validateImage(response.body);
  return { image, response };
}
