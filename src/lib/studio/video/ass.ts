import { HOOK_LINE_MAX, HOOK_LINE_TARGET, HOOK_OVERLAY_SEC, OUTPUT_H, OUTPUT_W, subtitleLines, timeSubtitles, totalDuration, type TimedShot } from "./timeline";

/**
 * Advanced SubStation Alpha (ASS) builder for libass — "viral" template (v2), chosen by the owner on 2026-09-11:
 * - `Cap`: one short line at a time in the lower-middle of the frame, white with a heavy outline, popping in,
 *   key words and numbers in the accent yellow.
 * - `Hook`: the opening line on a yellow card that slams in.
 * - `Tag`: a small brand label under the progress bar (Latin text only).
 * Pure — unit-tested. Every style that renders Thai keeps Spacing 0: letter spacing makes libass drop tone marks.
 */

export const SUB_FONT = "Sarabun";
/** Vertical centre of the caption line: clear of the TikTok/Reels bottom UI and the right-hand buttons. */
export const CAPTION_Y = 1230;
export const HOOK_Y = 640;
/** Accent yellow #FFD400 in ASS &HBBGGRR& order. */
export const ACCENT_ASS = "&H00D4FF&";
const WHITE_ASS = "&HFFFFFF&";

/** Words the eye should land on; numbers are always highlighted. */
export const EMPHASIS_WORDS = ["หลักฐาน", "นักสืบ", "ไม่ใช่", "ความจริง", "จริง", "เงิน", "ห้าม", "ตำรวจ", "กฎหมาย", "GPS", "ลับ", "เคส", "นอกใจ", "ตามหา", "ทรัพย์สิน", "OSINT"];
const EMPHASIS = new Set(EMPHASIS_WORDS);
/** ICU splits some key words (หลัก|ฐาน, ความ|จริง, ตาม|หา): up to this many consecutive words are joined back. */
const MAX_EMPHASIS_WORDS = 3;
const NUMBER_RE = /^\d+(?:[.,:]\d+)*$/;
let wordSegmenter: Intl.Segmenter | null = null;

export function assTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${ss.toFixed(2).padStart(5, "0")}`;
}

/** ASS treats `{`, `}` and `\` specially; newlines become \N. */
export function escapeAss(text: string): string {
  // Strip other control chars first: a bare CR/LF or NUL would end the Dialogue line in libass.
  return text
    .replace(/[\r\n]+/g, "\\N")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .replace(/\\(?!N)/g, "＼")
    .replace(/[{}]/g, "");
}

/**
 * Colour key words and numbers in already-escaped text. Matching works on whole ICU words, joining up to
 * MAX_EMPHASIS_WORDS and preferring the longest, so a key word inside another word (ลับ in กลับ, จริง in จริงจัง)
 * is never coloured and a colour change can never split a Thai syllable. Tags only wrap matched words.
 */
export function emphasize(escaped: string): string {
  wordSegmenter ??= new Intl.Segmenter("th", { granularity: "word" });
  const words = Array.from(wordSegmenter.segment(escaped), (x) => x.segment);
  let out = "";
  for (let i = 0; i < words.length; ) {
    let take = 0;
    for (let n = Math.min(MAX_EMPHASIS_WORDS, words.length - i); n >= 1; n--) {
      const joined = words.slice(i, i + n).join("");
      if (EMPHASIS.has(joined) || (n === 1 && NUMBER_RE.test(joined))) {
        take = n;
        break;
      }
    }
    if (take) {
      out += `{\\c${ACCENT_ASS}}${words.slice(i, i + take).join("")}{\\c${WHITE_ASS}}`;
      i += take;
    } else {
      out += words[i];
      i += 1;
    }
  }
  return out;
}

/**
 * WrapStyle 2 turns libass auto-wrapping off: lines break only where subtitleLines put an explicit \N.
 * The hook card is BorderStyle 4 (one box per event) with a fully transparent outline, so stacked tone marks
 * cannot poke an outline blob out of the card.
 */
export function buildAss(input: { shots: TimedShot[]; hook: string | null }): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${OUTPUT_W}
PlayResY: ${OUTPUT_H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${SUB_FONT},92,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,9,4,5,40,40,0,1
Style: Hook,${SUB_FONT},88,&H00141414,&H000000FF,&HFF000000,&H0000D4FF,-1,0,0,0,100,100,0,0,4,24,0,5,60,60,0,1
Style: Tag,${SUB_FONT},34,&H40FFFFFF,&H000000FF,&H80000000,&H00000000,-1,0,0,0,100,100,6,0,1,2,0,8,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines: string[] = [];
  const total = totalDuration(input.shots);
  if (total > 0) lines.push(`Dialogue: 0,${assTime(0)},${assTime(total)},Tag,,0,0,0,,{\\an8\\pos(540,34)}DETECTIVE PULSE`);
  const hook = input.hook?.trim();
  if (hook && input.shots.length) {
    const end = Math.min(HOOK_OVERLAY_SEC, input.shots[0].duration);
    // WrapStyle 2 means libass never wraps, so the hook gets the same breaker with its own (larger font) widths.
    const hookText = subtitleLines(hook, { target: HOOK_LINE_TARGET, max: HOOK_LINE_MAX }).join("\n");
    lines.push(`Dialogue: 2,${assTime(0)},${assTime(end)},Hook,,0,0,0,,{\\an5\\pos(540,${HOOK_Y})\\fscx135\\fscy135\\frz-4\\t(0,170,\\fscx100\\fscy100\\frz-2)}${escapeAss(hookText)}`);
  }
  for (const shot of input.shots) {
    for (const cue of timeSubtitles(shot)) {
      lines.push(
        `Dialogue: 1,${assTime(cue.start)},${assTime(cue.end)},Cap,,0,0,0,,{\\an5\\pos(540,${CAPTION_Y})\\fscx72\\fscy72\\t(0,90,\\fscx108\\fscy108)\\t(90,170,\\fscx100\\fscy100)}${emphasize(escapeAss(cue.text))}`,
      );
    }
  }
  return header + lines.join("\n") + "\n";
}
