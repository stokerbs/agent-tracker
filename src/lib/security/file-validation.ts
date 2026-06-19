export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10 MB
export const MAX_PDF_SIZE   = 20 * 1024 * 1024;   // 20 MB
export const MAX_VIDEO_SIZE = 200 * 1024 * 1024;  // 200 MB

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_DOCUMENT_TYPES = ["application/pdf"] as const;

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
] as const;

// ─── magic-number helpers ─────────────────────────────────────────────────────

/**
 * Reads the first 32 bytes of the file and checks that they match one of the
 * three allowed image signatures:
 *
 *   JPEG  — FF D8 FF       (SOI marker)
 *   PNG   — 89 50 4E 47    (\x89PNG)
 *   WebP  — 52 49 46 46 .. 57 45 42 50  (RIFF....WEBP, bytes 0–3 + 8–11)
 *
 * Throws FileValidationError when the bytes do not match any known image format.
 */
export async function validateImageMagicNumber(file: File): Promise<void> {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());

  const isJpeg =
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;

  // WebP: "RIFF" at bytes 0–3, "WEBP" at bytes 8–11.
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  if (!isJpeg && !isPng && !isWebp) {
    throw new FileValidationError("File content does not match file type.");
  }
}

/**
 * Reads the first 32 bytes of the file and checks for the PDF signature:
 *
 *   PDF — 25 50 44 46  (%PDF)
 *
 * Throws FileValidationError when the bytes do not start with %PDF.
 */
export async function validatePdfMagicNumber(file: File): Promise<void> {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());

  const isPdf =
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46;

  if (!isPdf) {
    throw new FileValidationError("File content does not match file type.");
  }
}

// ─── public validators ────────────────────────────────────────────────────────

/**
 * Validates an image file upload (JPEG, PNG, WebP — max 10 MB).
 *
 * Validation order (fail-fast, cheapest checks first):
 *   1. Empty file
 *   2. Size limit
 *   3. Declared MIME type (attacker-controlled — necessary but not sufficient)
 *   4. Magic-number byte check (defeats MIME spoofing)
 *
 * Call this BEFORE any storage write. Throws FileValidationError on failure
 * so the caller can surface a user-friendly message without exposing internals.
 */
export async function validateImageUpload(file: File): Promise<void> {
  if (file.size === 0) {
    throw new FileValidationError("Empty file.");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new FileValidationError("File exceeds maximum size.");
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new FileValidationError("Unsupported file type.");
  }
  await validateImageMagicNumber(file);
}

/**
 * Validates a video file upload (MP4/MOV/WebM/M4V — max 200 MB).
 *
 * Video containers are too format-diverse for a reliable magic-number check,
 * so validation is MIME type + size only. Supabase Storage is the backstop.
 */
export async function validateVideoUpload(file: File): Promise<void> {
  if (file.size === 0) {
    throw new FileValidationError("Empty file.");
  }
  if (file.size > MAX_VIDEO_SIZE) {
    throw new FileValidationError("Video exceeds 200 MB limit.");
  }
  if (!(ALLOWED_VIDEO_TYPES as readonly string[]).includes(file.type)) {
    throw new FileValidationError("Unsupported video type. Use MP4, MOV, or WebM.");
  }
}

/**
 * Validates a document file upload (PDF — max 20 MB).
 *
 * Same validation order and calling convention as validateImageUpload.
 */
export async function validateDocumentUpload(file: File): Promise<void> {
  if (file.size === 0) {
    throw new FileValidationError("Empty file.");
  }
  if (file.size > MAX_PDF_SIZE) {
    throw new FileValidationError("File exceeds maximum size.");
  }
  if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
    throw new FileValidationError("Unsupported file type.");
  }
  await validatePdfMagicNumber(file);
}
