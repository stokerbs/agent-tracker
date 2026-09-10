import { HOOK_OVERLAY_SEC, OUTPUT_H, OUTPUT_W, timeSubtitles, type TimedShot } from "./timeline";

/**
 * Advanced SubStation Alpha (ASS) builder for libass. Two styles: `Sub` for
 * the burned-in subtitles (bottom third, Sarabun Bold, dark box) and `Hook`
 * for the opening overlay (centre, large). Pure — unit-tested.
 */

export const SUB_FONT = "Sarabun";

export function assTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${ss.toFixed(2).padStart(5, "0")}`;
}

/** ASS treats `{`, `}` and `\` specially; newlines become \N. */
export function escapeAss(text: string): string {
  return text.replace(/\\/g, "＼").replace(/[{}]/g, "").replace(/\r?\n/g, "\\N");
}

export function buildAss(input: { shots: TimedShot[]; hook: string | null }): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${OUTPUT_W}
PlayResY: ${OUTPUT_H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,${SUB_FONT},64,&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,3,6,0,2,80,80,300,1
Style: Hook,${SUB_FONT},92,&H00FFFFFF,&H000000FF,&H00000000,&HB4000000,-1,0,0,0,100,100,0,0,3,10,0,5,90,90,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines: string[] = [];
  const hook = input.hook?.trim();
  if (hook && input.shots.length) {
    const end = Math.min(HOOK_OVERLAY_SEC, input.shots[0].duration);
    lines.push(`Dialogue: 1,${assTime(0)},${assTime(end)},Hook,,0,0,0,,${escapeAss(hook)}`);
  }
  for (const shot of input.shots) {
    for (const cue of timeSubtitles(shot)) {
      lines.push(`Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Sub,,0,0,0,,${escapeAss(cue.text)}`);
    }
  }
  return header + lines.join("\n") + "\n";
}
