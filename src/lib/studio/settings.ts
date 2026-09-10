import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { STUDIO_SETTINGS_ID } from "@/lib/studio/constants";
import type {
  ApprovalRules,
  BrandVoice,
  MediaPrefs,
  PillarConfig,
  PrivacyRules,
  StudioSettingsRow,
} from "@/lib/studio/types";

export const DEFAULT_BRAND_VOICE: BrandVoice = {
  language: "th",
  style: ["professional", "natural", "calm", "experienced", "observational", "trustworthy"],
  avoid: ["over-selling", "credibility-damaging clickbait", "excessive emoji", "fake certainty", "fake investigation stories"],
  cta_default: "ปรึกษาเบื้องต้นได้ทาง LINE @detectivepluse",
  custom_notes: "",
};

export const DEFAULT_PILLARS: PillarConfig[] = [
  { key: "detective_knowledge", target_pct: 25 },
  { key: "case_story", target_pct: 30 },
  { key: "detective_pov", target_pct: 15 },
  { key: "red_flags", target_pct: 10 },
  { key: "behind_investigation", target_pct: 10 },
  { key: "service", target_pct: 10 },
];

export const DEFAULT_PRIVACY_RULES: PrivacyRules = { denylist: [], custom_patterns: [], strict_mode: false };
export const DEFAULT_APPROVAL_RULES: ApprovalRules = { require_privacy_safe: true, allow_override: true };
export const DEFAULT_MEDIA_PREFS: MediaPrefs = {
  image_style:
    "Cinematic, moody documentary photography for a Thai private-investigation brand. Dark navy and amber palette, shallow depth of field, urban Bangkok night settings, realistic textures. No text, no watermark.",
  default_aspect: "9:16",
  image_model: "",
  tts_voice_id: "",
  tts_model: "eleven_multilingual_v2",
};

/**
 * Loads the settings singleton (service client: settings are needed inside
 * server-only AI code paths that have no request cookies). Normalises jsonb
 * columns onto typed defaults so callers never null-check individual fields.
 */
export async function getStudioSettings(): Promise<StudioSettingsRow> {
  return loadSettings(false);
}

/**
 * Fail-closed variant for privacy-critical paths (LINE inbox capture, offline
 * import): a DB/RLS error THROWS instead of silently returning the default
 * (empty) denylist.
 */
export async function getStudioSettingsStrict(): Promise<StudioSettingsRow> {
  return loadSettings(true);
}

async function loadSettings(strict: boolean): Promise<StudioSettingsRow> {
  const svc = createServiceClient();
  const { data, error } = await svc.from("studio_settings").select("*").eq("id", STUDIO_SETTINGS_ID).maybeSingle();
  if (error) {
    console.error("[studio:settings] load failed:", error.message);
    if (strict) throw new Error(`studio settings unavailable: ${error.message}`);
  }
  const row = data ?? null;
  return {
    id: STUDIO_SETTINGS_ID,
    default_language: row?.default_language ?? "th",
    default_platforms: row?.default_platforms ?? ["tiktok", "instagram_reel", "facebook"],
    ai_provider: row?.ai_provider ?? "anthropic",
    ai_model: row?.ai_model ?? null,
    knowledge_prefs: row?.knowledge_prefs ?? {},
    social_connections: row?.social_connections ?? {},
    updated_by: row?.updated_by ?? null,
    created_at: row?.created_at ?? new Date(0).toISOString(),
    updated_at: row?.updated_at ?? new Date(0).toISOString(),
    brand_voice: { ...DEFAULT_BRAND_VOICE, ...((row?.brand_voice as Partial<BrandVoice> | null) ?? {}) },
    pillars: Array.isArray(row?.pillars) && (row!.pillars as PillarConfig[]).length ? (row!.pillars as PillarConfig[]) : DEFAULT_PILLARS,
    privacy_rules: { ...DEFAULT_PRIVACY_RULES, ...((row?.privacy_rules as Partial<PrivacyRules> | null) ?? {}) },
    approval_rules: { ...DEFAULT_APPROVAL_RULES, ...((row?.approval_rules as Partial<ApprovalRules> | null) ?? {}) },
    media_prefs: { ...DEFAULT_MEDIA_PREFS, ...((row?.media_prefs as Partial<MediaPrefs> | null) ?? {}) },
  };
}
