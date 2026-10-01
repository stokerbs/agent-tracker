"use server";

import { revalidatePath } from "next/cache";
import { decideArticle, getArticleByToken } from "@/lib/marketing/articles-db";
import { ZH_SERVICE_PAGE, articleServiceKey } from "@/lib/marketing/zh/nav";

/** Approve a draft (token-gated). Publishes it and refreshes the article lists,
 *  including the Chinese hub and the service page that lists related articles. */
export async function approveArticle(token: string): Promise<void> {
  const status = await decideArticle(token, "published");
  if (status === "published") {
    revalidatePath("/articles");
    revalidatePath("/en/articles");
    revalidatePath("/zh/articles");
    const a = await getArticleByToken(token);
    if (a?.zh_slug) {
      revalidatePath(ZH_SERVICE_PAGE[articleServiceKey(a.service, a.cover_category)] ?? "/zh/private-investigator-thailand");
      revalidatePath("/zh");
    }
  }
}

/** Reject a draft (token-gated). */
export async function rejectArticle(token: string): Promise<void> {
  await decideArticle(token, "rejected");
}
