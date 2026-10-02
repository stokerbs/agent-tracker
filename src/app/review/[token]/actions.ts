"use server";

import { revalidatePath } from "next/cache";
import { decideArticle, getArticleByToken, setDraftBodies } from "@/lib/marketing/articles-db";
import { ZH_SERVICE_PAGE, articleServiceKey } from "@/lib/marketing/zh/nav";
import { isCalendarTopic } from "@/lib/marketing/content-calendar";
import { insertHumanParagraph, isValidHumanParagraph, needsHumanParagraph } from "@/lib/marketing/human-paragraph";
import { logAudit } from "@/lib/audit";
import { servicePathForKey } from "@/lib/marketing/pages";
import { reportError } from "@/lib/errors";

export type ApproveResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "human_paragraph_required" | "human_paragraph_invalid" | "update_failed" };

/** Approve a draft (token-gated). Calendar drafts publish only with the owner's
 *  paragraph, spliced into the TH and EN bodies first. Then refreshes the
 *  article lists and the TH/EN/ZH service pages that list related articles. */
export async function approveArticle(token: string, formData?: FormData): Promise<ApproveResult> {
  const draft = await getArticleByToken(token);
  if (!draft) return { ok: false, error: "not_found" };
  if (draft.status === "draft" && needsHumanParagraph(draft, isCalendarTopic)) {
    const th = formData?.get("humanParagraphTh");
    const en = formData?.get("humanParagraphEn");
    if (typeof th !== "string" || !th.trim() || typeof en !== "string" || !en.trim()) {
      console.warn("[review] publish refused: human paragraph required", { topic: draft.topic });
      return { ok: false, error: "human_paragraph_required" };
    }
    if (!isValidHumanParagraph(th) || !isValidHumanParagraph(en)) {
      console.warn("[review] publish refused: human paragraph invalid", { topic: draft.topic, thChars: th.trim().length, enChars: en.trim().length });
      return { ok: false, error: "human_paragraph_invalid" };
    }
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
    // The one-time token now authorises authoring text into a public page — audit it (no actor: token-gated).
    await logAudit({ actorId: null, action: "ARTICLE_HUMAN_PARAGRAPH", entity: "marketing_articles", entityId: draft.id, metadata: { topic: draft.topic, thChars: th.trim().length, enChars: en.trim().length } });
    console.info("[review] human paragraph added", { topic: draft.topic, thChars: th.trim().length, enChars: en.trim().length });
  }
  const status = await decideArticle(token, "published");
  // Already decided elsewhere (double click / second device): say so instead of a silent no-op.
  if (status !== "published") {
    console.warn("[review] publish no-op: draft no longer pending", { topic: draft.topic, status: draft.status });
    return { ok: false, error: "not_found" };
  }
  console.info("[review] published", { topic: draft.topic, service: draft.service ?? null });
  revalidatePath(`/review/${token}`); // re-render the review page into its "published" state
  {
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
  const status = await decideArticle(token, "rejected");
  console.info("[review] rejected", { token_suffix: token.slice(-4), status });
  revalidatePath(`/review/${token}`);
}
