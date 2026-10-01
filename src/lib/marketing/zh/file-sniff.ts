/**
 * Magic-byte sniffing for intake attachments. The browser-supplied MIME type
 * is an assertion, not a fact; the API only accepts a file whose first bytes
 * match the declared type, so an executable renamed `.pdf` is rejected before
 * it reaches storage or an admin's browser.
 */
export type SniffedMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export function sniffMime(bytes: Uint8Array): SniffedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

function ascii(bytes: Uint8Array, from: number, to: number): string {
  let s = "";
  for (let i = from; i < to; i++) s += String.fromCharCode(bytes[i]!);
  return s;
}
