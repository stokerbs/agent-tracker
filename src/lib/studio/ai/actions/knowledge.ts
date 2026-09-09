import "server-only";

import { getStudioSettings } from "@/lib/studio/settings";
import type { StudioCase } from "@/lib/studio/types";
import { brandSystemPrompt } from "../prompts/brand";
import { caseInsightsUserPrompt, faqExtractUserPrompt } from "../prompts/knowledge-extraction";
import { CaseInsightsResponseSchema, FaqExtractResponseSchema, type CaseInsightsOutput, type FaqExtractOutput } from "../prompts/schemas";
import { runStructured, type RunResult } from "../run";

/**
 * Case → insights. Input is the STUDIO case record (staff-written knowledge),
 * never the operations case. The generation log stores only the case id.
 */
export async function extractCaseInsights(input: { studioCase: StudioCase; userId: string | null }): Promise<RunResult<CaseInsightsOutput>> {
  const settings = await getStudioSettings();
  const c = input.studioCase;
  return runStructured({
    purpose: "case_insights",
    schema: CaseInsightsResponseSchema,
    system: brandSystemPrompt(settings.brand_voice),
    user: caseInsightsUserPrompt({
      caseCode: c.case_code,
      caseType: c.case_type,
      title: c.title,
      situation: c.situation,
      objective: c.objective,
      method: c.method,
      observations: c.observations,
      outcome: c.outcome,
      lessons: c.lessons,
      interestingInsight: c.interesting_insight,
    }),
    inputRefs: { studio_case_id: c.id, case_code: c.case_code },
    userId: input.userId,
    effort: "high",
    maxTokens: 6000,
  });
}

/** Pasted LINE/phone/web excerpts → recurring, identity-free questions. */
export async function extractCustomerFAQs(input: { pastedText: string; source: string; userId: string | null }): Promise<RunResult<FaqExtractOutput>> {
  const settings = await getStudioSettings();
  return runStructured({
    purpose: "faq_extract",
    schema: FaqExtractResponseSchema,
    system: brandSystemPrompt(settings.brand_voice),
    user: faqExtractUserPrompt(input),
    // Never log the pasted text — it may contain customer identities.
    inputRefs: { source: input.source, chars: input.pastedText.length },
    userId: input.userId,
    effort: "medium",
    maxTokens: 6000,
    // Raw output may echo customer text before faq-mining's second scrub.
    storeOutput: false,
  });
}
