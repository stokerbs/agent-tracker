/**
 * Structured-output schemas shared by prompt modules (zod v4 → JSON schema via
 * the Anthropic SDK helper). Keep to the structured-outputs subset: enums,
 * nullable, arrays, objects — no min/max/regex constraints (clamp in code).
 */
import { z } from "zod/v4";

export const PILLAR_ENUM = z.enum([
  "detective_knowledge",
  "case_story",
  "detective_pov",
  "red_flags",
  "behind_investigation",
  "service",
]);

export const PLATFORM_ENUM = z.enum([
  "tiktok",
  "instagram_reel",
  "instagram_post",
  "instagram_carousel",
  "facebook",
  "youtube_short",
  "article",
  "line_oa",
]);

export const FORMAT_ENUM = z.enum([
  "short_video",
  "carousel",
  "post",
  "article",
  "story",
  "caption_short",
  "caption_long",
  "outline",
]);

/** Knowledge block ids the model used, e.g. ["K1","K3"], or "ai_general". */
export const SOURCE_REF = z.string().describe('A knowledge block id like "K1", or "ai_general" when drawn from general knowledge');

export const IdeaSchema = z.object({
  title: z.string().describe("Thai working title, ≤ 60 chars"),
  hook: z.string().describe("Opening line for the first 3 seconds, Thai"),
  description: z.string().describe("2–3 sentences: what the piece teaches / shows and why viewers care"),
  pillar: PILLAR_ENUM,
  platforms: z.array(PLATFORM_ENUM),
  format: FORMAT_ENUM,
  source_refs: z.array(SOURCE_REF).describe("Knowledge block ids actually used"),
  scores: z.object({
    hook: z.number().describe("1-5 estimated hook strength"),
    educational: z.number().describe("1-5 educational value"),
    conversion: z.number().describe("1-5 likelihood to prompt an inquiry"),
    originality: z.number().describe("1-5 how fresh vs. common content"),
    rationale: z.string().describe("One sentence in Thai on why these scores"),
  }),
  tags: z.array(z.string()),
});
export type IdeaOutput = z.infer<typeof IdeaSchema>;

export const IdeasResponseSchema = z.object({
  ideas: z.array(IdeaSchema),
  knowledge_gaps: z.array(z.string()).describe("Topics the brief asked for that the knowledge blocks do not cover (Thai). Empty if none."),
});

export const CampaignResponseSchema = z.object({
  interpretation: z.object({
    objective: z.string().describe("Campaign goal in Thai, one sentence"),
    audience: z.string(),
    platforms: z.array(PLATFORM_ENUM),
    pillar_focus: z.array(PILLAR_ENUM),
    tone: z.string(),
    post_count: z.number(),
    cta: z.string(),
  }),
  title: z.string().describe("Short campaign title in Thai"),
  ideas: z.array(IdeaSchema),
  mix_note: z.string().describe("One or two sentences in Thai on how the ideas balance the content pillars"),
  knowledge_gaps: z.array(z.string()),
});
export type CampaignOutput = z.infer<typeof CampaignResponseSchema>;

export const ClaimSchema = z.object({
  claim: z.string().describe("A factual statement made in the script/caption, Thai"),
  source_ref: SOURCE_REF,
  confidence: z.enum(["supported", "partially_supported", "ai_suggestion"]),
});

export const ScriptResponseSchema = z.object({
  hook: z.string(),
  script: z.string().describe("Full spoken script in Thai. Sections separated by blank lines; may use short labels like [HOOK] [CONTEXT] [INSIGHT] [PAYOFF] [CTA] at line starts when helpful, but do not force every section."),
  caption: z.string().describe("Platform caption in Thai, ends with 3–5 hashtags"),
  cta: z.string(),
  estimated_seconds: z.number().describe("Your own estimate of spoken length"),
  ai_notes: z.string().describe("Short note to the owner in Thai: what to double-check, what could be stronger"),
  source_refs: z.array(SOURCE_REF),
  claims: z.array(ClaimSchema),
});
export type ScriptOutput = z.infer<typeof ScriptResponseSchema>;

export const HooksResponseSchema = z.object({
  hooks: z.array(
    z.object({
      text: z.string(),
      angle: z.enum(["counter_intuitive", "specific_observation", "mistake", "question_with_tension", "mini_story", "myth_vs_reality"]),
      why: z.string().describe("Why this could stop the scroll — one sentence, Thai"),
    }),
  ),
});

export const RewriteResponseSchema = z.object({
  text: z.string(),
  change_note: z.string().describe("What changed and why, Thai, one sentence"),
});

export const CtaResponseSchema = z.object({
  options: z.array(z.object({ text: z.string(), style: z.enum(["soft", "educational", "direct"]) })),
});

export const CreativeShotSchema = z.object({
  start_sec: z.number(),
  end_sec: z.number(),
  voice: z.string().describe("Spoken line(s) in this window"),
  visual: z.string().describe("What is on screen: B-roll idea, framing, on-camera"),
  text_overlay: z.string().nullable(),
});

export const CreativePlanResponseSchema = z.object({
  shots: z.array(CreativeShotSchema),
  broll: z.array(z.string()).describe("Safe, non-identifying B-roll ideas (no real plates, faces, addresses)"),
  text_overlays: z.array(z.string()),
  subtitle_style: z.string().nullable(),
  voiceover_notes: z.string().nullable(),
  thumbnail_concept: z.string().nullable(),
  music_mood: z.string().nullable(),
});
export type CreativePlanOutput = z.infer<typeof CreativePlanResponseSchema>;

export const VariantSchema = z.object({
  platform: PLATFORM_ENUM,
  format: FORMAT_ENUM,
  hook: z.string().nullable(),
  script: z.string().nullable().describe("For video platforms: spoken script. For carousel: one slide per line prefixed 'Slide N:'. For article: markdown outline."),
  caption: z.string().nullable(),
  cta: z.string().nullable(),
});
export const RepurposeResponseSchema = z.object({ variants: z.array(VariantSchema) });
export type RepurposeOutput = z.infer<typeof RepurposeResponseSchema>;

export const CaseInsightsResponseSchema = z.object({
  insights: z.array(
    z.object({
      title: z.string().describe("Short Thai title of the lesson"),
      insight: z.string().describe("Generalised insight — no identifiers"),
      lesson: z.string().describe("What a viewer can learn / apply"),
      content_angle: z.string().describe("How to turn it into content"),
      pillar: PILLAR_ENUM,
      privacy_status: z.enum(["safe", "review_required", "blocked"]).describe("Your own assessment: does the insight still risk identifying anyone?"),
      privacy_note: z.string().nullable(),
    }),
  ),
  anonymized_version: z.string().describe("A fully generalised narrative of the case suitable as a Case Story source (Thai, 4–8 sentences)"),
});
export type CaseInsightsOutput = z.infer<typeof CaseInsightsResponseSchema>;

export const FaqExtractResponseSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe("Canonical form of the recurring question, Thai"),
      answer_hint: z.string().describe("How Detective Pulse typically answers, generalised"),
      frequency: z.number().describe("How many times a variant appeared in the pasted text"),
      tags: z.array(z.string()),
      content_idea: z.string().describe("One content angle this question suggests"),
    }),
  ),
});
export type FaqExtractOutput = z.infer<typeof FaqExtractResponseSchema>;

export const PrivacyReviewResponseSchema = z.object({
  status: z.enum(["safe", "review_required", "blocked"]),
  findings: z.array(
    z.object({
      kind: z.enum(["name", "phone", "email", "plate", "address", "location", "date", "company", "photo", "line_id", "url", "id_number", "other"]),
      excerpt: z.string(),
      reason: z.string().describe("Thai"),
      severity: z.enum(["low", "medium", "high"]),
      field: z.string().nullable(),
    }),
  ),
  summary: z.string().describe("One or two sentences in Thai explaining the verdict"),
  generalisation_suggestions: z.array(z.string()).describe("Concrete rewrites that generalise a risky detail WITHOUT inventing new details"),
});
export type PrivacyReviewOutput = z.infer<typeof PrivacyReviewResponseSchema>;

export const ContentMixResponseSchema = z.object({
  flags: z.array(z.string()).describe("Imbalance warnings in Thai, e.g. 'Case Story คิดเป็น 55% ของสัปดาห์นี้ …'. Empty if balanced."),
  suggestions: z.array(
    z.object({
      pillar: PILLAR_ENUM,
      title: z.string(),
      hook: z.string(),
      reason: z.string(),
      source_refs: z.array(SOURCE_REF),
    }),
  ),
  unused_knowledge: z.array(z.string()).describe("Titles of knowledge blocks that have not been turned into content yet and would make good pieces"),
});
export type ContentMixOutput = z.infer<typeof ContentMixResponseSchema>;
