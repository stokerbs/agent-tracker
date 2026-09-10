// ============================================================================
// Creative Studio — domain types.
// Row types are aliased from the generated Supabase types; jsonb payload
// shapes and app-only unions are hand-authored here.
// ============================================================================

import type { Database } from "@/lib/database.types";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
type Insert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];

// ─── Unions (mirror the CHECK constraints in migration 0109) ─────────────────
export type Pillar =
  | "detective_knowledge"
  | "case_story"
  | "detective_pov"
  | "red_flags"
  | "behind_investigation"
  | "service";

export type Platform =
  | "tiktok"
  | "instagram_reel"
  | "instagram_post"
  | "instagram_carousel"
  | "facebook"
  | "youtube_short"
  | "article"
  | "line_oa";

export type ContentFormat =
  | "short_video"
  | "carousel"
  | "post"
  | "article"
  | "story"
  | "caption_short"
  | "caption_long"
  | "outline";

export type ContentStatus =
  | "idea"
  | "draft"
  | "review"
  | "approved"
  | "scheduled"
  | "published"
  | "archived"
  | "rejected";

export type IdeaStatus = "new" | "saved" | "rejected" | "generated" | "archived";
export type IdeaOrigin = "ai" | "owner" | "knowledge" | "case" | "question" | "repurpose" | "trend";

export type Sensitivity = "public" | "internal" | "confidential" | "restricted";
export type ContentPotential = "low" | "medium" | "high";
export type PrivacyStatus = "safe" | "review_required" | "blocked";
export type SupportStatus =
  | "supported"
  | "partially_supported"
  | "ai_suggestion"
  | "needs_review"
  | "unsupported";
export type SourceKind = "knowledge" | "case_insight" | "customer_question" | "external" | "ai_general";
export type ReviewDecision = "approve" | "reject" | "request_changes" | "override_privacy";
export type CampaignStatus = "proposed" | "active" | "completed" | "archived";

export type KnowledgeCategory =
  | "cases"
  | "customer_questions"
  | "investigator_knowledge"
  | "owner_experience"
  | "services"
  | "articles"
  | "technology"
  | "osint"
  | "surveillance"
  | "gps"
  | "other";

export type KnowledgeSourceType =
  | "case"
  | "customer_question"
  | "investigator_knowledge"
  | "owner_experience"
  | "service"
  | "article"
  | "technology"
  | "osint"
  | "surveillance"
  | "gps"
  | "document"
  | "external"
  | "other";

export type QuestionSource = "line_oa" | "phone" | "web" | "manual" | "import";
export type TargetDuration = 15 | 30 | 45 | 60 | 90;
export const TARGET_DURATIONS: TargetDuration[] = [15, 30, 45, 60, 90];

// ─── jsonb payload shapes ────────────────────────────────────────────────────
export interface BrandVoice {
  language: "th" | "en";
  style: string[];
  avoid: string[];
  cta_default: string;
  custom_notes: string;
}

export interface PillarConfig {
  key: Pillar;
  target_pct: number;
}

export interface PrivacyRules {
  /** Names / terms that must never appear in content (clients, targets, staff). */
  denylist: string[];
  /** Extra regexes (as strings) the owner adds. */
  custom_patterns: string[];
  /** Whether a `review_required` result blocks approve without an override. */
  strict_mode: boolean;
}

export interface ApprovalRules {
  require_privacy_safe: boolean;
  allow_override: boolean;
}

// ─── Publishing (phase 2: aggregator auto-posting) ───────────────────────────
export type SocialPlatform = "facebook" | "instagram" | "tiktok" | "youtube" | "line_oa";
export const SOCIAL_PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "tiktok", "youtube"];
export type SocialPostStatus = "queued" | "scheduled" | "published" | "failed" | "deleted";
export type YoutubeVisibility = "public" | "private" | "unlisted";
export type TiktokPrivacy = "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";

export interface SocialConnections {
  ayrshare: { checked_at: string | null; active: SocialPlatform[]; display_names: Partial<Record<SocialPlatform, string>> };
  defaults: { youtube_visibility: YoutubeVisibility; tiktok_privacy: TiktokPrivacy };
}

// ─── Media generation (phase 1: images + voice-over) ─────────────────────────
export type ImageAspect = "9:16" | "1:1" | "16:9" | "4:5";
export const IMAGE_ASPECTS: ImageAspect[] = ["9:16", "1:1", "16:9", "4:5"];
export type MediaAssetKind = "thumbnail" | "broll" | "image" | "video" | "audio" | "subtitle" | "other";
export type MediaAssetStatus = "pending" | "ready" | "failed";

export interface MediaPrefs {
  /** Brand style preset prepended to every image prompt (Thai or English). */
  image_style: string;
  default_aspect: ImageAspect;
  /** Provider model id override; empty = env/default. */
  image_model: string;
  /** ElevenLabs voice id; empty = provider default voice. */
  tts_voice_id: string;
  tts_model: string;
}

/** AI-estimated idea scores. 1–5. Labelled "AI estimate" in UI — not validated predictions. */
export interface AiScores {
  hook: number;
  educational: number;
  conversion: number;
  originality: number;
  rationale?: string;
}

export interface SourceRef {
  kind: SourceKind;
  id: string | null;
  label: string;
}

export interface CreativeShot {
  start_sec: number;
  end_sec: number;
  voice: string;
  visual: string;
  text_overlay?: string | null;
}

export interface CreativePlan {
  shots: CreativeShot[];
  broll: string[];
  text_overlays: string[];
  subtitle_style?: string | null;
  voiceover_notes?: string | null;
  thumbnail_concept?: string | null;
  music_mood?: string | null;
}

export interface PrivacyFinding {
  kind:
    | "phone"
    | "email"
    | "plate"
    | "line_id"
    | "url"
    | "address"
    | "id_number"
    | "date"
    | "denylist"
    | "name"
    | "location"
    | "company"
    | "photo"
    | "other";
  excerpt: string;
  reason: string;
  severity: "low" | "medium" | "high";
  field?: string;
  source: "deterministic" | "ai";
}

// ─── Row aliases ─────────────────────────────────────────────────────────────
export type StudioSettingsRow = Omit<
  Row<"studio_settings">,
  "brand_voice" | "pillars" | "privacy_rules" | "approval_rules" | "media_prefs" | "social_connections"
> & {
  brand_voice: BrandVoice;
  pillars: PillarConfig[];
  privacy_rules: PrivacyRules;
  approval_rules: ApprovalRules;
  media_prefs: MediaPrefs;
  social_connections: SocialConnections;
};
export type SocialPost = Row<"studio_social_posts">;

export type KnowledgeSource = Row<"studio_knowledge_sources">;
export type KnowledgeSourceInsert = Insert<"studio_knowledge_sources">;
export type KnowledgeChunk = Row<"studio_knowledge_chunks">;
export type StudioCase = Row<"studio_cases">;
export type StudioCaseInsert = Insert<"studio_cases">;
export type CaseInsight = Row<"studio_case_insights">;
export type CustomerQuestion = Row<"studio_customer_questions">;
export type Campaign = Row<"studio_campaigns">;
export type Idea = Omit<Row<"studio_ideas">, "ai_scores" | "source_refs"> & {
  ai_scores: AiScores | null;
  source_refs: SourceRef[];
};
export type ContentMaster = Omit<Row<"studio_content_masters">, "creative_plan"> & {
  creative_plan: CreativePlan | null;
};
export type ContentVariant = Omit<Row<"studio_content_variants">, "creative_plan"> & {
  creative_plan: CreativePlan | null;
};
export type ContentSource = Row<"studio_content_sources">;
export type ContentClaim = Row<"studio_content_claims">;
export type PrivacyCheck = Omit<Row<"studio_privacy_checks">, "findings"> & {
  findings: PrivacyFinding[];
};
export type ContentReview = Row<"studio_content_reviews">;
export type CreativeAsset = Row<"studio_creative_assets">;
export type AnalyticsRow = Row<"studio_analytics">;
export type AiGeneration = Row<"studio_ai_generations">;

/** Result shape shared by studio server actions. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };
