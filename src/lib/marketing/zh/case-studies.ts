import { caseStudiesFor, type LocalizedCaseStudy } from "@/lib/marketing/case-studies";

/**
 * Chinese view of the trilingual case-study registry
 * (src/lib/marketing/case-studies.ts). Kept as a named export so the Chinese
 * pages and tests keep their import; adding a case to the shared registry
 * populates all three languages at once. Still EMPTY until the owner supplies
 * real, consented, anonymised cases — nothing here may be invented.
 */
export type ZhCaseStudy = LocalizedCaseStudy;

export const ZH_CASE_STUDIES: ZhCaseStudy[] = caseStudiesFor("zh");
