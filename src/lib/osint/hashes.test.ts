import { describe, it, expect } from "vitest";
import { computeHashes, cryptoHashes } from "./hashes";

describe("cryptoHashes", () => {
  it("produces stable, correct-length digests", () => {
    const buf = Buffer.from("detective-pulse");
    const h = cryptoHashes(buf);
    expect(h.md5).toHaveLength(32);
    expect(h.sha1).toHaveLength(40);
    expect(h.sha256).toHaveLength(64);
    expect(h.sha256).toBe(cryptoHashes(Buffer.from("detective-pulse")).sha256);
  });

  it("changes when a single byte changes", () => {
    expect(cryptoHashes(Buffer.from("a")).sha256).not.toBe(cryptoHashes(Buffer.from("b")).sha256);
  });

  it("computeHashes returns the crypto set", async () => {
    const h = await computeHashes(Buffer.from("x"));
    expect(Object.keys(h).sort()).toEqual(["md5", "sha1", "sha256"]);
  });
});
