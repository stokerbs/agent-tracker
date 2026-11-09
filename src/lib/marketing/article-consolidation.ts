/**
 * Reviewed duplicate-topic families from the retired article generator.
 * Keep the earliest published URL as the main guide. Source rows and URLs
 * remain readable; no records are deleted or publication statuses changed.
 */
export const ARTICLE_CONSOLIDATION_GROUPS = [
  {
    "topic": "นักสืบเชียงใหม่",
    "primaryId": "f973b285-f5e0-41ce-ad7a-648f466f3300",
    "secondaryIds": [
      "501683c8-e57c-468d-8615-9fc5d98582bc"
    ]
  },
  {
    "topic": "รับสืบประวัติ",
    "primaryId": "470c0f2a-9d7f-4c55-94e7-01993b0a6bc4",
    "secondaryIds": [
      "b62f6df7-f3b9-44c1-9a40-4ef5d0c1a994"
    ]
  },
  {
    "topic": "นักสืบชู้สาว",
    "primaryId": "025586e0-b07d-4112-b911-74f56a24a2ea",
    "secondaryIds": [
      "c3b0bc18-403f-4f2c-a9cc-2df277908a6a"
    ]
  },
  {
    "topic": "นักสืบกรุงเทพ",
    "primaryId": "642bfb53-a5df-49b1-b685-d9797f15fa54",
    "secondaryIds": [
      "7354dfea-552c-452c-8f8d-1ecf2ea36ade"
    ]
  },
  {
    "topic": "นักสืบติดตามบุคคล",
    "primaryId": "0af3a9ad-cfa0-43b3-9e56-a33eaf07efc2",
    "secondaryIds": [
      "ba695d4b-fe4f-4963-8237-46a2be600b11"
    ]
  },
  {
    "topic": "ค่าจ้างนักสืบ",
    "primaryId": "07b7b0f1-cc0f-4051-b684-867eff7ca148",
    "secondaryIds": [
      "df1d0ffd-2160-43e4-a58c-e097c84dbbd3"
    ]
  },
  {
    "topic": "หานักสืบมืออาชีพ",
    "primaryId": "3af6ffcc-527b-4ffc-aebc-277f0a23ba41",
    "secondaryIds": [
      "e74653b6-4cb2-45e9-bc15-b09968502d1b",
      "58f9a4fd-1195-4267-a6bd-e4deb46e0741"
    ]
  },
  {
    "topic": "ตามหาคนโกงออนไลน์",
    "primaryId": "6cde5d47-92d9-47e9-ac77-9ada95410329",
    "secondaryIds": [
      "c1120ee9-2234-479c-9251-11d71a46a986"
    ]
  }
] as const;

export type ArticleLanguage = "th" | "en" | "zh";
export interface ArticleIdentity {
  id: string;
  th_slug: string; en_slug: string; zh_slug: string | null;
  th_title: string; en_title: string; zh_title: string | null;
  th_body: string; en_body: string; zh_body: string | null;
}

const primaryIds = new Map<string, string>(
  ARTICLE_CONSOLIDATION_GROUPS.flatMap((g) => g.secondaryIds.map((id) => [id, g.primaryId] as [string, string])),
);

/** Identity hint; callers still verify that the published target exists. */
export function preferredArticleId(id: string): string {
  return primaryIds.get(id) ?? id;
}

export function articleHasLanguage(article: ArticleIdentity, lang: ArticleLanguage): boolean {
  return Boolean(article[`${lang}_slug`] && article[`${lang}_title`] && article[`${lang}_body`]?.trim());
}

/** An unavailable/unpublished primary never hides a remaining published page. */
export function canonicalArticleFor<T extends ArticleIdentity>(article: T, published: readonly T[], lang: ArticleLanguage): T {
  const primaryId = primaryIds.get(article.id);
  if (!primaryId) return article;
  const primary = published.find((a) => a.id === primaryId);
  const coversExistingTranslations = primary && (["th", "en", "zh"] as const)
    .every((l) => !articleHasLanguage(article, l) || articleHasLanguage(primary, l));
  return primary && coversExistingTranslations && articleHasLanguage(primary, lang) ? primary : article;
}

export function canonicalArticles<T extends ArticleIdentity>(published: readonly T[], lang: ArticleLanguage): T[] {
  return published.filter((a) => articleHasLanguage(a, lang) && canonicalArticleFor(a, published, lang).id === a.id);
}
