import "server-only";

import { spawn } from "node:child_process";
import ffmpegStaticPath from "ffmpeg-static";
import type { VideoFormat } from "@/lib/studio/types";
import { FPS, OUTPUT_H, OUTPUT_W, type TimedShot } from "./timeline";

/**
 * ffmpeg command assembly + runner. The command builder is pure (tested);
 * `runFfmpeg` spawns the ffmpeg-static binary with a hard timeout and never
 * uses a shell, so file paths cannot inject flags.
 */

export interface FfmpegPlan {
  args: string[];
  /** Human-readable summary for logs (paths only). */
  summary: string;
}

/** Shot-to-shot transitions, used in rotation. Each overlaps the start of the next shot by XFADE_SEC. */
export const TRANSITIONS = ["slideleft", "zoomin", "slideup", "smoothleft", "circleopen"] as const;
export const XFADE_SEC = 0.25;
/** Storyteller: one soft cross-fade between every shot (presenter ↔ b-roll), instead of the rotating set. */
export const STORY_FADE_SEC = 0.35;
/** Accent yellow of the progress bar (matches ACCENT_ASS in ass.ts). */
const ACCENT = "0xFFD400";
const BAR_H = 14;
/** Storyteller voice waveform, drawn under the captions while the presenter is on screen. */
const WAVE_W = 900;
const WAVE_H = 150;
const WAVE_X = 90;
const WAVE_Y = 1340;
/** Presenter shots (storyteller): a slow centred push-in that never drifts, so the figure stays framed. */
export const PRESENTER_ZOOM = "min(1+0.0004*on,1.08)";

/**
 * "Viral" template (v2) and "storyteller". Inputs: one looping still per shot (+ its narration mp3 when present).
 * Video: per-shot cover-fit + punch-in zoom → xfade transitions → light grade → progress bar → ASS captions.
 * Audio: narration padded to each shot, concatenated; silent shots get generated silence.
 * Every shot but the last runs XFADE_SEC longer and each transition starts exactly where the next shot's
 * narration starts (offset = sum of the previous shot durations), so picture and audio stay aligned.
 *
 * Storyteller differs only where noted: fades of STORY_FADE_SEC, a slow centred push-in on presenter shots
 * (b-roll keeps the punch-in), a softer grade, and the narration split into a yellow waveform overlaid while a
 * presenter shot is on screen. Without presenter shots the waveform branch is left out entirely.
 */
export function buildFfmpegArgs(input: { shots: TimedShot[]; assPath: string; fontsDir: string; outPath: string; format?: VideoFormat }): FfmpegPlan {
  const { shots } = input;
  const story = input.format === "storyteller";
  const fadeSec = story ? STORY_FADE_SEC : XFADE_SEC;
  const isPresenter = (s: TimedShot) => story && s.role === "presenter";
  const args: string[] = ["-hide_banner", "-loglevel", "error", "-y", "-nostdin"];
  const filters: string[] = [];
  let audioInputs = 0;
  const lens = shots.map((s, i) => s.duration + (i < shots.length - 1 ? fadeSec : 0));
  shots.forEach((s, i) => args.push("-loop", "1", "-framerate", String(FPS), "-t", lens[i].toFixed(3), "-i", s.imagePath));
  shots.forEach((s) => {
    if (s.audioPath) {
      args.push("-i", s.audioPath);
      audioInputs += 1;
    }
  });
  // Punch-in: ease out to 1.12x in half a second, then a slow creep; odd shots also drift sideways.
  const punchIn = "if(lte(on,15),1+0.12*(1-pow(1-on/15,3)),min(1.12+0.0007*(on-15),1.3))";
  shots.forEach((s, i) => {
    const frames = Math.max(1, Math.round(lens[i] * FPS));
    const presenter = isPresenter(s);
    const zoom = presenter ? PRESENTER_ZOOM : punchIn;
    const x = i % 2 && !presenter ? "min(iw/2-(iw/zoom/2)+on*0.6,iw-iw/zoom)" : "iw/2-(iw/zoom/2)";
    filters.push(
      `[${i}:v]scale=${OUTPUT_W * 2}:${OUTPUT_H * 2}:force_original_aspect_ratio=increase,crop=${OUTPUT_W * 2}:${OUTPUT_H * 2},` +
        `zoompan=z='${zoom}':x='${x}':y='ih/2-(ih/zoom/2)':d=${frames}:s=${OUTPUT_W}x${OUTPUT_H}:fps=${FPS},` +
        // fps= restores a constant frame rate after trim/setpts: ffmpeg 7 (the Linux binary Vercel runs) refuses xfade inputs
        // whose rate reads 1/0, while the macOS 6.0 build accepted them.
        `trim=duration=${lens[i].toFixed(3)},setpts=PTS-STARTPTS,format=yuv420p,setsar=1,fps=${FPS}[v${i}]`,
    );
  });
  let video = "v0";
  let offset = 0;
  for (let i = 1; i < shots.length; i++) {
    offset += shots[i - 1].duration;
    const transition = story ? "fade" : TRANSITIONS[(i - 1) % TRANSITIONS.length];
    filters.push(`[${video}][v${i}]xfade=transition=${transition}:duration=${fadeSec}:offset=${offset.toFixed(3)}[x${i}]`);
    video = `x${i}`;
  }
  const total = shots.reduce((n, s) => n + s.duration, 0).toFixed(3);
  const grade = story ? "eq=saturation=1.05:contrast=1.08" : "eq=saturation=1.18:contrast=1.06";
  filters.push(`[${video}]${grade},drawbox=x=0:y=0:w=${OUTPUT_W}:h=${BAR_H}:color=black@0.35:t=fill[graded]`);
  filters.push(`color=c=${ACCENT}:s=${OUTPUT_W}x${BAR_H}:r=${FPS}:d=${total}[bar]`);
  filters.push(`[graded][bar]overlay=x='-w+w*t/${total}':y=0:eval=frame[barred]`);
  // Audio chain: narration padded to the shot length, or pure silence.
  let audioIdx = shots.length;
  shots.forEach((s, i) => {
    if (s.audioPath) {
      filters.push(`[${audioIdx}:a]aresample=44100,apad=whole_dur=${s.duration.toFixed(3)},atrim=duration=${s.duration.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`);
      audioIdx += 1;
    } else {
      filters.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${s.duration.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`);
    }
  });
  const concat = `${shots.map((_, i) => `[a${i}]`).join("")}concat=n=${shots.length}:v=0:a=1`;
  const windows = shots.filter(isPresenter).map((s) => `between(t,${s.start.toFixed(2)},${(s.start + s.duration).toFixed(2)})`);
  let captioned = "barred";
  let audioOut = "acat";
  if (windows.length) {
    // One copy of the narration feeds the encoder, the other draws the waveform (enabled on presenter shots only).
    filters.push(`${concat},asplit=2[aout][aw]`);
    filters.push(`[aw]showwaves=s=${WAVE_W}x${WAVE_H}:mode=cline:rate=${FPS}:colors=${ACCENT}:scale=sqrt,format=rgba,colorchannelmixer=aa=0.85[wave]`);
    filters.push(`[barred][wave]overlay=x=${WAVE_X}:y=${WAVE_Y}:enable='${windows.join("+")}'[waved]`);
    captioned = "waved";
    audioOut = "aout";
  } else {
    filters.push(`${concat}[acat]`);
  }
  // Force HarfBuzz shaping: with libass's "auto" some builds (the macOS ffmpeg-static binary) fall back to simple
  // shaping, which draws a Thai tone mark on top of an upper vowel (ที่ reads ที, เรื่อง reads เรือง).
  filters.push(`[${captioned}]ass='${escapeFilterPath(input.assPath)}':fontsdir='${escapeFilterPath(input.fontsDir)}':shaping=complex[vout]`);
  args.push("-filter_complex", filters.join(";"), "-map", "[vout]", "-map", `[${audioOut}]`);
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-r", String(FPS), "-movflags", "+faststart");
  args.push("-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-shortest", input.outPath);
  const counts = `${shots.length} shots, ${audioInputs} narration tracks, ${Math.max(0, shots.length - 1)} transitions`;
  const summary = story ? `storyteller: ${counts}, ${windows.length} presenter shots → ${input.outPath}` : `template: ${counts} → ${input.outPath}`;
  return { args, summary };
}

/** ffmpeg filter args treat `:`, `'` and `\` specially. */
export function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
}

export function ffmpegBinary(): string {
  // ffmpeg-static exports the absolute path of the platform binary (null when unsupported).
  const bin = ffmpegStaticPath as string | null;
  if (!bin) throw new Error("ffmpeg binary not available on this platform");
  return bin;
}

export async function runFfmpeg(args: string[], opts: { timeoutMs?: number; bin?: string } = {}): Promise<{ durationMs: number }> {
  const bin = opts.bin ?? ffmpegBinary();
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`ffmpeg timed out after ${opts.timeoutMs ?? 240_000} ms`));
    }, opts.timeoutMs ?? 240_000);
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg failed to start: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ durationMs: Date.now() - started });
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.trim().split("\n").slice(-6).join(" | ").slice(0, 900)}`));
    });
  });
}
