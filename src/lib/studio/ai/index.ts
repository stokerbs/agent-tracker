/**
 * Creative Studio AI layer — public surface.
 * Server-only. Route-level server actions call these; UI never calls AI directly.
 */
export { generateIdeas, generateCampaign } from "./actions/ideas";
export type { GeneratedIdea, CampaignProposal } from "./actions/ideas";
export { generateScript, generateHooks, generateCTA, rewriteContent } from "./actions/script";
export type { GeneratedScript, GeneratedClaim } from "./actions/script";
export { repurposeContent, generateCreativePlan } from "./actions/repurpose";
export type { GeneratedVariant } from "./actions/repurpose";
export { extractCaseInsights, extractCustomerFAQs } from "./actions/knowledge";
export { extractChatKnowledge } from "./actions/chat-knowledge";
export { runPrivacyCheck } from "./actions/privacy";
export type { PrivacyCheckResult } from "./actions/privacy";
export { recommendContentMix, computeMixFlags } from "./actions/mix";
export type { ContentMixRecommendation } from "./actions/mix";
export { searchKnowledge } from "@/lib/studio/knowledge/search";
export { REWRITE_MODE_META, type RewriteMode } from "./prompts/rewrite";
export { resolveAiConfig, isAiAvailable } from "./provider";
export type { RunResult, RunErrorCode } from "./run";
