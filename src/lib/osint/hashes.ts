/**
 * Cryptographic image hashes — exact-file identity (dedupe, evidence integrity).
 *
 * md5 / sha1 / sha256 of the exact bytes. sha256 is the primary "have we seen
 * this exact file" key.
 */

import { createHash } from "node:crypto";
import type { ImageHashes } from "./types";

/** Cryptographic digests of the exact bytes. */
export function cryptoHashes(buf: Buffer): ImageHashes {
  return {
    md5: createHash("md5").update(buf).digest("hex"),
    sha1: createHash("sha1").update(buf).digest("hex"),
    sha256: createHash("sha256").update(buf).digest("hex"),
  };
}

/** Compute the full hash set for an image buffer. */
export async function computeHashes(buf: Buffer): Promise<ImageHashes> {
  return cryptoHashes(buf);
}
