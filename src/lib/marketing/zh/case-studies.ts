/**
 * Anonymised Chinese case studies (docs/china-market/13 — template + rules).
 * EMPTY by design: Detective Pulse must supply real cases; nothing here may be
 * invented. Adding an entry automatically removes `noindex` from
 * /zh/case-studies. Never include names, target identities, addresses, plates,
 * phone numbers, investigator identities or surveillance tactics.
 */
export interface ZhCaseStudy {
  id: string;
  /** Short service tag, e.g. "感情调查" */
  service: string;
  /** City/area at province level only, e.g. "曼谷" */
  location: string;
  /** e.g. "5 天" */
  timeline: string;
  title: string;
  situation: string;
  objective: string;
  challenges: string;
  /** High-level only — no tactics. */
  approach: string;
  deliverables: string;
  outcome: string;
  lessons: string;
}

export const ZH_CASE_STUDIES: ZhCaseStudy[] = [];
