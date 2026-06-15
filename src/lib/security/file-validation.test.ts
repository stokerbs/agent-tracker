import { describe, expect, it } from "vitest";
import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_IMAGE_TYPES,
  FileValidationError,
  MAX_IMAGE_SIZE,
  MAX_PDF_SIZE,
  validateDocumentUpload,
  validateImageMagicNumber,
  validateImageUpload,
  validatePdfMagicNumber,
} from "./file-validation";

// ─── magic byte constants ─────────────────────────────────────────────────────

// Minimal valid file headers for each accepted format.
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]; // SOI + APP0 marker
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]; // PNG sig
const WEBP_MAGIC = [
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x00, 0x00, 0x00, 0x00, // file size (ignored by checker)
  0x57, 0x45, 0x42, 0x50, // "WEBP"
];
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]; // %PDF-1.4

// Malicious / foreign byte sequences used in spoofing tests.
const EXE_BYTES = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]; // MZ (PE)
const HTML_BYTES = [0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e]; // <html>
const RANDOM_BYTES = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07];
// RIFF header present but "WEBP" replaced with "AVI " — not a WebP file.
const RIFF_AVI_BYTES = [
  0x52, 0x49, 0x46, 0x46,
  0x00, 0x00, 0x00, 0x00,
  0x41, 0x56, 0x49, 0x20, // "AVI "
];

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a File whose content is a raw byte array.
 * Use this whenever the magic-number check will be reached (acceptance paths
 * and MIME-spoof tests).
 */
function makeBinaryFile(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes).buffer as ArrayBuffer], name, { type });
}

/**
 * Creates a File with string content. Because the magic-number check is never
 * reached for files rejected at the empty / MIME stage, plain-string content
 * is fine for those tests. Do NOT use for acceptance tests.
 */
function makeFile(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}

/**
 * Creates a binary File with the given magic bytes but an overridden `size`
 * property. Used for size-boundary tests: the actual byte count stays small
 * while `file.size` reports the target limit, so the size check fires at the
 * correct threshold without allocating a large buffer.
 *
 * `file.slice(0, 32).arrayBuffer()` reads the real magic bytes regardless of
 * the overridden size, so the magic-number check still passes.
 */
function makeFakeSizedFile(
  magicBytes: number[],
  size: number,
  name: string,
  type: string,
): File {
  const file = makeBinaryFile(magicBytes, name, type);
  Object.defineProperty(file, "size", { value: size, configurable: true });
  return file;
}

// ─── validateImageMagicNumber (unit) ─────────────────────────────────────────

describe("validateImageMagicNumber", () => {
  it("accepts valid JPEG magic bytes (FF D8 FF)", async () => {
    const file = makeBinaryFile(JPEG_MAGIC, "photo.jpg", "image/jpeg");
    await expect(validateImageMagicNumber(file)).resolves.toBeUndefined();
  });

  it("accepts valid PNG magic bytes (89 50 4E 47)", async () => {
    const file = makeBinaryFile(PNG_MAGIC, "photo.png", "image/png");
    await expect(validateImageMagicNumber(file)).resolves.toBeUndefined();
  });

  it("accepts valid WebP magic bytes (RIFF....WEBP)", async () => {
    const file = makeBinaryFile(WEBP_MAGIC, "photo.webp", "image/webp");
    await expect(validateImageMagicNumber(file)).resolves.toBeUndefined();
  });

  it("rejects EXE content (MZ header) as not an image", async () => {
    const file = makeBinaryFile(EXE_BYTES, "evil.jpg", "image/jpeg");
    await expect(validateImageMagicNumber(file)).rejects.toThrow(
      "File content does not match file type.",
    );
  });

  it("rejects random bytes as not an image", async () => {
    const file = makeBinaryFile(RANDOM_BYTES, "noise.png", "image/png");
    await expect(validateImageMagicNumber(file)).rejects.toThrow(
      "File content does not match file type.",
    );
  });

  it("rejects RIFF container that is not WebP (AVI container)", async () => {
    // RIFF header is present but bytes 8–11 are 'AVI ' not 'WEBP'.
    const file = makeBinaryFile(RIFF_AVI_BYTES, "video.webp", "image/webp");
    await expect(validateImageMagicNumber(file)).rejects.toThrow(
      "File content does not match file type.",
    );
  });

  it("throws FileValidationError (not a generic Error)", async () => {
    const file = makeBinaryFile(EXE_BYTES, "bad.jpg", "image/jpeg");
    await expect(validateImageMagicNumber(file)).rejects.toBeInstanceOf(
      FileValidationError,
    );
  });
});

// ─── validatePdfMagicNumber (unit) ───────────────────────────────────────────

describe("validatePdfMagicNumber", () => {
  it("accepts valid PDF magic bytes (%PDF)", async () => {
    const file = makeBinaryFile(PDF_MAGIC, "doc.pdf", "application/pdf");
    await expect(validatePdfMagicNumber(file)).resolves.toBeUndefined();
  });

  it("rejects HTML content disguised as PDF", async () => {
    const file = makeBinaryFile(HTML_BYTES, "trap.pdf", "application/pdf");
    await expect(validatePdfMagicNumber(file)).rejects.toThrow(
      "File content does not match file type.",
    );
  });

  it("rejects EXE content disguised as PDF", async () => {
    const file = makeBinaryFile(EXE_BYTES, "malware.pdf", "application/pdf");
    await expect(validatePdfMagicNumber(file)).rejects.toThrow(
      "File content does not match file type.",
    );
  });

  it("throws FileValidationError (not a generic Error)", async () => {
    const file = makeBinaryFile(EXE_BYTES, "bad.pdf", "application/pdf");
    await expect(validatePdfMagicNumber(file)).rejects.toBeInstanceOf(
      FileValidationError,
    );
  });
});

// ─── validateImageUpload ──────────────────────────────────────────────────────

describe("validateImageUpload", () => {
  // ── acceptance paths ──

  it("accepts a valid JPEG file", async () => {
    const file = makeBinaryFile(JPEG_MAGIC, "photo.jpg", "image/jpeg");
    await expect(validateImageUpload(file)).resolves.toBeUndefined();
  });

  it("accepts a valid PNG file", async () => {
    const file = makeBinaryFile(PNG_MAGIC, "photo.png", "image/png");
    await expect(validateImageUpload(file)).resolves.toBeUndefined();
  });

  it("accepts a valid WebP file", async () => {
    const file = makeBinaryFile(WEBP_MAGIC, "photo.webp", "image/webp");
    await expect(validateImageUpload(file)).resolves.toBeUndefined();
  });

  // ── empty file ──

  it("rejects an empty file (size === 0)", async () => {
    const file = makeFile("", "empty.jpg", "image/jpeg");
    await expect(validateImageUpload(file)).rejects.toThrow("Empty file.");
  });

  // ── size limits ──

  it("accepts a file exactly at MAX_IMAGE_SIZE (boundary)", async () => {
    const file = makeFakeSizedFile(JPEG_MAGIC, MAX_IMAGE_SIZE, "max.jpg", "image/jpeg");
    await expect(validateImageUpload(file)).resolves.toBeUndefined();
  });

  it("rejects a file one byte over MAX_IMAGE_SIZE", async () => {
    const file = makeFakeSizedFile(JPEG_MAGIC, MAX_IMAGE_SIZE + 1, "big.jpg", "image/jpeg");
    await expect(validateImageUpload(file)).rejects.toThrow(
      "File exceeds maximum size.",
    );
  });

  // ── MIME type rejections (fail before magic-number check) ──

  it("rejects an executable (application/x-executable)", async () => {
    const file = makeFile("MZ\x90\x00", "evil.exe", "application/x-executable");
    await expect(validateImageUpload(file)).rejects.toThrow(
      "Unsupported file type.",
    );
  });

  it("rejects a JavaScript file (text/javascript)", async () => {
    const file = makeFile("alert(1)", "evil.js", "text/javascript");
    await expect(validateImageUpload(file)).rejects.toThrow(
      "Unsupported file type.",
    );
  });

  it("rejects an HTML file (text/html)", async () => {
    const file = makeFile("<script>alert(1)</script>", "page.html", "text/html");
    await expect(validateImageUpload(file)).rejects.toThrow(
      "Unsupported file type.",
    );
  });

  it("rejects an SVG (image/svg+xml — carries script risk)", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const file = makeFile(svg, "trap.svg", "image/svg+xml");
    await expect(validateImageUpload(file)).rejects.toThrow(
      "Unsupported file type.",
    );
  });

  it("rejects a PDF submitted to the image validator", async () => {
    const file = makeBinaryFile(PDF_MAGIC, "doc.pdf", "application/pdf");
    await expect(validateImageUpload(file)).rejects.toThrow(
      "Unsupported file type.",
    );
  });

  it("rejects application/octet-stream (MIME not in allowlist)", async () => {
    const file = makeFile("MZ\x90\x00PE\x00\x00", "photo.jpg", "application/octet-stream");
    await expect(validateImageUpload(file)).rejects.toThrow(
      "Unsupported file type.",
    );
  });

  // ── MIME spoof attacks caught at magic-number stage ──

  it("MIME spoof: EXE content claiming to be image/jpeg is caught at magic-number stage", async () => {
    // MIME type passes the allowlist check; bytes reveal it is a PE executable.
    const spoofed = makeBinaryFile(EXE_BYTES, "photo.jpg", "image/jpeg");
    await expect(validateImageUpload(spoofed)).rejects.toThrow(
      "File content does not match file type.",
    );
  });

  it("MIME spoof: HTML payload claiming to be image/png is caught at magic-number stage", async () => {
    const spoofed = makeBinaryFile(HTML_BYTES, "photo.png", "image/png");
    await expect(validateImageUpload(spoofed)).rejects.toThrow(
      "File content does not match file type.",
    );
  });

  it("MIME spoof: random bytes claiming to be image/webp are caught at magic-number stage", async () => {
    const spoofed = makeBinaryFile(RANDOM_BYTES, "photo.webp", "image/webp");
    await expect(validateImageUpload(spoofed)).rejects.toThrow(
      "File content does not match file type.",
    );
  });

  // ── error type assertions ──

  it("throws FileValidationError for MIME type violations", async () => {
    const file = makeFile("data", "bad.exe", "application/x-executable");
    await expect(validateImageUpload(file)).rejects.toBeInstanceOf(
      FileValidationError,
    );
  });

  it("throws FileValidationError for size violations", async () => {
    const file = makeFakeSizedFile(JPEG_MAGIC, MAX_IMAGE_SIZE + 1, "big.jpg", "image/jpeg");
    await expect(validateImageUpload(file)).rejects.toBeInstanceOf(
      FileValidationError,
    );
  });

  it("throws FileValidationError for magic-number violations", async () => {
    const spoofed = makeBinaryFile(EXE_BYTES, "photo.jpg", "image/jpeg");
    const err = await validateImageUpload(spoofed).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FileValidationError);
    expect(err).toBeInstanceOf(Error);
    expect((err as FileValidationError).name).toBe("FileValidationError");
  });
});

// ─── validateDocumentUpload ───────────────────────────────────────────────────

describe("validateDocumentUpload", () => {
  // ── acceptance paths ──

  it("accepts a valid PDF file", async () => {
    const file = makeBinaryFile(PDF_MAGIC, "report.pdf", "application/pdf");
    await expect(validateDocumentUpload(file)).resolves.toBeUndefined();
  });

  // ── empty file ──

  it("rejects an empty PDF (size === 0)", async () => {
    const file = makeFile("", "empty.pdf", "application/pdf");
    await expect(validateDocumentUpload(file)).rejects.toThrow("Empty file.");
  });

  // ── size limits ──

  it("accepts a file exactly at MAX_PDF_SIZE (boundary)", async () => {
    const file = makeFakeSizedFile(PDF_MAGIC, MAX_PDF_SIZE, "max.pdf", "application/pdf");
    await expect(validateDocumentUpload(file)).resolves.toBeUndefined();
  });

  it("rejects a file one byte over MAX_PDF_SIZE", async () => {
    const file = makeFakeSizedFile(PDF_MAGIC, MAX_PDF_SIZE + 1, "big.pdf", "application/pdf");
    await expect(validateDocumentUpload(file)).rejects.toThrow(
      "File exceeds maximum size.",
    );
  });

  // ── MIME type rejections ──

  it("rejects a JPEG submitted to the document validator", async () => {
    const file = makeBinaryFile(JPEG_MAGIC, "photo.jpg", "image/jpeg");
    await expect(validateDocumentUpload(file)).rejects.toThrow(
      "Unsupported file type.",
    );
  });

  it("rejects an executable via the document validator", async () => {
    const file = makeFile("MZ\x90\x00", "malware.exe", "application/x-executable");
    await expect(validateDocumentUpload(file)).rejects.toThrow(
      "Unsupported file type.",
    );
  });

  // ── MIME spoof attack caught at magic-number stage ──

  it("MIME spoof: HTML payload claiming to be application/pdf is caught at magic-number stage", async () => {
    const spoofed = makeBinaryFile(HTML_BYTES, "report.pdf", "application/pdf");
    await expect(validateDocumentUpload(spoofed)).rejects.toThrow(
      "File content does not match file type.",
    );
  });

  it("MIME spoof: EXE content claiming to be application/pdf is caught at magic-number stage", async () => {
    const spoofed = makeBinaryFile(EXE_BYTES, "invoice.pdf", "application/pdf");
    await expect(validateDocumentUpload(spoofed)).rejects.toThrow(
      "File content does not match file type.",
    );
  });

  // ── error type assertion ──

  it("throws FileValidationError for MIME type violations", async () => {
    const file = makeFile("data", "bad.html", "text/html");
    await expect(validateDocumentUpload(file)).rejects.toBeInstanceOf(
      FileValidationError,
    );
  });
});

// ─── exported constants ───────────────────────────────────────────────────────

describe("exported constants", () => {
  it("MAX_IMAGE_SIZE is 10 MB", () => {
    expect(MAX_IMAGE_SIZE).toBe(10 * 1024 * 1024);
  });

  it("MAX_PDF_SIZE is 20 MB", () => {
    expect(MAX_PDF_SIZE).toBe(20 * 1024 * 1024);
  });

  it("ALLOWED_IMAGE_TYPES contains exactly jpeg, png, webp", () => {
    expect(ALLOWED_IMAGE_TYPES).toContain("image/jpeg");
    expect(ALLOWED_IMAGE_TYPES).toContain("image/png");
    expect(ALLOWED_IMAGE_TYPES).toContain("image/webp");
    expect(ALLOWED_IMAGE_TYPES).toHaveLength(3);
  });

  it("ALLOWED_DOCUMENT_TYPES contains exactly application/pdf", () => {
    expect(ALLOWED_DOCUMENT_TYPES).toContain("application/pdf");
    expect(ALLOWED_DOCUMENT_TYPES).toHaveLength(1);
  });

  it("image/gif is NOT in ALLOWED_IMAGE_TYPES", () => {
    expect(ALLOWED_IMAGE_TYPES as readonly string[]).not.toContain("image/gif");
  });

  it("image/svg+xml is NOT in ALLOWED_IMAGE_TYPES (SVG carries script risk)", () => {
    expect(ALLOWED_IMAGE_TYPES as readonly string[]).not.toContain("image/svg+xml");
  });
});
