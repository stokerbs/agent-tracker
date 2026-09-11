import "server-only";

import { spawn } from "node:child_process";
import ffmpegStaticPath from "ffmpeg-static";
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
/** Accent yellow of the progress bar (matches ACCENT_ASS in ass.ts). */
const ACCENT = "0xFFD400";
const BAR_H = 14;

/**
 * "Viral" template (v2). Inputs: one looping still per shot (+ its narration mp3 when present).
 * Video: per-shot cover-fit + punch-in zoom → xfade transitions → light grade → progress bar → ASS captions.
 * Audio: narration padded to each shot, concatenated; silent shots get generated silence.
 * Every shot but the last runs XFADE_SEC longer and each transition starts exactly where the next shot's
 * narration starts (offset = sum of the previous shot durations), so picture and audio stay aligned.
 */
export function buildFfmpegArgs(input: { shots: TimedShot[]; assPath: string; fontsDir: string; outPath: string }): FfmpegPlan {
  const { shots } = input;
  const args: string[] = ["-hide_banner", "-loglevel", "error", "-y", "-nostdin"];
  const filters: string[] = [];
  let audioInputs = 0;
  const lens = shots.map((s, i) => s.duration + (i < shots.length - 1 ? XFADE_SEC : 0));
  shots.forEach((s, i) => args.push("-loop", "1", "-framerate", String(FPS), "-t", lens[i].toFixed(3), "-i", s.imagePath));
  shots.forEach((s) => {
    if (s.audioPath) {
      args.push("-i", s.audioPath);
      audioInputs += 1;
    }
  });
  // Punch-in: ease out to 1.12x in half a second, then a slow creep; odd shots also drift sideways.
  const zoom = "if(lte(on,15),1+0.12*(1-pow(1-on/15,3)),min(1.12+0.0007*(on-15),1.3))";
  shots.forEach((s, i) => {
    const frames = Math.max(1, Math.round(lens[i] * FPS));
    const x = i % 2 ? "min(iw/2-(iw/zoom/2)+on*0.6,iw-iw/zoom)" : "iw/2-(iw/zoom/2)";
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
    filters.push(`[${video}][v${i}]xfade=transition=${TRANSITIONS[(i - 1) % TRANSITIONS.length]}:duration=${XFADE_SEC}:offset=${offset.toFixed(3)}[x${i}]`);
    video = `x${i}`;
  }
  const total = shots.reduce((n, s) => n + s.duration, 0).toFixed(3);
  filters.push(`[${video}]eq=saturation=1.18:contrast=1.06,drawbox=x=0:y=0:w=${OUTPUT_W}:h=${BAR_H}:color=black@0.35:t=fill[graded]`);
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
  filters.push(`${shots.map((_, i) => `[a${i}]`).join("")}concat=n=${shots.length}:v=0:a=1[acat]`);
  // Force HarfBuzz shaping: with libass's "auto" some builds (the macOS ffmpeg-static binary) fall back to simple
  // shaping, which draws a Thai tone mark on top of an upper vowel (ที่ reads ที, เรื่อง reads เรือง).
  filters.push(`[barred]ass='${escapeFilterPath(input.assPath)}':fontsdir='${escapeFilterPath(input.fontsDir)}':shaping=complex[vout]`);
  args.push("-filter_complex", filters.join(";"), "-map", "[vout]", "-map", "[acat]");
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-r", String(FPS), "-movflags", "+faststart");
  args.push("-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-shortest", input.outPath);
  return { args, summary: `${shots.length} shots, ${audioInputs} narration tracks, ${Math.max(0, shots.length - 1)} transitions → ${input.outPath}` };
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
