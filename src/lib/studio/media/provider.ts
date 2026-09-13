import "server-only";

import type { ImageAspect, MediaPrefs } from "@/lib/studio/types";
import { GeminiImageProvider } from "./gemini-image";
import { VeoVideoProvider } from "./veo-video";
import { ElevenLabsTtsProvider } from "./elevenlabs-tts";

/**
 * Media provider seam (phase 1: images + voice-over).
 *
 * Same contract as the text-AI seam: a missing key throws
 * MediaNotConfiguredError with a Thai, actionable message — the UI shows the
 * reason and disables the button. Nothing here ever fakes success.
 */

export class MediaNotConfiguredError extends Error {
  readonly kind: "image" | "tts" | "video";
  constructor(kind: "image" | "tts" | "video", message: string) {
    super(message);
    this.name = "MediaNotConfiguredError";
    this.kind = kind;
  }
}

export class MediaRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaRefusedError";
  }
}

export interface GeneratedImage {
  bytes: Uint8Array;
  mime: "image/png" | "image/jpeg" | "image/webp";
  width: number | null;
  height: number | null;
  provider: string;
  model: string;
  durationMs: number;
}

export interface GeneratedAudio {
  bytes: Uint8Array;
  mime: "audio/mpeg";
  /** Estimated from bitrate when the provider does not report it. */
  durationMs: number | null;
  provider: string;
  model: string;
  voiceId: string;
  durationMsCall: number;
}

export interface ImageProvider {
  readonly name: string;
  generate(input: { prompt: string; aspect: ImageAspect; model?: string; timeoutMs?: number }): Promise<GeneratedImage>;
}

/** A Veo generation in flight: minutes long, so the operation name is stored and polled by a cron. */
export interface StartedVideo {
  operation: string;
  provider: string;
  model: string;
}

export interface VideoPoll {
  done: boolean;
  /** Set once done and successful — a short-lived download URI that needs the API key header. */
  uri?: string;
  /** Set once done and failed. */
  error?: string;
}

export interface VideoProvider {
  readonly name: string;
  start(input: { prompt: string; model?: string; seconds?: number; timeoutMs?: number }): Promise<StartedVideo>;
  poll(operation: string, timeoutMs?: number): Promise<VideoPoll>;
  download(uri: string, timeoutMs?: number): Promise<{ bytes: Uint8Array; mime: "video/mp4" }>;
}

export interface TtsProvider {
  readonly name: string;
  synthesize(input: { text: string; voiceId?: string; model?: string; timeoutMs?: number }): Promise<GeneratedAudio>;
}

export const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";
/** eleven_v3 is the only ElevenLabs model that speaks Thai reliably: multilingual_v2 auto-detects (and often mis-detects) the language, turbo/flash v2.5 reject th. */
export const DEFAULT_TTS_MODEL = "eleven_v3";
/** ElevenLabs "Sarah" — multilingual v2 voice that handles Thai acceptably; owner can override in Settings. */
export const DEFAULT_TTS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
/** Veo tier for the motion hook. Lite 1080p is ~$0.08/s: an 8 s hook costs about ฿22 against ฿2 for a still. */
export const DEFAULT_VEO_MODEL = "veo-3.1-lite-generate-preview";

export interface MediaAvailability {
  image: { available: boolean; reason?: string; provider: string; model: string };
  tts: { available: boolean; reason?: string; provider: string; model: string; voiceId: string };
  video: { available: boolean; reason?: string; provider: string; model: string };
}

/** Cheap, synchronous status for UI banners (no network). */
export function getMediaAvailability(prefs: MediaPrefs, env: NodeJS.ProcessEnv = process.env): MediaAvailability {
  const imageModel = prefs.image_model.trim() || env.STUDIO_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  const ttsModel = prefs.tts_model.trim() || env.STUDIO_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL;
  const voiceId = prefs.tts_voice_id.trim() || env.STUDIO_TTS_VOICE_ID?.trim() || DEFAULT_TTS_VOICE_ID;
  const videoModel = prefs.video_model?.trim() || env.STUDIO_VIDEO_MODEL?.trim() || DEFAULT_VEO_MODEL;
  return {
    image: env.GEMINI_API_KEY
      ? { available: true, provider: "gemini", model: imageModel }
      : { available: false, provider: "gemini", model: imageModel, reason: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY — เพิ่มใน Vercel/.env.local เพื่อเปิดการสร้างภาพ" },
    tts: env.ELEVENLABS_API_KEY
      ? { available: true, provider: "elevenlabs", model: ttsModel, voiceId }
      : { available: false, provider: "elevenlabs", model: ttsModel, voiceId, reason: "ยังไม่ได้ตั้งค่า ELEVENLABS_API_KEY — เพิ่มใน Vercel/.env.local เพื่อเปิดการพากย์เสียง" },
    video: env.GEMINI_API_KEY
      ? { available: true, provider: "veo", model: videoModel }
      : { available: false, provider: "veo", model: videoModel, reason: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY — เพิ่มใน Vercel/.env.local เพื่อเปิดการสร้างวิดีโอฮุก" },
  };
}

export function getImageProvider(env: NodeJS.ProcessEnv = process.env): ImageProvider {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new MediaNotConfiguredError("image", getMediaAvailability(emptyPrefs(), env).image.reason!);
  return new GeminiImageProvider(key);
}

export function getVideoProvider(env: NodeJS.ProcessEnv = process.env): VideoProvider {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new MediaNotConfiguredError("video", getMediaAvailability(emptyPrefs(), env).video.reason!);
  return new VeoVideoProvider(key);
}

export function getTtsProvider(env: NodeJS.ProcessEnv = process.env): TtsProvider {
  const key = env.ELEVENLABS_API_KEY;
  if (!key) throw new MediaNotConfiguredError("tts", getMediaAvailability(emptyPrefs(), env).tts.reason!);
  return new ElevenLabsTtsProvider(key);
}

function emptyPrefs(): MediaPrefs {
  return { image_style: "", default_aspect: "9:16", image_model: "", tts_voice_id: "", tts_model: "", video_model: "" };
}
