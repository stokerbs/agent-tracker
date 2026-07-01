"use server";

import { revalidatePath } from "next/cache";
import { decideArticle } from "@/lib/marketing/articles-db";

/** Approve a draft (token-gated). Publishes it and refreshes the article lists. */
export async function approveArticle(token: string): Promise<void> {
  const status = await decideArticle(token, "published");
  if (status === "published") {
    revalidatePath("/articles");
    revalidatePath("/en/articles");
  }
}

/** Reject a draft (token-gated). */
export async function rejectArticle(token: string): Promise<void> {
  await decideArticle(token, "rejected");
}
