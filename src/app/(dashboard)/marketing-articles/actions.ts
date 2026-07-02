"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { runArticleGeneration } from "@/lib/marketing/run-article-generation";

/**
 * Admin-triggered "generate now": create a new AI article draft on demand
 * (same flow as the twice-weekly cron). Admin-gated — server actions are
 * callable endpoints, so re-check the role here.
 */
export async function generateArticleNow(): Promise<void> {
  await requireRole(["admin"]);
  await runArticleGeneration();
  revalidatePath("/marketing-articles");
}
