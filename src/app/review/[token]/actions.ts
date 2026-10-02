"use server";

import { revalidatePath } from "next/cache";
import { decideArticle, getArticleByToken, setDraftBodies } from "@/lib/marketing/articles-db";
import { ZH_SERVICE_PAGE, articleServiceKey } from "@/lib/marketing/zh/nav";
import { isCalendarTopic } from "@/lib/marketing/content-calendar";
import { hasHumanParagraphMarker, insertHumanParagraph, isValidHumanParagraph } from "@/lib/marketing/human-paragraph";
import { servicePathForKey } from "@/lib/marketing/pages";
import { reportError } from "@/lib/errors";

export type ApproveResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "human_paragraph_required" | "human_paragraph_invalid" | "update_failed" };

/** Does this draft need the owner's first-hand paragraph before it may publish?
 *  Content-calendar topics always do; so does any draft still carrying the marker. */
export async function needsHumanParagraph(a: { topic: string; th_body: string; en_body: string }): Promise<boolean> {
  return isCalendarTopic(a.topic) || hasHumanParagraphMarker(a.th_body) || hasHumanParagraphMarker(a.en_body);
}

/** Approve a draft (token-gated). Calendar drafts publish only with the owner's
 *  paragraph, spliced into the TH and EN bodies first. Then refreshes the
 *  article lists and the TH/EN/ZH service pages that list related articles. */
export async function approveArticle(token: string, formData?: FormData): Promise<ApproveResult> {
  const draft = await getArticleByToken(token);
  if (!draft) return { ok: false, error: "not_found" };
  if (draft.status === "draft" && (await needsHumanParagraph(draft))) {
    const th = formData?.get("humanParagraphTh");
    const en = formData?.get("humanParagraphEn");
    if (typeof th !== "string" || !th.trim() || typeof en !== "string" || !en.trim()) {
      return { ok: false, error: "human_paragraph_required" };
    }
    if (!isValidHumanParagraph(th) || !isValidHumanParagraph(en)) return { ok: false, error: "human_paragraph_invalid" };
    try {
      const updated = await setDraftBodies(token, {
        th_body: insertHumanParagraph(draft.th_body, th),
        en_body: insertHumanParagraph(draft.en_body, en),
      });
      if (!updated) return { ok: false, error: "not_found" };
    } catch (e) {
      reportError(e, "review:human-paragraph");
      return { ok: false, error: "update_failed" };
    }
    console.info("[review] human paragraph added", { topic: draft.topic, thChars: th.trim().length, enChars: en.trim().length });
  }
  const status = await decideArticle(token, "published");
  if (status === "published") {
    revalidatePath("/articles");
    revalidatePath("/en/articles");
    revalidatePath("/zh/articles");
    const thPath = servicePathForKey("th", draft.service);
    const enPath = servicePathForKey("en", draft.service);
    if (thPath) revalidatePath(thPath);
    if (enPath) revalidatePath(enPath);
    if (draft.zh_slug) {
      revalidatePath(ZH_SERVICE_PAGE[articleServiceKey(draft.service, draft.cover_category)] ?? "/zh/private-investigator-thailand");
      revalidatePath("/zh");
    }
  }
  return { ok: true };
}

/** Reject a draft (token-gated). */
export async function rejectArticle(token: string): Promise<void> {
  await decideArticle(token, "rejected");
}
