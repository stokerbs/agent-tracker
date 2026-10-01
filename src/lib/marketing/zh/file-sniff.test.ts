import { describe, it, expect } from "vitest";
import { sniffMime } from "./file-sniff";

const b = (...n: number[]) => new Uint8Array(n);
const str = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("sniffMime", () => {
  it("recognises JPEG, PNG, WebP and PDF headers", () => {
    expect(sniffMime(b(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMime(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffMime(str("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffMime(str("%PDF-1.7\n"))).toBe("application/pdf");
  });

  it("rejects anything else (executables, HTML, truncated headers)", () => {
    expect(sniffMime(str("MZ\x90\x00"))).toBeNull();
    expect(sniffMime(str("<html>"))).toBeNull();
    expect(sniffMime(b(0xff, 0xd8))).toBeNull();
    expect(sniffMime(str("RIFF\0\0\0\0AVI "))).toBeNull();
    expect(sniffMime(new Uint8Array(0))).toBeNull();
  });
});
