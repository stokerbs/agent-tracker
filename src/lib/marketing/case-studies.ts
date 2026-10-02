/**
 * Anonymised case studies for the marketing site — ONE trilingual registry
 * rendered at /กรณีศึกษา (TH), /en/case-studies and /zh/case-studies.
 *
 * EMPTY BY DESIGN until Detective Pulse supplies real cases (audit Days
 * 31–90: "case-study system + first 6 cases; index at ≥ 3"). Nothing here may
 * be invented. Template and rules: docs/seo-growth-audit/case-study-template.md.
 *
 * Never include names, target identities, addresses, plates, phone numbers,
 * investigator identities, exact dates or surveillance tactics. Location is
 * province-level only; timelines are rounded ("5 days"); outcomes are factual
 * and never promise what a future client will get.
 */
export type CaseLang = "th" | "en" | "zh";
export type Localized = Record<CaseLang, string>;

export interface CaseStudy {
  /** Stable id, e.g. "cs-2026-01". Never a case number from the ops system. */
  id: string;
  /** Service key shared with the registry pages / analytics. */
  service: string;
  /** Province-level location. */
  location: Localized;
  /** Rounded duration, e.g. "5 days". */
  timeline: Localized;
  title: Localized;
  situation: Localized;
  objective: Localized;
  challenges: Localized;
  /** High-level only — never tactics. */
  approach: Localized;
  deliverables: Localized;
  outcome: Localized;
  lessons: Localized;
  /** Owner confirmed the client consented to anonymised publication. */
  consentConfirmed: true;
}

export const CASE_STUDIES: CaseStudy[] = [];

/** Pages index only once this many real cases exist (audit: "index at ≥ 3"). */
export const CASE_STUDY_INDEX_MIN = 3;

export function caseStudiesIndexable(count: number = CASE_STUDIES.length): boolean {
  return count >= CASE_STUDY_INDEX_MIN;
}

export interface LocalizedCaseStudy {
  id: string;
  service: string;
  location: string;
  timeline: string;
  title: string;
  situation: string;
  objective: string;
  challenges: string;
  approach: string;
  deliverables: string;
  outcome: string;
  lessons: string;
}

/** The registry projected to one language. */
export function caseStudiesFor(lang: CaseLang, list: CaseStudy[] = CASE_STUDIES): LocalizedCaseStudy[] {
  return list.map((c) => ({
    id: c.id,
    service: c.service,
    location: c.location[lang],
    timeline: c.timeline[lang],
    title: c.title[lang],
    situation: c.situation[lang],
    objective: c.objective[lang],
    challenges: c.challenges[lang],
    approach: c.approach[lang],
    deliverables: c.deliverables[lang],
    outcome: c.outcome[lang],
    lessons: c.lessons[lang],
  }));
}

/** Path of the case-study page per language. */
export const CASE_STUDIES_PATH: Record<CaseLang, string> = { th: "/กรณีศึกษา", en: "/en/case-studies", zh: "/zh/case-studies" };
