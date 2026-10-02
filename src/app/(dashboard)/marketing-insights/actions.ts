"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { handleDbError } from "@/lib/errors";
import { AD_LOCALES, AD_PLATFORMS, adSpendRowSchema, parseAdSpendCsv } from "@/lib/marketing/ad-spend";

const schema = z.object({
  platform: z.enum(AD_PLATFORMS),
  locale: z.enum(AD_LOCALES),
  csv: z.string().min(1).max(500_000),
});

export type ImportResult =
  | { ok: true; imported: number; skipped: { line: number; message: string }[] }
  | { ok: false; error: string; skipped?: { line: number; message: string }[] };

/**
 * Admin-only ad-spend import (migration 0128). The pasted CSV is parsed and
 * every row re-validated server-side, then upserted on (date, platform,
 * campaign, locale) through the RLS admin policy. Audited with counts only.
 */
export async function importAdSpend(formData: FormData): Promise<ImportResult> {
  const profile = await requireRole(["admin"]);
  const parsed = schema.safeParse({ platform: formData.get("platform"), locale: formData.get("locale"), csv: formData.get("csv") });
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { rows, errors } = parseAdSpendCsv(parsed.data.csv, { platform: parsed.data.platform, locale: parsed.data.locale });
  const valid = rows.filter((r) => adSpendRowSchema.safeParse(r).success);
  if (valid.length === 0) return { ok: false, error: "no_rows", skipped: errors };
  if (valid.length > 2000) return { ok: false, error: "too_many_rows" };

  const supabase = await createClient(); // RLS: admin insert/update policies
  const { error } = await supabase
    .from("marketing_ad_spend")
    .upsert(valid.map((r) => ({ ...r, imported_by: profile.id, imported_at: new Date().toISOString() })), { onConflict: "spend_date,platform,campaign,locale" });
  if (error) return { ok: false, error: handleDbError(error, "marketing-insights:importAdSpend") };

  await logAudit({
    actorId: profile.id,
    action: "AD_SPEND_IMPORT",
    entity: "marketing_ad_spend",
    entityId: null,
    metadata: { platform: parsed.data.platform, locale: parsed.data.locale, rows: valid.length, skipped: errors.length, total_cost: valid.reduce((a, r) => a + r.cost, 0) },
  });
  console.info("[marketing-insights] ad spend imported", { platform: parsed.data.platform, rows: valid.length, skipped: errors.length });
  revalidatePath("/marketing-insights");
  return { ok: true, imported: valid.length, skipped: errors };
}
