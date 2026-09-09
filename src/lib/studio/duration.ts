/**
 * Spoken-duration estimate for short-form scripts.
 *
 * Thai has no word spaces, so we estimate from syllable-ish units: Thai
 * characters excluding tone marks / vowels that ride above or below the line.
 * Calibration (natural TikTok pace): ~5.5 Thai syllables/sec, ~2.6 English
 * words/sec. Pauses: +0.35 s per sentence break, +0.6 s per blank line.
 *
 * This is an ESTIMATE for pacing — the UI labels it as such.
 */

const THAI_BASE_CHARS = /[ก-ฮะาำเ-ๅ]/g; // consonants + inline vowels
const LATIN_WORDS = /[A-Za-z0-9][A-Za-z0-9'’-]*/g;
const SENTENCE_BREAKS = /[.!?…]|\n(?!\n)/g;
const PARAGRAPH_BREAKS = /\n\s*\n/g;

export const THAI_SYLLABLES_PER_SEC = 5.5;
export const EN_WORDS_PER_SEC = 2.6;

export function stripScriptMarkup(text: string): string {
  // Remove [HOOK] / (visual: …) / timestamps like 00:00–00:03 so they don't count as speech.
  return text
    .replace(/\[[^\]]{1,40}\]/g, " ")
    .replace(/\((?:visual|ภาพ|b-roll|text|overlay)[^)]*\)/gi, " ")
    .replace(/\b\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?\b/g, " ");
}

export function estimateSpokenSeconds(text: string | null | undefined): number {
  if (!text) return 0;
  const clean = stripScriptMarkup(text);
  const thai = (clean.match(THAI_BASE_CHARS) ?? []).length;
  // Thai base chars ≈ 1.6 chars per syllable on average.
  const thaiSyllables = thai / 1.6;
  const words = (clean.match(LATIN_WORDS) ?? []).length;
  const sentences = (clean.match(SENTENCE_BREAKS) ?? []).length;
  const paragraphs = (clean.match(PARAGRAPH_BREAKS) ?? []).length;
  const seconds =
    thaiSyllables / THAI_SYLLABLES_PER_SEC +
    words / EN_WORDS_PER_SEC +
    sentences * 0.35 +
    paragraphs * 0.6;
  return Math.round(seconds);
}

export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} วิ`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} นาที ${s} วิ` : `${m} นาที`;
}

/** How far the estimate is from target: within ±15% is "on target". */
export function durationFit(
  estimated: number,
  target: number | null | undefined,
): "on_target" | "short" | "long" | "unknown" {
  if (!target || !estimated) return "unknown";
  const ratio = estimated / target;
  if (ratio < 0.85) return "short";
  if (ratio > 1.15) return "long";
  return "on_target";
}
