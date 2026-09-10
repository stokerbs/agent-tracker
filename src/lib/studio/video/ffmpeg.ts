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

/**
 * Inputs: one looping still per shot (+ its narration mp3 when present), then
 * per-shot scale/crop/zoompan → concat → ASS subtitles → libx264/aac.
 * Silent shots get generated silence so the audio concat stays aligned.
 */
export function buildFfmpegArgs(input: { shots: TimedShot[]; assPath: string; fontsDir: string; outPath: string }): FfmpegPlan {
  const { shots } = input;
  const args: string[] = ["-hide_banner", "-loglevel", "error", "-y", "-nostdin"];
  const filters: string[] = [];
  let audioInputs = 0;
  shots.forEach((s, i) => {
    args.push("-loop", "1", "-framerate", String(FPS), "-t", s.duration.toFixed(3), "-i", s.imagePath);
  });
  shots.forEach((s) => {
    if (s.audioPath) {
      args.push("-i", s.audioPath);
      audioInputs += 1;
    }
  });
  // Video chain per shot: cover-fit to 1080x1920, gentle Ken Burns zoom, constant fps, yuv420p.
  shots.forEach((s, i) => {
    const frames = Math.max(1, Math.round(s.duration * FPS));
    const zoomDir = i % 2 === 0 ? "min(zoom+0.0006,1.18)" : "if(eq(on,1),1.18,max(zoom-0.0006,1.0))";
    filters.push(
      `[${i}:v]scale=${OUTPUT_W * 2}:${OUTPUT_H * 2}:force_original_aspect_ratio=increase,crop=${OUTPUT_W * 2}:${OUTPUT_H * 2},` +
        `zoompan=z='${zoomDir}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${OUTPUT_W}x${OUTPUT_H}:fps=${FPS},` +
        `trim=duration=${s.duration.toFixed(3)},setpts=PTS-STARTPTS,format=yuv420p[v${i}]`,
    );
  });
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
  const concatIn = shots.map((_, i) => `[v${i}][a${i}]`).join("");
  filters.push(`${concatIn}concat=n=${shots.length}:v=1:a=1[vcat][acat]`);
  filters.push(`[vcat]subtitles='${escapeFilterPath(input.assPath)}':fontsdir='${escapeFilterPath(input.fontsDir)}'[vout]`);
  args.push("-filter_complex", filters.join(";"), "-map", "[vout]", "-map", "[acat]");
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-r", String(FPS), "-movflags", "+faststart");
  args.push("-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-shortest", input.outPath);
  return { args, summary: `${shots.length} shots, ${audioInputs} narration tracks → ${input.outPath}` };
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
