/**
 * Image metadata + EXIF extraction.
 *
 * sharp gives us container facts (dimensions, format, density) and the raw EXIF
 * buffer; exif-reader parses that buffer into camera/lens/software/orientation,
 * GPS coordinates and timestamps. Everything is best-effort — a stripped or
 * malformed EXIF block must degrade to nulls, never throw.
 */

import sharp from "sharp";
import exifReader from "exif-reader";
import type { ImageMetadata } from "./types";

/** exif-reader's loosely-typed output. We read defensively. */
type ExifBlock = {
  Image?: Record<string, unknown>;
  Photo?: Record<string, unknown>;
  GPSInfo?: Record<string, unknown>;
  [k: string]: unknown;
};

/** Convert an EXIF GPS coordinate ([d,m,s] + ref) to signed decimal degrees. */
function gpsToDecimal(coord: unknown, ref: unknown): number | null {
  if (!Array.isArray(coord) || coord.length < 3) return null;
  const [d, m, s] = coord.map((n) => Number(n));
  if (![d, m, s].every(Number.isFinite)) return null;
  let dec = d + m / 60 + s / 3600;
  const r = typeof ref === "string" ? ref.toUpperCase() : "";
  if (r === "S" || r === "W") dec = -dec;
  return dec;
}

/** Parse an EXIF date string ("YYYY:MM:DD HH:MM:SS") or Date to an ISO string. */
function exifDateToIso(value: unknown): string | null {
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (m) {
      const [, y, mo, da, h, mi, se] = m;
      const dt = new Date(`${y}-${mo}-${da}T${h}:${mi}:${se}`);
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }
  }
  return null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extract normalized metadata from an image buffer. Never throws — decode or
 * EXIF-parse failures surface as null fields so the pipeline can still persist a
 * partial result and mark the metadata stage's confidence accordingly.
 */
export async function extractMetadata(buf: Buffer): Promise<ImageMetadata> {
  const base: ImageMetadata = {
    width: null,
    height: null,
    mime: null,
    format: null,
    filesize: buf.length,
    dpi: null,
    cameraMake: null,
    cameraModel: null,
    lens: null,
    software: null,
    orientation: null,
    gpsLat: null,
    gpsLng: null,
    gpsAltitude: null,
    takenAt: null,
    rawExif: null,
  };

  let meta: sharp.Metadata;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    return base; // undecodable — caller decides how to treat this
  }

  base.width = meta.width ?? null;
  base.height = meta.height ?? null;
  base.format = meta.format ?? null;
  base.mime = meta.format ? `image/${meta.format}` : null;
  base.dpi = meta.density ?? null;
  base.orientation = meta.orientation ?? null;

  if (meta.exif && meta.exif.length) {
    try {
      const exif = exifReader(meta.exif) as ExifBlock;
      base.rawExif = exif as unknown as Record<string, unknown>;

      const image = exif.Image ?? {};
      const photo = exif.Photo ?? {};
      const gps = exif.GPSInfo ?? {};

      base.cameraMake = str(image.Make);
      base.cameraModel = str(image.Model);
      base.software = str(image.Software);
      base.lens = str(photo.LensModel ?? photo.LensMake);
      base.orientation = num(image.Orientation) ?? base.orientation;

      base.takenAt =
        exifDateToIso(photo.DateTimeOriginal) ??
        exifDateToIso(image.DateTime) ??
        exifDateToIso(photo.DateTimeDigitized);

      const lat = gpsToDecimal(gps.GPSLatitude, gps.GPSLatitudeRef);
      const lng = gpsToDecimal(gps.GPSLongitude, gps.GPSLongitudeRef);
      if (lat !== null && lng !== null) {
        base.gpsLat = lat;
        base.gpsLng = lng;
      }
      const alt = num(gps.GPSAltitude);
      if (alt !== null) {
        // GPSAltitudeRef === 1 means below sea level.
        base.gpsAltitude = num(gps.GPSAltitudeRef) === 1 ? -alt : alt;
      }
    } catch {
      // Corrupt EXIF — keep container facts, leave EXIF-derived fields null.
    }
  }

  return base;
}
