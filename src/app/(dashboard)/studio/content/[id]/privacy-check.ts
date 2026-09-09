import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { runPrivacyCheck, type PrivacyCheckResult } from "@/lib/studio/ai";
import type { PrivacyStatus } from "@/lib/studio/types";
import { logAudit } from "@/lib/audit";

/**
 * Shared helpers for the Content module's server actions (not a "use server"
 * file — plain server-only utilities imported by actions.ts / ai-actions.ts /
 * workflow-actions.ts).
 */

type Rls = SupabaseClient<Database>;

export interface PrivacyFieldsSource {
  title: string;
  hook: string | null;
  script: string | null;
  caption: string | null;
  cta: string | null;
}

/** Fields the privacy scan reads: everything that could be published (notes are internal → excluded). */
export function collectPrivacyFields(
  master: PrivacyFieldsSource,
  variants: { platform: string; hook: string | null; script: string | null; caption: string | null; cta: string | null }[],
): Record<string, string | null | undefined> {
  const fields: Record<string, string | null | undefined> = {
    title: master.title,
    hook: master.hook,
    script: master.script,
    caption: master.caption,
    cta: master.cta,
  };
  for (const v of variants) {
    fields[`variant:${v.platform}:hook`] = v.hook;
    fields[`variant:${v.platform}:script`] = v.script;
    fields[`variant:${v.platform}:caption`] = v.caption;
    fields[`variant:${v.platform}:cta`] = v.cta;
  }
  return fields;
}

export interface StoredPrivacyCheck {
  id: string | null;
  status: PrivacyStatus;
  result: PrivacyCheckResult;
}

/**
 * Runs a privacy check over the master + its variants and ALWAYS inserts a new
 * studio_privacy_checks row (the evidence trail). Returns the stored result.
 */
export async function runAndStorePrivacyCheck(
  rls: Rls,
  masterId: string,
  opts: { useAi: boolean; userId: string | null },
): Promise<{ ok: true; check: StoredPrivacyCheck } | { ok: false; error: string }> {
  const [{ data: master, error: mErr }, { data: variants, error: vErr }] = await Promise.all([
    rls.from("studio_content_masters").select("id, title, hook, script, caption, cta").eq("id", masterId).maybeSingle(),
    rls.from("studio_content_variants").select("platform, hook, script, caption, cta").eq("master_id", masterId),
  ]);
  if (mErr || vErr) {
    console.error("[studio:content] privacy load failed:", mErr?.message ?? vErr?.message);
    return { ok: false, error: "โหลดเนื้อหาเพื่อตรวจสอบไม่สำเร็จ" };
  }
  if (!master) return { ok: false, error: "ไม่พบคอนเทนต์" };

  const result = await runPrivacyCheck({
    fields: collectPrivacyFields(master, variants ?? []),
    useAi: opts.useAi,
    userId: opts.userId,
    masterId,
  });

  const { data: inserted, error: insErr } = await rls
    .from("studio_privacy_checks")
    .insert({
      master_id: masterId,
      status: result.status,
      findings: result.findings as never,
      checked_by: result.checked_by,
      model: result.model,
      created_by: opts.userId,
    })
    .select("id")
    .single();
  if (insErr) {
    console.error("[studio:content] privacy insert failed:", insErr.message);
    return { ok: false, error: "บันทึกผล Privacy Check ไม่สำเร็จ" };
  }
  console.info(`[studio:content] privacy check master=${masterId} status=${result.status} by=${result.checked_by} findings=${result.findings.length}`);
  return { ok: true, check: { id: inserted?.id ?? null, status: result.status, result } };
}

/** Latest privacy check row for a master (null when none). */
export async function getLatestPrivacyCheck(
  rls: Rls,
  masterId: string,
  opts: { checkedBy?: Array<"deterministic" | "ai" | "human"> } = {},
): Promise<{ id: string; status: PrivacyStatus; created_at: string } | null> {
  let q = rls
    .from("studio_privacy_checks")
    .select("id, status, created_at")
    .eq("master_id", masterId);
  if (opts.checkedBy?.length) q = q.in("checked_by", opts.checkedBy);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    console.error("[studio:content] latest privacy check failed:", error.message);
    return null;
  }
  return data ? { id: data.id, status: data.status as PrivacyStatus, created_at: data.created_at } : null;
}

/** Every route that renders content state. */
export function revalidateContentPaths(masterId?: string | null): void {
  revalidatePath("/studio/content");
  if (masterId) revalidatePath(`/studio/content/${masterId}`);
  revalidatePath("/studio/calendar");
  revalidatePath("/studio");
}

/**
 * Text edits after approval invalidate the approval: demote approved/scheduled
 * content back to draft (clearing approval + schedule) so it must pass the
 * privacy gate again. Returns true when a demotion happened.
 */
export async function reopenIfApproved(rls: Rls, masterId: string, actorId: string | null, reason: string): Promise<boolean> {
  const { data, error } = await rls.from("studio_content_masters").select("status, scheduled_at").eq("id", masterId).maybeSingle();
  if (error || !data) return false;
  if (data.status !== "approved" && data.status !== "scheduled") return false;
  const { error: uErr } = await rls
    .from("studio_content_masters")
    .update({ status: "draft", approved_by: null, approved_at: null, scheduled_at: null } as never)
    .eq("id", masterId);
  if (uErr) {
    console.error("[studio:content] reopen failed:", uErr.message);
    return false;
  }
  await logAudit({
    actorId,
    action: "STUDIO_CONTENT_REOPEN",
    entity: "studio_content_masters",
    entityId: masterId,
    metadata: { from_status: data.status, had_schedule: !!data.scheduled_at, reason },
  });
  console.info(`[studio:content] reopened master=${masterId} from=${data.status} reason=${reason}`);
  return true;
}
