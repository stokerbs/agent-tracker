import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { PILLARS, STUDIO_SETTINGS_ID } from "@/lib/studio/constants";
import { SOCIAL_PLATFORMS, TARGET_DURATIONS, type SocialPlatform } from "@/lib/studio/types";
import type {
  ApprovalRules,
  AutopilotSettings,
  BrandVoice,
  MediaPrefs,
  PillarConfig,
  PrivacyRules,
  SocialConnections,
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
export const DEFAULT_AUTOPILOT: AutopilotSettings = {
  enabled: false,
  days: [1, 4],
  platforms: ["facebook", "instagram"],
  pillar_mode: "rotate",
  pillar: null,
  target_seconds: 30,
  images_per_run: 1,
  auto_publish: true,
  publish_on_review_required: false,
  allow_unsupported_claims: false,
  max_runs_per_week: 3,
};

export const DEFAULT_SOCIAL_CONNECTIONS: SocialConnections = {
  ayrshare: { checked_at: null, active: [], display_names: {} },
  defaults: { youtube_visibility: "public", tiktok_privacy: "PUBLIC_TO_EVERYONE" },
};
export const DEFAULT_MEDIA_PREFS: MediaPrefs = {
  image_style:
    "Cinematic, moody documentary photography for a Thai private-investigation brand. Dark navy and amber palette, shallow depth of field, urban Bangkok night settings, realistic textures. No text, no watermark.",
  default_aspect: "9:16",
  image_model: "",
  tts_voice_id: "",
  tts_model: "eleven_v3",
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

/** These two booleans gate publishing, so a stray jsonb string must not read as true. */
function normaliseApproval(v: unknown): ApprovalRules {
  const raw = (v && typeof v === "object" ? v : {}) as Partial<ApprovalRules>;
  return {
    require_privacy_safe: typeof raw.require_privacy_safe === "boolean" ? raw.require_privacy_safe : DEFAULT_APPROVAL_RULES.require_privacy_safe,
    allow_override: typeof raw.allow_override === "boolean" ? raw.allow_override : DEFAULT_APPROVAL_RULES.allow_override,
  };
}

/**
 * Autopilot config gates a fully automatic public post, so nothing is trusted
 * from jsonb: booleans are coerced strictly (a stray "no" string must not read
 * as true), enums are whitelisted and numbers are clamped.
 */
function normaliseAutopilot(v: unknown): AutopilotSettings {
  const raw = (v && typeof v === "object" ? v : {}) as Partial<AutopilotSettings>;
  const bool = (x: unknown, fallback: boolean) => (typeof x === "boolean" ? x : fallback);
  const days = Array.isArray(raw.days) ? raw.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [];
  const platforms = Array.isArray(raw.platforms) ? raw.platforms.filter((p): p is SocialPlatform => SOCIAL_PLATFORMS.includes(p as SocialPlatform)) : [];
  const num = (x: unknown, fallback: number, lo: number, hi: number) => (typeof x === "number" && Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : fallback);
  return {
    enabled: bool(raw.enabled, DEFAULT_AUTOPILOT.enabled),
    days: days.length ? Array.from(new Set(days)).sort() : DEFAULT_AUTOPILOT.days,
    platforms: platforms.length ? Array.from(new Set(platforms)) : DEFAULT_AUTOPILOT.platforms,
    pillar_mode: raw.pillar_mode === "fixed" ? "fixed" : "rotate",
    pillar: PILLARS.includes(raw.pillar as (typeof PILLARS)[number]) ? (raw.pillar as AutopilotSettings["pillar"]) : null,
    target_seconds: (TARGET_DURATIONS as readonly number[]).includes(raw.target_seconds as number) ? raw.target_seconds! : DEFAULT_AUTOPILOT.target_seconds,
    images_per_run: num(raw.images_per_run, DEFAULT_AUTOPILOT.images_per_run, 1, 6),
    auto_publish: bool(raw.auto_publish, DEFAULT_AUTOPILOT.auto_publish),
    publish_on_review_required: bool(raw.publish_on_review_required, DEFAULT_AUTOPILOT.publish_on_review_required),
    allow_unsupported_claims: bool(raw.allow_unsupported_claims, DEFAULT_AUTOPILOT.allow_unsupported_claims),
    max_runs_per_week: num(raw.max_runs_per_week, DEFAULT_AUTOPILOT.max_runs_per_week, 1, 14),
  };
}

function normaliseSocial(v: unknown): SocialConnections {
  const raw = (v && typeof v === "object" ? v : {}) as Partial<{ ayrshare: Partial<SocialConnections["ayrshare"]>; defaults: Partial<SocialConnections["defaults"]> }>;
  return {
    ayrshare: { ...DEFAULT_SOCIAL_CONNECTIONS.ayrshare, ...(raw.ayrshare ?? {}), active: Array.isArray(raw.ayrshare?.active) ? raw.ayrshare!.active! : [] },
    defaults: { ...DEFAULT_SOCIAL_CONNECTIONS.defaults, ...(raw.defaults ?? {}) },
  };
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
    social_connections: normaliseSocial(row?.social_connections),
    autopilot: normaliseAutopilot(row?.autopilot),
    updated_by: row?.updated_by ?? null,
    created_at: row?.created_at ?? new Date(0).toISOString(),
    updated_at: row?.updated_at ?? new Date(0).toISOString(),
    brand_voice: { ...DEFAULT_BRAND_VOICE, ...((row?.brand_voice as Partial<BrandVoice> | null) ?? {}) },
    pillars: Array.isArray(row?.pillars) && (row!.pillars as PillarConfig[]).length ? (row!.pillars as PillarConfig[]) : DEFAULT_PILLARS,
    privacy_rules: { ...DEFAULT_PRIVACY_RULES, ...((row?.privacy_rules as Partial<PrivacyRules> | null) ?? {}) },
    approval_rules: normaliseApproval(row?.approval_rules),
    media_prefs: { ...DEFAULT_MEDIA_PREFS, ...((row?.media_prefs as Partial<MediaPrefs> | null) ?? {}) },
  };
}
