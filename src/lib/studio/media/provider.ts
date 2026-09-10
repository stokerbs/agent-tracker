import "server-only";

import type { ImageAspect, MediaPrefs } from "@/lib/studio/types";
import { GeminiImageProvider } from "./gemini-image";
import { ElevenLabsTtsProvider } from "./elevenlabs-tts";

/**
 * Media provider seam (phase 1: images + voice-over).
 *
 * Same contract as the text-AI seam: a missing key throws
 * MediaNotConfiguredError with a Thai, actionable message — the UI shows the
 * reason and disables the button. Nothing here ever fakes success.
 */

export class MediaNotConfiguredError extends Error {
  readonly kind: "image" | "tts";
  constructor(kind: "image" | "tts", message: string) {
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

export interface TtsProvider {
  readonly name: string;
  synthesize(input: { text: string; voiceId?: string; model?: string; timeoutMs?: number }): Promise<GeneratedAudio>;
}

export const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";
export const DEFAULT_TTS_MODEL = "eleven_multilingual_v2";
/** ElevenLabs "Sarah" — multilingual v2 voice that handles Thai acceptably; owner can override in Settings. */
export const DEFAULT_TTS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export interface MediaAvailability {
  image: { available: boolean; reason?: string; provider: string; model: string };
  tts: { available: boolean; reason?: string; provider: string; model: string; voiceId: string };
}

/** Cheap, synchronous status for UI banners (no network). */
export function getMediaAvailability(prefs: MediaPrefs, env: NodeJS.ProcessEnv = process.env): MediaAvailability {
  const imageModel = prefs.image_model.trim() || env.STUDIO_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  const ttsModel = prefs.tts_model.trim() || env.STUDIO_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL;
  const voiceId = prefs.tts_voice_id.trim() || env.STUDIO_TTS_VOICE_ID?.trim() || DEFAULT_TTS_VOICE_ID;
  return {
    image: env.GEMINI_API_KEY
      ? { available: true, provider: "gemini", model: imageModel }
      : { available: false, provider: "gemini", model: imageModel, reason: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY — เพิ่มใน Vercel/.env.local เพื่อเปิดการสร้างภาพ" },
    tts: env.ELEVENLABS_API_KEY
      ? { available: true, provider: "elevenlabs", model: ttsModel, voiceId }
      : { available: false, provider: "elevenlabs", model: ttsModel, voiceId, reason: "ยังไม่ได้ตั้งค่า ELEVENLABS_API_KEY — เพิ่มใน Vercel/.env.local เพื่อเปิดการพากย์เสียง" },
  };
}

export function getImageProvider(env: NodeJS.ProcessEnv = process.env): ImageProvider {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new MediaNotConfiguredError("image", getMediaAvailability(emptyPrefs(), env).image.reason!);
  return new GeminiImageProvider(key);
}

export function getTtsProvider(env: NodeJS.ProcessEnv = process.env): TtsProvider {
  const key = env.ELEVENLABS_API_KEY;
  if (!key) throw new MediaNotConfiguredError("tts", getMediaAvailability(emptyPrefs(), env).tts.reason!);
  return new ElevenLabsTtsProvider(key);
}

function emptyPrefs(): MediaPrefs {
  return { image_style: "", default_aspect: "9:16", image_model: "", tts_voice_id: "", tts_model: "" };
}
